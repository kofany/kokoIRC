// Highlight Notify — beep and log when your nick is mentioned
// Copy to ~/.kokoirc/scripts/highlight-notify.ts
//
// Config in ~/.kokoirc/config.toml:
//   [scripts.highlight-notify]
//   beep = true
//   keywords = ["urgent", "deploy"]

import type { KokoAPI, IrcMessageEvent } from "kokoirc/api"

export const meta = {
  name: "highlight-notify",
  version: "1.0.0",
  description: "Beep and log on nick mentions and keywords",
}

export const config = {
  beep: true,
  keywords: [] as string[],
}

export default function init(api: KokoAPI) {
  function check(event: IrcMessageEvent) {
    const conn = api.store.getConnection(event.connectionId)
    if (!conn) return
    // Don't notify on own messages
    if (event.nick === conn.nick) return

    const lower = event.message.toLowerCase()
    const nickMention = lower.includes(conn.nick.toLowerCase())
    const keywords: string[] = api.config.get("keywords", [])
    const keywordMatch = keywords.some((kw) => lower.includes(kw.toLowerCase()))

    if (nickMention || keywordMatch) {
      const shouldBeep = api.config.get("beep", true)
      if (shouldBeep) {
        process.stdout.write("\x07") // BEL
      }
      api.log(`highlight from ${event.nick} in ${event.target}: ${event.message}`)
    }
  }

  // LOW priority — don't interfere with filters
  api.on("irc.privmsg", (data) => check(data), api.EventPriority.LOW)
  api.on("irc.action", (data) => check(data), api.EventPriority.LOW)
}
