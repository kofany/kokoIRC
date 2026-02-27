import { useStore } from "@/core/state/store"
import { resolveAbstractions, parseFormatString } from "@/core/theme"
import type { Message } from "@/types"
import type { StyledSpan } from "@/types/theme"

interface Props {
  message: Message
  isOwnNick: boolean
}

export function MessageLine({ message, isOwnNick }: Props) {
  const theme = useStore((s) => s.theme)
  const config = useStore((s) => s.config)
  const abstracts = theme?.abstracts ?? {}
  const messages: Record<string, string> = theme?.formats.messages ?? {}

  // Timestamp
  const ts = formatTimestamp(message.timestamp, config?.general.timestamp_format ?? "%H:%M:%S")
  const tsFormat = abstracts.timestamp ?? "$*"
  const tsResolved = resolveAbstractions(tsFormat, abstracts)
  const tsSpans = parseFormatString(tsResolved, [ts])

  let msgSpans: StyledSpan[]

  if (message.type === "event") {
    const events = theme?.formats.events ?? {}
    if (message.eventKey && events[message.eventKey]) {
      const format = events[message.eventKey]
      const resolved = resolveAbstractions(format, abstracts)
      msgSpans = parseFormatString(resolved, message.eventParams ?? [])
    } else {
      // System events (whois, help, status) — text may contain inline %Z codes
      msgSpans = parseFormatString(message.text, [])
    }
  } else {
    // Message/action/notice
    const nickWidth = config?.display.nick_column_width ?? 8
    const alignment = config?.display.nick_alignment ?? "right"
    const rawNickMode = message.nickMode ?? ""
    const nick = message.nick ?? ""
    const maxLen = config?.display.nick_max_length ?? nickWidth
    const truncate = config?.display.nick_truncation ?? true

    // Truncate nick if needed
    let displayNick = nick
    if (truncate && displayNick.length > maxLen) {
      displayNick = displayNick.slice(0, maxLen)
    }

    // Pad the combined mode+nick so alignment covers the whole column
    // e.g., width=8, mode="@", nick="brudny" → " @brudny" (right-aligned)
    const totalLen = rawNickMode.length + displayNick.length
    const padSize = Math.max(0, nickWidth - totalLen)
    let nickMode: string
    if (alignment === "right") {
      nickMode = " ".repeat(padSize) + rawNickMode
    } else if (alignment === "center") {
      const left = Math.floor(padSize / 2)
      nickMode = " ".repeat(left) + rawNickMode
      displayNick = displayNick + " ".repeat(padSize - left)
    } else {
      nickMode = rawNickMode
      displayNick = displayNick + " ".repeat(padSize)
    }

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
    msgSpans = parseFormatString(resolved, [displayNick, message.text, nickMode])
  }

  // Combine timestamp + space + message into single text element
  const separator: StyledSpan = { text: " ", bold: false, italic: false, underline: false, dim: false }
  const allSpans = [...tsSpans, separator, ...msgSpans]

  return (
    <box width="100%">
      <text>
        {allSpans.map((span, i) => {
          let content: any = span.text
          if (span.bold) content = <strong>{content}</strong>
          if (span.italic) content = <em>{content}</em>
          if (span.underline) content = <u>{content}</u>
          return (
            <span key={i} fg={span.fg} bg={span.bg}>
              {content}
            </span>
          )
        })}
      </text>
    </box>
  )
}

function formatTimestamp(date: Date, format: string): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return format.replace("%H", h).replace("%M", m).replace("%S", s)
}
