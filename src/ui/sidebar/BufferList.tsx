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
          const hdrFormat = theme?.formats.sidepanel.header ?? "%B$0%N"
          const hdrResolved = resolveAbstractions(hdrFormat, theme?.abstracts ?? {})
          // Measure visible overhead of header format (everything except $0)
          const hdrOverhead = parseFormatString(hdrResolved, [""]).reduce((w, s) => w + s.text.length, 0)
          const maxLabelLen = leftWidth - 3 - hdrOverhead
          const displayLabel = maxLabelLen > 0 && buf.connectionLabel.length > maxLabelLen
            ? buf.connectionLabel.slice(0, maxLabelLen - 1) + "+"
            : buf.connectionLabel
          const hdrSpans = parseFormatString(hdrResolved, [displayLabel])
          items.push(
            <box key={`h-${buf.connectionId}`} width="100%">
              <StyledText spans={hdrSpans} />
            </box>
          )
        }

        refNum++
        const refStr = String(refNum)
        const isActive = buf.id === activeBufferId
        const formatKey = isActive
          ? "item_selected"
          : `item_activity_${buf.activity}`
        const format = theme?.formats.sidepanel[formatKey] ?? "$0. $1"
        const resolved = resolveAbstractions(format, theme?.abstracts ?? {})
        // Measure visible overhead of format (refnum + decoration, excluding channel name)
        const formatOverhead = parseFormatString(resolved, [refStr, ""]).reduce((w, s) => w + s.text.length, 0)
        const maxLen = leftWidth - 3 - formatOverhead
        const displayName = maxLen > 0 && buf.name.length > maxLen ? buf.name.slice(0, maxLen - 1) + "+" : buf.name
        const spans = parseFormatString(resolved, [refStr, displayName])

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
