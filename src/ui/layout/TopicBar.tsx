import { useStore } from "@/core/state/store"
import { BufferType } from "@/types"

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

  // Query: show "nick (ident@host)" instead of channel topic
  const isQuery = buffer?.type === BufferType.Query

  return (
    <box width="100%" backgroundColor={bgAlt}>
      <text>
        <span fg={accent}>{name}</span>
        {isQuery && topic ? (
          <span fg={fgMuted}> ({topic})</span>
        ) : (
          <>
            {topic ? <span fg={fgMuted}> — </span> : null}
            {topic ? <span fg={fg}>{topic}</span> : null}
          </>
        )}
      </text>
    </box>
  )
}
