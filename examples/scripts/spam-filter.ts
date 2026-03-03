// Spam Filter — block repeated messages from the same nick
// Copy to ~/.kokoirc/scripts/spam-filter.ts
//
// Config in ~/.kokoirc/config.toml:
//   [scripts.spam-filter]
//   threshold = 3
//   window = 10
//   notify = true

import type { KokoAPI, IrcMessageEvent } from "@/core/scripts/types"

export const meta = {
  name: "spam-filter",
  version: "1.0.0",
  description: "Block repeated messages from the same nick",
}

export const config = {
  threshold: 3,   // messages within window to trigger
  window: 10,     // seconds
  notify: true,   // show blocked notification
}

export default function init(api: KokoAPI) {
  // Track: nick -> list of timestamps
  const history = new Map<string, number[]>()

  api.on("irc.privmsg", (event: IrcMessageEvent, ctx) => {
    if (!event.isChannel) return // only filter channel messages

    const conn = api.store.getConnection(event.connectionId)
    if (event.nick === conn?.nick) return // don't filter own messages

    const key = `${event.connectionId}:${event.nick}`
    const now = Date.now()
    const windowMs = api.config.get("window", 10) * 1000
    const threshold = api.config.get("threshold", 3)

    // Get or create history for this nick
    let timestamps = history.get(key)
    if (!timestamps) {
      timestamps = []
      history.set(key, timestamps)
    }

    // Prune old entries
    const cutoff = now - windowMs
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift()
    }

    timestamps.push(now)

    if (timestamps.length >= threshold) {
      ctx.stop() // block the message from reaching the store

      if (api.config.get("notify", true)) {
        api.ui.addLocalEvent(
          `%Ze0af68[spam-filter]%N Blocked message from %Zc0caf5${event.nick}%N %Z565f89(${timestamps.length} msgs in ${api.config.get("window", 10)}s)%N`
        )
      }
      api.log(`blocked ${event.nick} in ${event.target}: ${event.message}`)
    }
  }, api.EventPriority.HIGHEST)

  // Clean up stale entries periodically
  const cleanupTimer = api.timer(60_000, () => {
    const cutoff = Date.now() - 60_000
    for (const [key, timestamps] of history) {
      const fresh = timestamps.filter((t) => t >= cutoff)
      if (fresh.length === 0) {
        history.delete(key)
      } else {
        history.set(key, fresh)
      }
    }
  })

  return () => {
    cleanupTimer.clear()
    history.clear()
  }
}
