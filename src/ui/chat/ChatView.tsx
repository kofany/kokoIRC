import { useRef, useEffect } from "react"
import { useStore } from "@/core/state/store"
import { useShallow } from "zustand/react/shallow"
import { MessageLine } from "./MessageLine"
import type { Message } from "@/types"
import type { ScrollBoxRenderable } from "@opentui/core"

const NO_BUFFER = { messages: [] as Message[], activeBufferId: null as string | null, currentNick: "", hasBuffer: false }

export function ChatView() {
  const data = useStore(useShallow((s) => {
    const id = s.activeBufferId
    if (!id) return NO_BUFFER
    const buf = s.buffers.get(id)
    if (!buf) return NO_BUFFER
    const conn = s.connections.get(buf.connectionId)
    return {
      messages: buf.messages,
      activeBufferId: id,
      currentNick: conn?.nick ?? "",
      hasBuffer: true,
    }
  }))
  const colors = useStore((s) => s.theme?.colors)
  const scrollRef = useRef<ScrollBoxRenderable>(null)

  // Snap to bottom when switching buffers
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.stickyScroll = true
      scrollRef.current.scrollTo(scrollRef.current.scrollHeight)
    }
  }, [data.activeBufferId])

  if (!data.hasBuffer) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text><span fg={colors?.fg_dim ?? "#292e42"}>No active buffer</span></text>
      </box>
    )
  }

  return (
    <scrollbox ref={scrollRef} height="100%" stickyScroll stickyStart="bottom">
      {data.messages.map((msg) => (
        <MessageLine key={msg.id} message={msg} isOwnNick={msg.nick === data.currentNick} />
      ))}
    </scrollbox>
  )
}
