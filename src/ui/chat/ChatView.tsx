import { useRef, useEffect } from "react"
import { useStore } from "@/core/state/store"
import { MessageLine } from "./MessageLine"
import type { ScrollBoxRenderable } from "@opentui/core"

export function ChatView() {
  const buffer = useStore((s) => {
    const id = s.activeBufferId
    return id ? s.buffers.get(id) ?? null : null
  })
  const activeBufferId = useStore((s) => s.activeBufferId)
  const currentNick = useStore((s) => {
    const id = s.activeBufferId
    if (!id) return ""
    const buf = s.buffers.get(id)
    if (!buf) return ""
    return s.connections.get(buf.connectionId)?.nick ?? ""
  })
  const colors = useStore((s) => s.theme?.colors)
  const scrollRef = useRef<ScrollBoxRenderable>(null)

  // Snap to bottom when switching buffers
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.stickyScroll = true
      scrollRef.current.scrollTo(scrollRef.current.scrollHeight)
    }
  }, [activeBufferId])

  if (!buffer) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text><span fg={colors?.fg_dim ?? "#292e42"}>No active buffer</span></text>
      </box>
    )
  }

  return (
    <scrollbox ref={scrollRef} height="100%" stickyScroll stickyStart="bottom">
      {buffer.messages.map((msg) => (
        <MessageLine key={msg.id} message={msg} isOwnNick={msg.nick === currentNick} />
      ))}
    </scrollbox>
  )
}
