# irc-framework: Event Filter Hook for Flood Protection

## Context & Motivation

I'm building an IRC client (opentui_irc) that needs to survive IRCnet floodnet attacks — coordinated botnets of 10,000+ sessions that send mass CTCP, nick changes, and duplicate messages simultaneously. Without protection, clients hit MaxSendQ and get disconnected in seconds.

I previously wrote an anti-floodnet module for my irssi fork (erssi) in C. It works by intercepting IRC events via irssi's `signal_add_first()` + `signal_stop()` pattern — catching events before any handler runs, and suppressing them (including auto-responses) when flood is detected.

irc-framework has a middleware system (`raw_middleware` and `parsed_middleware`) but there's a critical gap: **the CTCP VERSION auto-response in `messaging.js` fires BEFORE `parsed_middleware` runs**, so middleware cannot prevent outgoing traffic during CTCP floods. This is the #1 cause of MaxSendQ death.

The goal is a minimal, backward-compatible change to irc-framework that enables consumers to filter/suppress ANY event (including CTCP auto-responses) before outgoing traffic is generated. This enables building flood protection without monkey-patching.

## What needs to change

### The Problem (messaging.js lines 81-86)

Currently in `src/commands/handlers/messaging.js`, VERSION CTCP is handled inline — the response is written directly to the socket before any event is emitted:

```javascript
} else if (ctcp_command === 'VERSION' && handler.connection.options.version) {
    handler.connection.write(util.format(
        'NOTICE %s :\x01VERSION %s\x01',
        command.nick,
        handler.connection.options.version
    ));
}
```

This means:
- No `'ctcp request'` event is emitted for VERSION (inconsistent with other CTCPs)
- No middleware can intercept it
- Consumers cannot suppress the auto-response during floods

### The Fix: Two changes

#### Change 1: messaging.js — Emit event for ALL CTCP requests, defer VERSION auto-response

In `src/commands/handlers/messaging.js`, make VERSION emit a `'ctcp request'` event like every other CTCP, and add a flag so the client can auto-respond AFTER middleware runs:

The PRIVMSG handler's CTCP block (lines 64-101) currently has three branches:
1. `ACTION` → emit `'action'` (correct, keep as-is)
2. `VERSION` with `options.version` set → write response directly (PROBLEM)
3. Everything else → emit `'ctcp request'` (correct)

Merge branches 2 and 3: ALL non-ACTION CTCPs should emit `'ctcp request'`. The VERSION auto-response should move to client.js where it runs after parsed_middleware.

#### Change 2: client.js — Handle VERSION auto-response after middleware

In `src/client.js`'s `proxyIrcEvents()`, after parsed_middleware completes and before/after `client.emit()`, add the VERSION auto-response logic. This way middleware can suppress the event (by not calling `next()`), which also suppresses the auto-response.

## Code Style Rules

This codebase uses:
- **4 spaces** indentation
- **Semicolons** required
- **Single quotes** for strings
- **`'use strict';`** at top of every file
- **Lodash cherry-pick** pattern: `const _ = { each: require('lodash/each') };`
- **`module.exports`** (CommonJS, no ES modules)
- **eslint-config-standard** rules
- **Mocha + Chai + Sinon** for tests

Match existing patterns exactly. Check with `npm run lint` before committing.

## Branch & PR Instructions

1. **Create branch:** `git checkout -b feature/ctcp-event-consistency` from `master` (or whatever the default branch is)
2. **Make the changes** described above
3. **Run:** `npm test` (runs lint + coverage)
4. **Commit** with a clear message explaining the backward-compatibility story
5. Do NOT change any other behavior — this must be a safe, minimal change

## Detailed Implementation Guide

### File 1: `src/commands/handlers/messaging.js`

Replace the three-way CTCP branch in the PRIVMSG handler. The current code (lines 64-101):

```javascript
if ((message.charAt(0) === '\x01') && (message.charAt(message.length - 1) === '\x01')) {
    const ctcp_command = message.slice(1, -1).split(' ')[0].toUpperCase();
    if (ctcp_command === 'ACTION') {
        handler.emit('action', { /* ... */ });
    } else if (ctcp_command === 'VERSION' && handler.connection.options.version) {
        handler.connection.write(util.format(
            'NOTICE %s :\x01VERSION %s\x01',
            command.nick,
            handler.connection.options.version
        ));
    } else {
        handler.emit('ctcp request', { /* ... */ });
    }
}
```

Should become:

```javascript
if ((message.charAt(0) === '\x01') && (message.charAt(message.length - 1) === '\x01')) {
    const ctcp_command = message.slice(1, -1).split(' ')[0].toUpperCase();
    if (ctcp_command === 'ACTION') {
        handler.emit('action', { /* ... keep identical ... */ });
    } else {
        handler.emit('ctcp request', {
            from_server: !command.nick,
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            target: target,
            group: target_group,
            type: ctcp_command || null,
            message: message.substring(1, message.length - 1),
            time: time,
            account: command.getTag('account'),
            tags: command.tags
        });
    }
}
```

Key: VERSION is no longer special-cased. It emits `'ctcp request'` like PING, TIME, etc. The auto-response moves to client.js.

### File 2: `src/client.js`

In `proxyIrcEvents()` (around line 228), after `parsed_middleware.handle()` completes and calls `client.emit()`, add VERSION auto-response:

Find this block (approximately lines 249-256):

```javascript
client.parsed_middleware.handle([event_name, event_arg, client], function(err) {
    if (err) {
        console.error(err.stack);
        return;
    }

    client.emit(event_name, event_arg);
});
```

Add VERSION auto-response logic after the emit:

```javascript
client.parsed_middleware.handle([event_name, event_arg, client], function(err) {
    if (err) {
        console.error(err.stack);
        return;
    }

    client.emit(event_name, event_arg);

    // Auto-respond to CTCP VERSION after middleware has had a chance to suppress
    if (event_name === 'ctcp request' && event_arg.type === 'VERSION' && client.options.version) {
        client.connection.write(util.format(
            'NOTICE %s :\x01VERSION %s\x01',
            event_arg.nick,
            client.options.version
        ));
    }
});
```

Add `const util = require('util');` at the top of client.js if not already imported.

### Backward Compatibility

This change is backward compatible:
- Consumers listening on `'ctcp request'` now also receive VERSION requests (previously invisible) — additive, not breaking
- VERSION auto-response still happens by default when `options.version` is set
- Middleware that doesn't filter CTCP sees no difference
- Middleware that DOES filter can now suppress VERSION (and the auto-response) by not calling `next()`

### How consumers use this for flood protection

```javascript
client.use(function(client, raw_middleware, parsed_middleware) {
    parsed_middleware.use(function(command, event, client, next) {
        // Suppress CTCP during flood
        if (command === 'ctcp request' && isCtcpBlocked(client)) {
            return; // Don't call next() — event AND auto-response both suppressed
        }
        next();
    });
});
```

## Testing

Write tests that verify:
1. VERSION CTCP emits `'ctcp request'` event with `type: 'VERSION'`
2. VERSION auto-response still fires when middleware calls `next()`
3. VERSION auto-response is suppressed when middleware does NOT call `next()`
4. Other CTCP types (PING, TIME) still work unchanged
5. ACTION still emits `'action'` (not `'ctcp request'`)
6. Non-CTCP PRIVMSG still emits `'privmsg'` (unchanged)

Follow existing test patterns in the repo (Mocha + Chai + Sinon).

## After the PR

If the PR is accepted upstream → we switch back to `irc-framework` from npm.

If not accepted or takes too long → we publish as a scoped fork (`@opentui/irc-framework`) or reference the GitHub fork directly in package.json:
```json
"irc-framework": "github:YOUR_USERNAME/irc-framework#feature/ctcp-event-consistency"
```

## Summary

Two files changed, ~15 lines modified. The change makes CTCP handling consistent (all types emit events) and moves the VERSION auto-response to after middleware, enabling flood protection without hacks.
