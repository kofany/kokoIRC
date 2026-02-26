import { useStore } from "@/core/state/store"

export function TopicBar() {
  const activeBufferId = useStore((s) => s.activeBufferId)
  const buffer = useStore((s) => s.activeBufferId ? s.buffers.get(s.activeBufferId) : null)
  const topic = buffer?.topic ?? ""
  const name = buffer?.name ?? ""

  return (
    <box width="100%" backgroundColor="#1a1a2e">
      <text>
        <span fg="#5555ff">{name}</span>
        {topic ? <span fg="#aaaaaa"> — {topic}</span> : null}
      </text>
    </box>
  )
}
