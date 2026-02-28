import { useStore } from "@/core/state/store"
import type { IgnoreLevel, IgnoreEntry } from "@/types/config"
import type { Client } from "irc-framework"

// ─── Wildcard matching ───────────────────────────────────────

/** Convert a simple wildcard pattern (*, ?) to a RegExp. */
function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
  const withWildcards = escaped.replace(/\*/g, ".*").replace(/\?/g, ".")
  return new RegExp(`^${withWildcards}$`, "i")
}

// ─── Public helpers ──────────────────────────────────────────

/** Build a nick!user@host mask from event data. */
export function buildMask(nick: string, ident?: string, hostname?: string): string {
  return `${nick}!${ident || "*"}@${hostname || "*"}`
}

/** Check if an event from this user/level/channel should be ignored. */
export function shouldIgnore(
  nick: string,
  ident: string | undefined,
  hostname: string | undefined,
  level: IgnoreLevel,
  channel?: string,
): boolean {
  const ignores = useStore.getState().config?.ignores
  if (!ignores?.length) return false

  const fullMask = buildMask(nick, ident, hostname)

  for (const entry of ignores) {
    // Level check
    if (!entry.levels.includes("ALL") && !entry.levels.includes(level)) continue

    // Pattern check: bare nick vs full mask
    if (entry.mask.includes("!")) {
      if (!wildcardToRegex(entry.mask).test(fullMask)) continue
    } else {
      if (!wildcardToRegex(entry.mask).test(nick)) continue
    }

    // Channel restriction
    if (entry.channels?.length) {
      if (!channel || !entry.channels.some((ch) => ch.toLowerCase() === channel.toLowerCase())) continue
    }

    return true
  }

  return false
}

// ─── Parsed middleware (privmsg, action, notice, ctcp) ───────

function isChannel(target: string): boolean {
  return target.startsWith("#") || target.startsWith("&") || target.startsWith("+") || target.startsWith("!")
}

export function createIgnoreMiddleware() {
  return function middlewareInstaller(_client: Client, _rawEvents: any, parsedEvents: any) {
    parsedEvents.use(function ignoreHandler(command: string, event: any, _c: Client, next: () => void) {
      const nick: string = event.nick || ""
      const ident: string = event.ident || ""
      const hostname: string = event.hostname || ""
      const target: string = event.target || ""

      if (command === "privmsg") {
        const level: IgnoreLevel = isChannel(target) ? "PUBLIC" : "MSGS"
        if (shouldIgnore(nick, ident, hostname, level, isChannel(target) ? target : undefined)) return
      } else if (command === "action") {
        if (shouldIgnore(nick, ident, hostname, "ACTIONS", isChannel(target) ? target : undefined)) return
      } else if (command === "notice") {
        if (shouldIgnore(nick, ident, hostname, "NOTICES", isChannel(target) ? target : undefined)) return
      } else if (command === "ctcp request" || command === "ctcp response") {
        if (shouldIgnore(nick, ident, hostname, "CTCPS")) return
      }

      next()
    })
  }
}
