# Scripting — API Reference

Complete reference for the `KokoAPI` object passed to every script's `init` function.

```typescript
export default function init(api: KokoAPI) {
  // api.on, api.irc, api.store, etc.
}
```

---

## Events

### `api.on(event, handler, priority?)`

Register an event handler. Returns an unsubscribe function.

```typescript
const unsub = api.on("irc.privmsg", (event, ctx) => {
  // handle message
})

// Later, to remove:
unsub()
```

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `event` | `string` | Event name (see event list below) |
| `handler` | `(data: any, ctx: EventContext) => void` | Handler function |
| `priority` | `number` | Optional. Default: `EventPriority.NORMAL` (50) |

Handlers run in descending priority order. Handlers registered through the API are automatically removed when the script is unloaded.

### `api.once(event, handler, priority?)`

Same as `api.on()` but the handler fires only once, then removes itself.

### `api.emit(event, data?)`

Emit a custom event. The event name is automatically prefixed with `script.` to avoid collisions with built-in events. Returns `false` if a handler called `stop()`.

```typescript
api.emit("my-event", { foo: "bar" })
// Other scripts can listen with: api.on("script.my-event", handler)
```

### `api.EventPriority`

Priority constants for event handler ordering:

| Constant | Value | Use case |
|---|---|---|
| `HIGHEST` | 100 | Filters, spam blockers — run first |
| `HIGH` | 75 | Pre-processing |
| `NORMAL` | 50 | Default for most handlers |
| `LOW` | 25 | Post-processing |
| `LOWEST` | 0 | Logging, analytics — run last |

### EventContext

The second argument to every event handler:

```typescript
api.on("irc.privmsg", (event, ctx) => {
  ctx.stop()    // Prevent lower-priority handlers AND the built-in
                // store update from running
  ctx.stopped   // boolean — whether stop() has been called
})
```

`ctx.stop()` must be called **synchronously** (before any `await`). When a handler stops an event, the built-in kokoIRC handler that would normally update the store (add the message to the buffer, update nick lists, etc.) is skipped entirely.

---

## IRC Events

These events fire when the IRC server sends data. Each event can be intercepted — if a handler calls `ctx.stop()`, the default store update is suppressed.

### `irc.privmsg`

A channel or private message.

```typescript
interface IrcMessageEvent {
  connectionId: string
  nick: string
  ident?: string
  hostname?: string
  target: string       // channel name or your nick (for PMs)
  message: string      // raw message text
  tags?: Record<string, string>
  time?: string        // server-time tag
  isChannel: boolean   // true if target is a channel
}
```

### `irc.action`

A CTCP ACTION (`/me` message). Same payload as `irc.privmsg`.

### `irc.notice`

```typescript
interface IrcNoticeEvent {
  connectionId: string
  nick?: string        // undefined for server notices
  target?: string
  message: string
  from_server?: boolean
}
```

### `irc.join`

```typescript
interface IrcJoinEvent {
  connectionId: string
  nick: string
  ident?: string
  hostname?: string
  channel: string
  account?: string     // IRCv3 account-notify
}
```

### `irc.part`

```typescript
interface IrcPartEvent {
  connectionId: string
  nick: string
  ident?: string
  hostname?: string
  channel: string
  message?: string     // part reason
}
```

### `irc.quit`

```typescript
interface IrcQuitEvent {
  connectionId: string
  nick: string
  ident?: string
  hostname?: string
  message?: string     // quit reason
}
```

### `irc.kick`

```typescript
interface IrcKickEvent {
  connectionId: string
  nick: string         // who kicked
  ident?: string
  hostname?: string
  channel: string
  kicked: string       // who was kicked
  message?: string     // kick reason
}
```

### `irc.nick`

```typescript
interface IrcNickEvent {
  connectionId: string
  nick: string         // old nick
  new_nick: string     // new nick
  ident?: string
  hostname?: string
}
```

### `irc.topic`

```typescript
interface IrcTopicEvent {
  connectionId: string
  nick?: string        // who changed it (undefined for initial topic)
  channel: string
  topic: string
}
```

### `irc.mode`

```typescript
interface IrcModeEvent {
  connectionId: string
  nick?: string        // who set the mode
  target: string       // channel or nick
  modes: Array<{ mode: string; param?: string }>
}
```

### `irc.invite`

```typescript
interface IrcInviteEvent {
  connectionId: string
  nick: string         // who invited you
  channel: string
}
```

### `irc.ctcp_request`

```typescript
interface IrcCtcpEvent {
  connectionId: string
  nick: string
  type: string         // e.g. "PING", "TIME"
  message?: string
}
```

### `irc.ctcp_response`

Same shape as `irc.ctcp_request`.

### `irc.wallops`

```typescript
interface IrcWallopsEvent {
  connectionId: string
  nick?: string
  message: string
  from_server?: boolean
}
```

---

## App Events

These events are emitted by kokoIRC itself, not the IRC protocol.

### `command_input`

Fired before a command is executed. Call `ctx.stop()` to prevent the command from running.

```typescript
interface CommandInputEvent {
  command: string      // command name without "/"
  args: string[]
  connectionId: string
}
```

### `connected`

```typescript
interface ConnectedEvent {
  connectionId: string
  nick: string
}
```

### `disconnected`

```typescript
interface DisconnectedEvent {
  connectionId: string
}
```

---

## Commands

### `api.command(name, def)`

Register a custom slash command. The command is available as `/name` in the input bar.

```typescript
api.command("greet", {
  handler: (args, connectionId) => {
    const target = args[0] ?? "world"
    api.irc.say(target, `Hello, ${target}!`, connectionId)
  },
  description: "Send a greeting",
  usage: "/greet <nick>",
})
```

**`ScriptCommandDef`:**

| Field | Type | Description |
|---|---|---|
| `handler` | `(args: string[], connectionId: string) => void` | Command handler |
| `description` | `string` | Shown in `/help` |
| `usage` | `string?` | Usage string (optional) |

### `api.removeCommand(name)`

Remove a command registered by this script.

---

## IRC Methods

All IRC methods take an optional `connectionId` as the **last** parameter. If omitted, the active buffer's connection is used.

### `api.irc.say(target, message, connectionId?)`

Send a PRIVMSG to a channel or nick.

### `api.irc.action(target, message, connectionId?)`

Send a CTCP ACTION (`/me`).

### `api.irc.notice(target, message, connectionId?)`

Send a NOTICE.

### `api.irc.join(channel, key?, connectionId?)`

Join a channel, optionally with a key.

### `api.irc.part(channel, message?, connectionId?)`

Leave a channel with an optional part message.

### `api.irc.raw(line, connectionId?)`

Send a raw IRC protocol line.

```typescript
api.irc.raw("AWAY :Gone fishing")
api.irc.raw("AWAY :Gone fishing", "myserver")
```

### `api.irc.changeNick(nick, connectionId?)`

Change your nickname.

### `api.irc.whois(nick, connectionId?)`

Send a WHOIS query.

### `api.irc.getClient(connectionId?)`

Get the underlying IRC framework `Client` object for advanced use. Returns `undefined` if the connection doesn't exist.

---

## UI Methods

### `api.ui.addLocalEvent(text)`

Add a local event message to the **active** buffer. These are informational messages visible only to the user (not sent over IRC).

```typescript
api.ui.addLocalEvent("Script loaded successfully")
```

### `api.ui.addMessage(bufferId, message)`

Add a message to a specific buffer. The `id` and `timestamp` fields are set automatically.

```typescript
api.ui.addMessage(bufferId, {
  type: "event",
  text: "Something happened",
  highlight: false,
})
```

### `api.ui.switchBuffer(bufferId)`

Switch the active buffer.

### `api.ui.makeBufferId(connectionId, name)`

Generate a buffer ID from a connection ID and buffer name (channel or nick).

```typescript
const bufId = api.ui.makeBufferId("myserver", "#channel")
api.ui.switchBuffer(bufId)
```

---

## Store

### `api.store`

Read-only access to the Zustand store. Available methods:

| Method | Returns |
|---|---|
| `getConnections()` | `Map<string, Connection>` |
| `getBuffers()` | `Map<string, Buffer>` |
| `getActiveBufferId()` | `string \| null` |
| `getConfig()` | `AppConfig \| null` |
| `getConnection(id)` | `Connection \| undefined` |
| `getBuffer(id)` | `Buffer \| undefined` |
| `subscribe(listener)` | `() => void` (unsubscribe) |

```typescript
const conns = api.store.getConnections()
for (const [id, conn] of conns) {
  api.log(`Connected to ${conn.host} as ${conn.nick}`)
}
```

---

## Config

### `api.config.get(key, defaultValue)`

Get a per-script config value. Lookup order: user TOML override > script `config` export > `defaultValue`.

### `api.config.set(key, value)`

Set a per-script config value at runtime. This updates the in-memory config (not the TOML file).

---

## Timers

### `api.timer(ms, handler)`

Set a repeating interval. Returns a `TimerHandle` with a `clear()` method. Automatically cleared on script unload.

```typescript
const ping = api.timer(60_000, () => {
  api.log("One minute has passed")
})

// Later:
ping.clear()
```

### `api.timeout(ms, handler)`

Set a one-shot timeout. Returns a `TimerHandle`. Automatically cleared on script unload.

---

## Logging

### `api.log(...args)`

Log a message to the console. Only outputs when `scripts.debug = true` in `config.toml`. Messages are prefixed with `[script:<name>]`.

```toml
[scripts]
debug = true
```

```typescript
api.log("Processing message from", event.nick)
// Console: [script:my-script] Processing message from Alice
```
