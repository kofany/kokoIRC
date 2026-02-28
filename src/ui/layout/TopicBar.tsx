import { useStore } from "@/core/state/store"
import { parseFormatString, StyledText } from "@/core/theme"
import { BufferType } from "@/types"
import type { StyledSpan } from "@/types/theme"

export function TopicBar() {
  const activeBufferId = useStore((s) => s.activeBufferId)
  const buffer = useStore((s) => s.activeBufferId ? s.buffers.get(s.activeBufferId) : null)
  const colors = useStore((s) => s.theme?.colors)
  const topic = buffer?.topic ?? ""
  const name = buffer?.name ?? ""

  const bgAlt = colors?.bg_alt ?? "#16161e"
  const accent = colors?.accent ?? "#7aa2f7"
  const fgMuted = colors?.fg_muted ?? "#565f89"
  const fg = colors?.fg ?? "#a9b1d6"

  const isQuery = buffer?.type === BufferType.Query

  // Build the topic bar as styled spans
  const spans: StyledSpan[] = []
  const plain = (text: string, color?: string): StyledSpan => ({
    text, fg: color, bold: false, italic: false, underline: false, dim: false,
  })

  spans.push(plain(name, accent))

  if (isQuery && topic) {
    spans.push(plain(` (${topic})`, fgMuted))
  } else if (topic) {
    spans.push(plain(" — ", fgMuted))
    // Parse mIRC/IRC formatting codes in topic text
    const topicSpans = parseFormatString(topic, [])
    // Set default fg on spans that don't have an explicit color
    for (const s of topicSpans) {
      if (!s.fg) s.fg = fg
    }
    spans.push(...topicSpans)
  }

  return (
    <box width="100%" backgroundColor={bgAlt}>
      <StyledText spans={spans} />
    </box>
  )
}
