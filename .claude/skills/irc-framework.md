---
name: irc-framework
description: Complete irc-framework API reference — client methods, all events with payloads, IRCv3 capabilities, and middleware. Use when working with IRC client code, events, commands, or protocol features.
---

# irc-framework — Full API Reference

Based on [kiwiirc/irc-framework](https://github.com/kiwiirc/irc-framework). This is the IRC client library used by kIRC.

---

## Client Constructor & Options

```js
new Irc.Client({
    nick: 'ircbot',
    username: 'ircbot',
    gecos: 'ircbot',
    encoding: 'utf8',
    version: 'node.js irc-framework',  // null to handle VERSION CTCP manually
    enable_chghost: false,              // enable CHGHOST cap
    enable_echomessage: false,          // enable echo-message cap
    auto_reconnect: true,
    auto_reconnect_max_wait: 300000,
    auto_reconnect_max_retries: 3,
    ping_interval: 30,
    ping_timeout: 120,
    sasl_disconnect_on_fail: false,
    account: {                          // SASL auth — falsy = use nick+password, {} = disable SASL
        account: 'username',
        password: 'account_password',
    },
    webirc: { password, username, hostname, ip, options },
    client_certificate: { private_key, certificate },
})
```

---

## Client Properties

| Property | Description |
|----------|-------------|
| `.connected` | Boolean — registered on the network |
| `.user.nick` | Current nick |
| `.user.username` | Current ident |
| `.user.gecos` | Current realname |
| `.user.host` | Current hostname (on supporting servers) |
| `.user.away` | Away status string (empty = not away) |
| `.user.modes` | `Set()` of current user modes |

---

## Client Methods

### Connection
| Method | Description |
|--------|-------------|
| `.connect([options])` | Connect to IRC. Options override constructor. Supports `path` for Unix sockets. |
| `.quit([message])` | Quit with optional message |
| `.ping([message])` | Ping the server |
| `.raw(raw_line)` | Send raw IRC line |
| `.rawString('JOIN', '#chan')` | Generate formatted raw line (args or array) |
| `.requestCap('cap_name')` | Request extra IRCv3 capability |
| `.use(middleware_fn())` | Add middleware |

### Messaging
| Method | Description |
|--------|-------------|
| `.say(target, message [, tags])` | Send PRIVMSG |
| `.notice(target, message [, tags])` | Send NOTICE |
| `.action(target, message)` | Send ACTION (/me) |
| `.tagmsg(target, tags)` | Send tagged message (no content) |
| `.ctcpRequest(target, type [, ...params])` | Send CTCP request |
| `.ctcpResponse(target, type [, ...params])` | Send CTCP response |

### Channels
| Method | Description |
|--------|-------------|
| `.join(channel [, key])` | Join channel |
| `.part(channel [, message])` | Part channel |
| `.setTopic(channel, topic)` | Set topic (falsy/whitespace → clearTopic) |
| `.clearTopic(channel)` | Remove topic |
| `.channel(name [, key])` | Get channel object with `.say()`, `.notice()`, `.action()`, `.part()`, `.join()` |

### Users
| Method | Description |
|--------|-------------|
| `.changeNick(nick)` | Change nick |
| `.whois(nick [, cb])` | WHOIS query. `cb(event)` optional. |
| `.who(target [, cb])` | WHO query (queued, runs one at a time) |
| `.list([...params])` | Request channel list |

### MONITOR
| Method | Description |
|--------|-------------|
| `.addMonitor(target)` | Add nick(s) to monitor (comma-separated) |
| `.removeMonitor(target)` | Remove from monitor |
| `.clearMonitor()` | Clear monitor list |
| `.monitorlist([cb])` | Get monitored list |
| `.queryMonitor()` | Query → emits `users online` / `users offline` |

### String Utils
| Method | Description |
|--------|-------------|
| `.caseCompare(a, b)` | Compare using network casemapping |
| `.caseUpper(str)` | Uppercase using network casemapping |
| `.caseLower(str)` | Lowercase using network casemapping |

### Pattern Matching
| Method | Description |
|--------|-------------|
| `.match(regex, cb [, type])` | Call cb on matching incoming messages |
| `.matchNotice(regex, cb)` | Match notices |
| `.matchMessage(regex, cb)` | Match privmsgs |
| `.matchAction(regex, cb)` | Match actions |

---

## Events — Complete Reference

### Registration & Connection

#### `registered` / `connected`
Fired after successful registration. Good place to join channels.
```js
{ nick: 'prawnsalad' }
```

#### `reconnecting`
Auto-reconnect triggered.
```js
{ attempt: 1, max_retries: 3 }
```

#### `close`
Disconnected and auto-reconnect failed/disabled.

#### `socket connected`
Socket connected, registration starting.

#### `socket close`
Socket disconnected.

#### `raw socket connected`
Raw TCP connected (before TLS handshake). Good for identd.

#### `server options`
```js
{ options: { ... }, cap: { ... } }
```

---

### Raw / Debug

#### `raw`
Every raw line sent/received.
```js
{ line: ':server 265 nick :Current Local Users: 214', from_server: true }
```

#### `unknown command`
Unhandled IRC numerics/commands. **IMPORTANT: Numerics handled by irc-framework (like 324, 332, 353) do NOT emit this event.**
```js
{ command: '250', params: ['nick', 'text...'], tags: {}, prefix: 'server', nick: '', ident: '', hostname: 'server' }
```

#### `debug`
Debug strings (e.g., `'Socket fully connected'`).

---

### Channel Events

#### `channel info`
Emitted for RPL_CHANNELMODEIS (324), RPL_CREATIONTIME (329), RPL_CHANNEL_URL (328).

**324 — Channel modes:**
```js
{ channel: '#chan', modes: [{ mode: '+n', param: '' }, { mode: '+l', param: '50' }], raw_modes: '+nl', raw_params: ['50'], tags: {} }
```

**329 — Creation time:**
```js
{ channel: '#chan', created_at: 1234567890, tags: {} }
```

**328 — Channel URL:**
```js
{ channel: '#chan', url: 'http://...', tags: {} }
```

#### `channel list start` / `channel list` / `channel list end`
```js
// channel list:
[{ channel: '#chan', num_users: 123, topic: 'My topic', tags: {} }, ...]
```

#### `userlist`
RPL_NAMREPLY — user list for a channel.
```js
{ channel: '#chan', users: [{ nick, modes: ['o','v'], ident, hostname, ... }], tags: {} }
```

#### `wholist`
WHO response.
```js
{ target: '#chan', users: [...], tags: {} }
```

#### `banlist`
```js
{ channel: '#chan', bans: [{ banned: '*!*@host', banned_by: 'nick', banned_at: timestamp }], tags: {} }
```

#### `invitelist` / `exceptlist`
```js
{ channel: '#chan', invites/excepts: [...], tags: {} }
```

#### `topic`
```js
{ channel: '#chan', topic: 'The topic', nick: 'setter', time: timestamp }
```

#### `topicsetby`
```js
{ nick, ident, hostname, channel: '#chan', when: timestamp }
```

---

### Join / Part / Quit / Kick

#### `join`
```js
{ nick, ident, hostname, gecos, channel: '#chan', time, account: 'acct_name' }
```

#### `part`
```js
{ nick, ident, hostname, channel: '#chan', message: 'part msg', time }
```

#### `quit`
```js
{ nick, ident, hostname, message: 'quit msg', time }
```

#### `kick`
```js
{ kicked: 'target', nick: 'kicker', ident, hostname, channel: '#chan', message: 'reason', time }
```

#### `invited`
```js
{ nick: 'inviteduser', channel: '#chan' }
```

---

### Messaging Events

#### `privmsg`
Also triggers `message` with `.type = 'privmsg'`.
```js
{ nick, ident, hostname, target: '#chan', message: 'Hello', tags: {}, time, account }
```

#### `notice`
Also triggers `message` with `.type = 'notice'`. `from_server` = true if from server.
```js
{ from_server: false, nick, ident, hostname, target: '#chan', group: '@', message: 'text', tags: {}, time, account }
```

#### `action`
Also triggers `message` with `.type = 'action'`.
```js
{ nick, ident, hostname, target: '#chan', message: 'slaps someone', tags: {}, time, account }
```

#### `tagmsg`
```js
{ nick, ident, hostname, target: '#chan', tags: { example: 'hello' }, time, account }
```

#### `wallops`
```js
{ from_server: false, nick, ident, hostname, message: 'server-wide msg', account }
```

#### `ctcp request`
VERSION CTCP handled internally unless `version: null`.
```js
{ nick, ident, hostname, target, type: 'VERSION', message: 'VERSION text', time, account }
```

#### `ctcp response`
```js
{ nick, ident, hostname, target, message: 'VERSION kiwiirc', time, account }
```

---

### User Events

#### `nick`
```js
{ nick: 'old', ident, hostname, new_nick: 'new', time }
```

#### `account`
`account` is `false` if logged out.
```js
{ nick, ident, hostname, account: 'acct_name', time }
```

#### `user info`
RPL_UMODEIS — sent on connect or `MODE <nick>`.
```js
{ nick, raw_modes: '+Ri', tags: {} }
```

#### `away`
`self: true` if response to own away command.
```js
{ self: false, nick, message: 'away reason', time }
```

#### `back`
```js
{ self: false, nick, message: 'You are now back', time }
```

#### `nick in use`
```js
{ nick: 'attempted_nick', reason: 'That nickname is already in use' }
```

#### `nick invalid`
```js
{ nick: 'bad@nick', reason: 'That is an invalid nick' }
```

#### `user updated`
CHGHOST — only when `enable_chghost: true`.
```js
{ nick, ident: 'old_ident', hostname: 'old_host', new_ident, new_hostname, time }
```

#### `whois`
Not all fields always present.
```js
{
    nick, ident, hostname, actual_ip, actual_hostname,
    real_name, helpop, bot, server, server_info, operator,
    channels, modes, idle, logon, registered_nick, account,
    secure, special, away, error
}
```

#### `whowas`
Latest data at root for backwards compat. `whowas` array has all entries (newest first). `error: 'no_such_nick'` if not found.
```js
{
    nick, ident, hostname, actual_ip, actual_hostname, actual_username,
    real_name, server, server_info, account, error,
    whowas: [{ ... }, { ... }]
}
```

---

### MONITOR Events

#### `monitorlist`
```js
{ nicks: ['nick1', 'nick2'] }
```

#### `users online` / `users offline`
```js
{ nicks: ['nick1', 'nick2'] }
```

---

### Misc Events

#### `motd`
```js
{ motd: 'full motd text with newlines', tags: {} }
```

#### `info`
```js
{ info: 'RPL_INFO text', tags: {} }
```

#### `help`
```js
{ help: 'RPL_HELPTXT text', tags: {} }
```

#### `batch start` / `batch end`
A `batch start <type>` and `batch end <type>` event is also triggered.
```js
{ id: 1, type: 'chathistory', params: [], commands: [] }
```

#### `cap ls` / `cap ack` / `cap nak` / `cap list` / `cap new` / `cap del`
```js
{ command: 'LS', capabilities: { 'sts': 'port=6697' } }
```

---

### SASL Events

#### `loggedin` / `loggedout`
```js
{ nick, ident, hostname, account, time, tags: {} }
```

#### `sasl failed`
Reasons: `fail`, `too_long`, `nick_locked`, `unsupported_mechanism`, `capability_missing`.
```js
{ reason: 'fail', message: 'SASL authentication failed', nick, time, tags: {} }
```

---

## IRCv3 Capabilities Supported

### IRCv3.1
- CAP negotiation
- SASL authentication
- multi-prefix
- account-notify
- away-notify
- extended-join

### IRCv3.2
- CAP negotiation (v3.2)
- account-tag
- batch
- chghost (requires `enable_chghost: true`)
- echo-message (requires `enable_echomessage: true`)
- invite-notify
- SASL (v3.2)
- server-time
- userhost-in-names
- message-tags

### Important Notes
- **chghost**: Must set `enable_chghost: true`. Emits `user updated` when nick's ident/host changes.
- **echo-message**: Must set `enable_echomessage: true`. Own messages echoed back by server. IRCv3 labelled replies not yet supported.

---

## Middleware

```js
function MyMiddleware() {
    return function(client, raw_events, parsed_events) {
        parsed_events.use(theMiddleware);
    }

    function theMiddleware(command, event, client, next) {
        if (command === 'registered') {
            // handle event
        }
        next();
    }
}

// Usage:
client.use(MyMiddleware());
```

---

## Key Gotchas for kIRC Development

1. **Numeric 324 (RPL_CHANNELMODEIS)** → emits `channel info`, NOT `unknown command`
2. **Numeric 332/333 (topic)** → emits `topic` / `topicsetby`, NOT `unknown command`
3. **Numeric 353 (NAMES)** → emits `userlist`, NOT `unknown command`
4. **`unknown command`** only fires for numerics WITHOUT a dedicated handler
5. **All events with user context** include `ident` and `hostname` (join, part, quit, kick, privmsg, notice, action, nick, etc.)
6. **`channel info`** fires for THREE different numerics (324, 329, 328) — check which fields exist
7. **CTCP VERSION** is handled internally unless `version: null` in options
8. **`.who()` calls are queued** and execute one at a time
9. **`.whois(nick, cb)`** callback is optional — event always fires either way
10. **Mode objects** in events: `{ mode: '+o', param: 'nick' }` — always check `param` for modes with parameters (o, v, l, k, b, etc.)
