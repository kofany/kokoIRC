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
  const leftWidth = config?.sidepanel.left.width ?? 20
  const rightWidth = config?.sidepanel.right.width ?? 18
  const leftVisible = config?.sidepanel.left.visible ?? true
  const rightVisible = config?.sidepanel.right.visible ?? true

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Topic bar */}
      <box height={1}>{topicbar}</box>

      {/* Main area: sidebar | chat | nicklist */}
      <box flexDirection="row" flexGrow={1}>
        {leftVisible && (
          <box width={leftWidth} flexDirection="column" border={["right"]} borderStyle="single" borderColor="#444444">
            {sidebar}
          </box>
        )}
        <box flexGrow={1} flexDirection="column">
          {chat}
        </box>
        {rightVisible && (
          <box width={rightWidth} flexDirection="column" border={["left"]} borderStyle="single" borderColor="#444444">
            {nicklist}
          </box>
        )}
      </box>

      {/* Input */}
      <box height={1} border={["top"]} borderStyle="single" borderColor="#444444">
        {input}
      </box>
    </box>
  )
}
