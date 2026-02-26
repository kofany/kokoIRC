import { useStore } from "@/core/state/store"
import { resolveAbstractions, parseFormatString, StyledText } from "@/core/theme"
import type { Message } from "@/types"

interface Props {
  message: Message
  isOwnNick: boolean
}

export function MessageLine({ message, isOwnNick }: Props) {
  const theme = useStore((s) => s.theme)
  const config = useStore((s) => s.config)
  const abstracts = theme?.abstracts ?? {}
  const messages: Record<string, string> = theme?.formats.messages ?? {}
  const events: Record<string, string> = theme?.formats.events ?? {}

  // Timestamp
  const ts = formatTimestamp(message.timestamp, config?.general.timestamp_format ?? "%H:%M:%S")
  const tsFormat = abstracts.timestamp ?? "$*"
  const tsResolved = resolveAbstractions(tsFormat, abstracts)
  const tsSpans = parseFormatString(tsResolved, [ts])

  if (message.type === "event") {
    const textSpans = parseFormatString("%w" + message.text + "%N", [])
    return (
      <box flexDirection="row" width="100%">
        <StyledText spans={tsSpans} />
        <text> </text>
        <StyledText spans={textSpans} />
      </box>
    )
  }

  // Message/action/notice
  const nickWidth = config?.display.nick_column_width ?? 8
  const alignment = config?.display.nick_alignment ?? "right"
  const nickMode = message.nickMode ?? ""
  const nick = message.nick ?? ""
  const displayNick = formatNick(nick, nickWidth, alignment, config?.display.nick_truncation ?? true, config?.display.nick_max_length ?? nickWidth)

  let msgFormatKey: string
  if (message.type === "action") {
    msgFormatKey = "action"
  } else if (isOwnNick) {
    msgFormatKey = "own_msg"
  } else if (message.highlight) {
    msgFormatKey = "pubmsg_mention"
  } else {
    msgFormatKey = "pubmsg"
  }

  const msgFormat = messages[msgFormatKey] ?? "$0 $1"
  const resolved = resolveAbstractions(msgFormat, abstracts)
  const spans = parseFormatString(resolved, [displayNick, message.text, nickMode])

  return (
    <box flexDirection="row" width="100%">
      <StyledText spans={tsSpans} />
      <text> </text>
      <StyledText spans={spans} />
    </box>
  )
}

function formatTimestamp(date: Date, format: string): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return format.replace("%H", h).replace("%M", m).replace("%S", s)
}

function formatNick(nick: string, width: number, align: string, truncate: boolean, maxLen: number): string {
  let display = nick
  if (truncate && display.length > maxLen) {
    display = display.slice(0, maxLen)
  }
  if (align === "right") return display.padStart(width)
  if (align === "center") {
    const pad = Math.max(0, width - display.length)
    const left = Math.floor(pad / 2)
    return " ".repeat(left) + display + " ".repeat(pad - left)
  }
  return display.padEnd(width)
}
