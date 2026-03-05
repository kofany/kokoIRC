import { useStore } from "@/core/state/store"
import { useSortedBuffers } from "@/core/state/selectors"
import { resolveAbstractions, parseFormatString, StyledText } from "@/core/theme"

export function BufferList() {
  const activeBufferId = useStore((s) => s.activeBufferId)
  const theme = useStore((s) => s.theme)
  const setActiveBuffer = useStore((s) => s.setActiveBuffer)
  const leftWidth = useStore((s) => s.config?.sidepanel.left.width ?? 20)

  const buffers = useSortedBuffers()

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
          const maxLabelLen = leftWidth - 3
          const displayLabel = maxLabelLen > 0 && buf.connectionLabel.length > maxLabelLen
            ? buf.connectionLabel.slice(0, maxLabelLen - 1) + "+"
            : buf.connectionLabel
          const spans = parseFormatString(resolved, [displayLabel])
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
        const maxLen = leftWidth - 4
        const displayName = maxLen > 0 && buf.name.length > maxLen ? buf.name.slice(0, maxLen - 1) + "+" : buf.name
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
