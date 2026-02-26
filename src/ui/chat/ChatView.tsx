import { useStore } from "@/core/state/store"
import { MessageLine } from "./MessageLine"

export function ChatView() {
  const buffer = useStore((s) => s.activeBufferId ? s.buffers.get(s.activeBufferId) : null)
  const currentNick = useStore((s) => {
    if (!buffer) return ""
    return s.connections.get(buffer.connectionId)?.nick ?? ""
  })

  if (!buffer) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text><span fg="#555555">No active buffer</span></text>
      </box>
    )
  }

  return (
    <scrollbox height="100%">
      {buffer.messages.map((msg) => (
        <MessageLine key={msg.id} message={msg} isOwnNick={msg.nick === currentNick} />
      ))}
    </scrollbox>
  )
}
