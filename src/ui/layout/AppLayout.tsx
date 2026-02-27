import { useStore } from "@/core/state/store"
import { useStatusbarColors } from "@/ui/hooks/useStatusbarColors"
import { BufferType } from "@/types"

interface Props {
  sidebar: React.ReactNode
  chat: React.ReactNode
  nicklist: React.ReactNode
  input: React.ReactNode
  topicbar: React.ReactNode
  statusline?: React.ReactNode
}

export function AppLayout({ sidebar, chat, nicklist, input, topicbar, statusline }: Props) {
  const config = useStore((s) => s.config)
  const colors = useStore((s) => s.theme?.colors)
  const buffer = useStore((s) => s.activeBufferId ? s.buffers.get(s.activeBufferId) : null)
  const sb = useStatusbarColors()
  const leftWidth = config?.sidepanel.left.width ?? 20
  const rightWidth = config?.sidepanel.right.width ?? 18
  const leftVisible = config?.sidepanel.left.visible ?? true
  const rightVisible = config?.sidepanel.right.visible ?? true

  // Hide nicklist for non-channel buffers (query, server, special)
  const showNicklist = rightVisible && buffer?.type === BufferType.Channel

  const bg = colors?.bg ?? "#1a1b26"
  const border = colors?.border ?? "#292e42"

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={bg}>
      {/* Topic bar */}
      <box height={1}>{topicbar}</box>

      {/* Main area: sidebar | chat | nicklist */}
      <box flexDirection="row" flexGrow={1}>
        {leftVisible && (
          <box width={leftWidth} flexDirection="column" border={["right"]} borderStyle="single" borderColor={border}>
            {sidebar}
          </box>
        )}
        <box flexGrow={1} flexDirection="column">
          {chat}
        </box>
        {showNicklist && (
          <box width={rightWidth} flexDirection="column" border={["left"]} borderStyle="single" borderColor={border}>
            {nicklist}
          </box>
        )}
      </box>

      {/* Status line + Input area — shared background from config */}
      <box height={statusline ? 3 : 2} flexDirection="column" border={["top"]} borderStyle="single" borderColor={border} backgroundColor={sb.bg}>
        {statusline}
        {input}
      </box>
    </box>
  )
}
