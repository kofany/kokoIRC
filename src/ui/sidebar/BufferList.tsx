import { useStore } from "@/core/state/store"
import { sortBuffers } from "@/core/state/sorting"
import { resolveAbstractions, parseFormatString } from "@/core/theme"
import { StyledText } from "@/core/theme"

export function BufferList() {
  const buffers = useStore((s) => {
    const list = Array.from(s.buffers.values()).map((buf) => ({
      ...buf,
      connectionLabel: s.connections.get(buf.connectionId)?.label ?? buf.connectionId,
    }))
    return sortBuffers(list)
  })
  const activeBufferId = useStore((s) => s.activeBufferId)
  const theme = useStore((s) => s.theme)
  const setActiveBuffer = useStore((s) => s.setActiveBuffer)

  let lastConnectionId = ""
  let refNum = 0

  return (
    <scrollbox height="100%">
      {buffers.map((buf) => {
        const items: React.ReactNode[] = []

        // Connection header
        if (buf.connectionId !== lastConnectionId) {
          lastConnectionId = buf.connectionId
          const format = theme?.formats.sidepanel.header ?? "%B$0%N"
          const resolved = resolveAbstractions(format, theme?.abstracts ?? {})
          const spans = parseFormatString(resolved, [buf.connectionLabel])
          items.push(
            <box key={`h-${buf.connectionId}`} width="100%">
              <StyledText spans={spans} />
            </box>
          )
        }

        refNum++
        const isActive = buf.id === activeBufferId
        const formatKey = isActive
          ? "item_selected"
          : `item_activity_${buf.activity}`
        const format = theme?.formats.sidepanel[formatKey] ?? "$0. $1"
        const resolved = resolveAbstractions(format, theme?.abstracts ?? {})
        const maxLen = (useStore.getState().config?.sidepanel.left.width ?? 20) - 4
        const displayName = buf.name.length > maxLen ? buf.name.slice(0, maxLen - 1) + "\u2026" : buf.name
        const spans = parseFormatString(resolved, [String(refNum), displayName])

        items.push(
          <box key={buf.id} width="100%" onMouseDown={() => setActiveBuffer(buf.id)}>
            <StyledText spans={spans} />
          </box>
        )

        return items
      })}
    </scrollbox>
  )
}
