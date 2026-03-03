// Slap — the classic /slap command
// Copy to ~/.kokoirc/scripts/slap.ts

import type { KokoAPI } from "kokoirc/api"

export const meta = {
  name: "slap",
  version: "1.0.0",
  description: "Classic /slap command",
}

const objects = [
  "a large trout",
  "a mass of wet noodles",
  "a mass-produced Bible",
  "a mass-produced copy of Windows XP",
  "a mass-produced rainbow trout",
]

export default function init(api: KokoAPI) {
  api.command("slap", {
    handler(args, connId) {
      const target = args[0]
      if (!target) {
        api.ui.addLocalEvent(`%Zf7768eUsage: /slap <nick>%N`)
        return
      }
      const obj = objects[Math.floor(Math.random() * objects.length)]
      const conn = api.store.getConnection(connId)
      const buf = api.store.getActiveBufferId()
      if (!buf || !conn) return
      const buffer = api.store.getBuffer(buf)
      if (!buffer) return

      api.irc.action(buffer.name, `slaps ${target} around a bit with ${obj}`, connId)
      api.ui.addMessage(buf, {
        type: "action",
        nick: conn.nick,
        text: `slaps ${target} around a bit with ${obj}`,
        highlight: false,
      })
    },
    description: "Slap someone with a random object",
    usage: "/slap <nick>",
  })
}
