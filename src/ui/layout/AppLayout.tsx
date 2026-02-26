import { useStore } from "@/core/state/store"

interface Props {
  sidebar: React.ReactNode
  chat: React.ReactNode
  nicklist: React.ReactNode
  input: React.ReactNode
  topicbar: React.ReactNode
}

export function AppLayout({ sidebar, chat, nicklist, input, topicbar }: Props) {
  const config = useStore((s) => s.config)
  const colors = useStore((s) => s.theme?.colors)
  const leftWidth = config?.sidepanel.left.width ?? 20
  const rightWidth = config?.sidepanel.right.width ?? 18
  const leftVisible = config?.sidepanel.left.visible ?? true
  const rightVisible = config?.sidepanel.right.visible ?? true

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
        {rightVisible && (
          <box width={rightWidth} flexDirection="column" border={["left"]} borderStyle="single" borderColor={border}>
            {nicklist}
          </box>
        )}
      </box>

      {/* Input — height=2: 1 line for borderTop + 1 line for input text */}
      <box height={2} border={["top"]} borderStyle="single" borderColor={border}>
        {input}
      </box>
    </box>
  )
}
