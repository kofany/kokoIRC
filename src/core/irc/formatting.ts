import type { ModeEvent } from "irc-framework"
import type { Buffer } from "@/types"

/** Format seconds into human-readable duration (e.g. "2d 5h 30m"). */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (mins > 0) parts.push(`${mins}m`)
  if (secs > 0 && days === 0) parts.push(`${secs}s`)
  return parts.join(" ")
}

/** Format a Date to "YYYY-MM-DD HH:MM:SS". */
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const h = String(date.getHours()).padStart(2, "0")
  const mi = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`
}

/** Format a timestamp with a simple %H:%M:%S template. */
export function formatTimestamp(date: Date, format: string): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return format.replace("%H", h).replace("%M", m).replace("%S", s)
}

/** Reconstruct a displayable mode string from irc-framework mode event. */
export function buildModeString(event: ModeEvent): string {
  if (event.raw_modes) {
    const params = event.raw_params ?? []
    return event.raw_modes + (params.length > 0 ? " " + params.join(" ") : "")
  }
  if (!Array.isArray(event.modes)) return String(event.modes ?? "")

  let modeChars = ""
  const params: string[] = []
  let lastSign = ""

  for (const m of event.modes) {
    const sign = m.mode[0]
    const char = m.mode.slice(1)
    if (sign !== lastSign) {
      modeChars += sign
      lastSign = sign
    }
    modeChars += char
    if (m.param) params.push(m.param)
  }

  return modeChars + (params.length > 0 ? " " + params.join(" ") : "")
}

/**
 * Build a map from mode char → prefix symbol using ISUPPORT PREFIX.
 * e.g., "(ov)@+" → { o: "@", v: "+" }
 * Also maps prefix symbols to themselves so both formats work.
 */
export function buildPrefixMap(isupportPrefix: unknown): Record<string, string> {
  const map: Record<string, string> = {}
  if (typeof isupportPrefix !== "string") {
    // Default fallback mapping
    map["o"] = "@"; map["v"] = "+"; map["h"] = "%"
    map["a"] = "&"; map["q"] = "~"
    map["@"] = "@"; map["+"] = "+"; map["%"] = "%"
    map["&"] = "&"; map["~"] = "~"
    return map
  }
  const match = isupportPrefix.match(/^\(([^)]+)\)(.+)$/)
  if (!match) return map
  const modes = match[1]
  const prefixes = match[2]
  for (let i = 0; i < modes.length && i < prefixes.length; i++) {
    map[modes[i]] = prefixes[i]
    map[prefixes[i]] = prefixes[i] // identity mapping for prefix symbols
  }
  return map
}

/** Get the prefix mode character for a nick in a buffer. */
export function getNickMode(buffers: Map<string, Buffer>, bufferId: string, nick: string): string {
  const buf = buffers.get(bufferId)
  return buf?.users.get(nick)?.prefix ?? ""
}
