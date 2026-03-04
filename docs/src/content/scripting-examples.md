# Scripting — Examples

Practical script examples showing common patterns: custom commands, event listeners, timers, and event filtering.

---

## Custom /slap command

The classic IRC `/slap` command, implemented as a script.

```typescript
import type { KokoAPI } from "kokoirc/api"

export const meta = {
  name: "slap",
  version: "1.0.0",
  description: "The classic /slap command",
}

export default function slap(api: KokoAPI) {
  api.command("slap", {
    handler: (args, connectionId) => {
      const target = args[0] ?? "everyone"
      const bufId = api.store.getActiveBufferId()
      if (!bufId) return
      const buf = api.store.getBuffer(bufId)
      if (!buf) return
      api.irc.action(buf.name,
        `slaps ${target} around a bit with a large trout`,
        connectionId)
    },
    description: "Slap someone with a large trout",
    usage: "/slap [nick]",
  })
}
```

---

## Auto-away

Automatically sets you as away after a period of inactivity. Demonstrates event listeners, timers, and per-script configuration.

```typescript
import type { KokoAPI } from "kokoirc/api"

export const meta = {
  name: "auto-away",
  version: "1.0.0",
  description: "Auto-away on idle",
}

export const config = {
  timeout: 300,
  message: "Auto-away",
}

export default function autoAway(api: KokoAPI) {
  const timeout = api.config.get("timeout", 300)
  const message = api.config.get("message", "Auto-away")

  let timer: ReturnType<typeof setTimeout> | null = null

  function resetTimer() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      // Send AWAY to all connections
      for (const [id] of api.store.getConnections()) {
        api.irc.raw(`AWAY :${message}`, id)
      }
    }, timeout * 1000)
  }

  // Reset the timer on any user input
  api.on("command_input", resetTimer)
  resetTimer()

  // Clean up the timer on unload
  return () => {
    if (timer) clearTimeout(timer)
  }
}
```

**User configuration** in `config.toml`:

```toml
[scripts.auto-away]
timeout = 600
message = "Gone fishing"
```

---

## Highlight notifications

Adds a local notification when your nick is mentioned. Shows how to listen to IRC message events and use the UI API.

```typescript
import type { KokoAPI, IrcMessageEvent } from "kokoirc/api"

export const meta = {
  name: "highlight-notify",
  version: "1.0.0",
  description: "Notify on highlights",
}

export default function highlights(api: KokoAPI) {
  api.on("irc.privmsg", (event: IrcMessageEvent) => {
    // Check if our nick is mentioned in the message
    const conns = api.store.getConnections()
    const conn = conns.get(event.connectionId)
    if (!conn) return

    const nickPattern = new RegExp(`\\b${conn.nick}\\b`, "i")
    if (event.isChannel && nickPattern.test(event.message)) {
      const bufId = api.ui.makeBufferId(event.connectionId, event.target)
      api.ui.addMessage(bufId, {
        type: "event",
        text: `*** Highlight from ${event.nick}: ${event.message}`,
        highlight: true,
      })
    }
  })
}
```

---

## Spam filter

Blocks messages matching configurable patterns. Demonstrates `ctx.stop()` to prevent messages from reaching the UI, and `api.EventPriority.HIGHEST` to run before all other handlers.

```typescript
import type { KokoAPI, IrcMessageEvent } from "kokoirc/api"

export const meta = {
  name: "spam-filter",
  version: "1.0.0",
  description: "Filter spam messages",
}

export const config = {
  patterns: ["buy now", "free bitcoin"],
}

export default function spamFilter(api: KokoAPI) {
  const patterns = api.config
    .get("patterns", ["buy now", "free bitcoin"])
    .map((p: string) => new RegExp(p, "i"))

  api.on(
    "irc.privmsg",
    (event: IrcMessageEvent, ctx) => {
      if (patterns.some((p) => p.test(event.message))) {
        ctx.stop() // Prevents the message from reaching the UI
        api.log(`Blocked spam from ${event.nick}: ${event.message}`)
      }
    },
    api.EventPriority.HIGHEST, // Run before everything else
  )
}
```

**User configuration** in `config.toml`:

```toml
[scripts.spam-filter]
patterns = ["buy now", "free bitcoin", "check out my"]
```

---

## URL title fetcher

Fetches the `<title>` of URLs posted in channels. Shows async work inside event handlers and using `api.timeout()` for debouncing.

```typescript
import type { KokoAPI, IrcMessageEvent } from "kokoirc/api"

export const meta = {
  name: "url-title",
  version: "1.0.0",
  description: "Fetch and display URL titles",
}

const URL_RE = /https?:\/\/[^\s]+/g

export default function urlTitle(api: KokoAPI) {
  api.on("irc.privmsg", async (event: IrcMessageEvent) => {
    if (!event.isChannel) return

    const urls = event.message.match(URL_RE)
    if (!urls) return

    for (const url of urls.slice(0, 3)) {
      try {
        const res = await fetch(url, {
          redirect: "follow",
          signal: AbortSignal.timeout(5000),
        })
        const html = await res.text()
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        if (match) {
          const title = match[1].trim()
          const bufId = api.ui.makeBufferId(
            event.connectionId, event.target)
          api.ui.addMessage(bufId, {
            type: "event",
            text: `[URL] ${title}`,
            highlight: false,
          })
        }
      } catch {
        // Ignore fetch errors
      }
    }
  }, api.EventPriority.LOW) // Run after normal handlers
}
```

---

## Tips

- **Cleanup**: Always return a cleanup function if you create resources outside the API (WebSocket connections, file handles, etc.). Event handlers, commands, and timers registered through `api.*` are cleaned up automatically.
- **connectionId**: All `api.irc.*` methods accept an optional `connectionId` as the last parameter. If omitted, they use the active buffer's connection. Pass it explicitly when handling events to target the correct server.
- **Stopping events**: `ctx.stop()` must be called synchronously. If you need to do async work (fetch, timers), decide whether to stop the event *before* any `await`.
- **Debug logging**: Use `api.log()` instead of `console.log()` so output respects the `scripts.debug` config flag.
