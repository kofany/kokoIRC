import { useState, useRef, useEffect } from "react"
import { useStore } from "@/core/state/store"
import { useStatusbarColors } from "@/ui/hooks/useStatusbarColors"
import { cloneConfig, saveConfig } from "@/core/config/loader"
import { CONFIG_PATH } from "@/core/constants"
import { BufferType } from "@/types"

const MIN_WIDTH = 10
const MAX_WIDTH = 50

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

  // Drag-to-resize state
  const [liveLeftWidth, setLiveLeftWidth] = useState(leftWidth)
  const [liveRightWidth, setLiveRightWidth] = useState(rightWidth)
  const dragRef = useRef<{ side: "left" | "right"; startX: number; startWidth: number; currentWidth: number } | null>(null)
  const store = useStore()

  useEffect(() => { setLiveLeftWidth(leftWidth) }, [leftWidth])
  useEffect(() => { setLiveRightWidth(rightWidth) }, [rightWidth])

  function startDrag(side: "left" | "right", event: any) {
    const w = side === "left" ? liveLeftWidth : liveRightWidth
    dragRef.current = { side, startX: event.x, startWidth: w, currentWidth: w }
  }

  function onDrag(event: any) {
    const d = dragRef.current
    if (!d) return
    const delta = d.side === "left" ? event.x - d.startX : d.startX - event.x
    const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, d.startWidth + delta))
    d.currentWidth = newWidth
    if (d.side === "left") setLiveLeftWidth(newWidth)
    else setLiveRightWidth(newWidth)
  }

  function endDrag() {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    const newConfig = cloneConfig(store.config!)
    if (d.side === "left") newConfig.sidepanel.left.width = d.currentWidth
    else newConfig.sidepanel.right.width = d.currentWidth
    store.setConfig(newConfig)
    saveConfig(CONFIG_PATH, newConfig)
  }

  const bg = colors?.bg ?? "#1a1b26"
  const border = colors?.border ?? "#292e42"

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={bg}>
      {/* Topic bar */}
      <box height={1}>{topicbar}</box>

      {/* Main area: sidebar | chat | nicklist */}
      <box flexDirection="row" flexGrow={1}>
        {leftVisible && (
          <box width={liveLeftWidth} flexDirection="column" border={["right"]} borderStyle="single" borderColor={border}>
            {sidebar}
          </box>
        )}
        <box flexGrow={1} flexDirection="column">
          {chat}
        </box>
        {showNicklist && (
          <box width={liveRightWidth} flexDirection="column" border={["left"]} borderStyle="single" borderColor={border}>
            {nicklist}
          </box>
        )}

        {/* Invisible drag hit zones overlaying the borders */}
        {leftVisible && (
          <box
            position="absolute"
            left={liveLeftWidth - 1}
            top={0}
            width={2}
            height="100%"
            onMouseDown={(e: any) => startDrag("left", e)}
            onMouseDrag={onDrag}
            onMouseDragEnd={endDrag}
          />
        )}
        {showNicklist && (
          <box
            position="absolute"
            right={liveRightWidth - 1}
            top={0}
            width={2}
            height="100%"
            onMouseDown={(e: any) => startDrag("right", e)}
            onMouseDrag={onDrag}
            onMouseDragEnd={endDrag}
          />
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
