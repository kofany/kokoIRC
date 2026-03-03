// Auto-Away — automatically sets you away after idle timeout
// Copy to ~/.kokoirc/scripts/auto-away.ts
//
// Config in ~/.kokoirc/config.toml:
//   [scripts.auto-away]
//   timeout = 300
//   message = "Auto-away"

import type { KokoAPI } from "@/core/scripts/types"

export const meta = {
  name: "auto-away",
  version: "1.0.0",
  description: "Automatically sets away after idle timeout",
}

export const config = {
  timeout: 300,      // seconds
  message: "Auto-away",
}

export default function init(api: KokoAPI) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let isAway = false

  function resetTimer() {
    if (timer) clearTimeout(timer)
    const timeout = api.config.get("timeout", 300) * 1000
    timer = setTimeout(goAway, timeout)

    // If we were auto-away, come back
    if (isAway) {
      isAway = false
      api.irc.raw("AWAY")
      api.log("back from auto-away")
    }
  }

  function goAway() {
    const message = api.config.get("message", "Auto-away")
    api.irc.raw(`AWAY :${message}`)
    isAway = true
    api.log(`auto-away: ${message}`)
  }

  // Reset idle timer on outgoing messages and commands
  api.on("irc.privmsg", resetTimer)
  api.on("irc.action", resetTimer)
  api.on("command_input", resetTimer)

  // /autoaway command to check/set timeout
  api.command("autoaway", {
    handler(args) {
      if (args[0]) {
        const seconds = parseInt(args[0], 10)
        if (isNaN(seconds) || seconds < 0) {
          api.ui.addLocalEvent(`%Zf7768eUsage: /autoaway [seconds]%N`)
          return
        }
        api.config.set("timeout", seconds)
        api.ui.addLocalEvent(`%Z9ece6aAuto-away timeout set to ${seconds}s%N`)
        resetTimer()
      } else {
        const timeout = api.config.get("timeout", 300)
        const status = isAway ? "%Ze0af68away%N" : "%Z9ece6aactive%N"
        api.ui.addLocalEvent(`%Z565f89Auto-away: timeout=${timeout}s, status=${status}%N`)
      }
    },
    description: "Set auto-away timeout (seconds)",
    usage: "/autoaway [seconds]",
  })

  // Start the timer
  resetTimer()

  // Cleanup
  return () => {
    if (timer) clearTimeout(timer)
    if (isAway) api.irc.raw("AWAY")
  }
}
