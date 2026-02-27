import { useMemo } from "react"
import { useStore } from "@/core/state/store"
import { sortBuffers } from "@/core/state/sorting"
import { BufferType, ActivityLevel } from "@/types"
import type { StatusbarItem, StatusbarConfig } from "@/types/config"

/** Resolve statusbar color: config override → theme fallback */
function c(configVal: string, themeFallback: string | undefined, hardFallback: string): string {
  return configVal || themeFallback || hardFallback
}

export function useStatusbarColors() {
  const sb = useStore((s) => s.config?.statusbar)
  const colors = useStore((s) => s.theme?.colors)
  return {
    bg: c(sb?.background ?? "", colors?.bg_alt, "#16161e"),
    accent: c(sb?.accent_color ?? "", colors?.accent, "#7aa2f7"),
    text: c(sb?.text_color ?? "", colors?.fg, "#a9b1d6"),
    muted: c(sb?.muted_color ?? "", colors?.fg_muted, "#565f89"),
    dim: c(sb?.dim_color ?? "", colors?.fg_dim, "#292e42"),
    promptColor: c(sb?.prompt_color ?? "", colors?.accent, "#7aa2f7"),
    inputColor: c(sb?.input_color ?? "", colors?.fg, "#c0caf5"),
    cursorColor: c(sb?.cursor_color ?? "", colors?.cursor, "#7aa2f7"),
    prompt: sb?.prompt ?? "[$channel] > ",
    separator: sb?.separator ?? " | ",
  }
}

export function StatusLine() {
  const config = useStore((s) => s.config)
  const buffer = useStore((s) => s.activeBufferId ? s.buffers.get(s.activeBufferId) : null)
  const buffersMap = useStore((s) => s.buffers)
  const connections = useStore((s) => s.connections)
  const activeBufferId = useStore((s) => s.activeBufferId)

  // Sort buffers the same way as BufferList sidebar
  const sortedBuffers = useMemo(() => {
    const list = Array.from(buffersMap.values()).map((buf) => ({
      ...buf,
      connectionLabel: connections.get(buf.connectionId)?.label ?? buf.connectionId,
    }))
    return sortBuffers(list)
  }, [buffersMap, connections])

  const sb = useStatusbarColors()

  if (!config?.statusbar.enabled) return null

  const conn = buffer ? connections.get(buffer.connectionId) : null
  const items = config.statusbar.items

  const renderedItems: React.ReactNode[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (i > 0) {
      renderedItems.push(
        <span key={`sep-${i}`} fg={sb.dim}>{sb.separator}</span>
      )
    }
    renderedItems.push(renderItem(item, i))
  }

  function renderItem(item: StatusbarItem, idx: number): React.ReactNode {
    switch (item) {
      case "active_windows":
        return renderActiveWindows(idx)
      case "nick_info":
        return renderNickInfo(idx)
      case "channel_info":
        return renderChannelInfo(idx)
      case "lag":
        return renderLag(idx)
      case "time":
        return renderTime(idx)
      default:
        return null
    }
  }

  function renderActiveWindows(idx: number): React.ReactNode {
    const activityItems: React.ReactNode[] = []
    let activeWinNum = 0
    for (let i = 0; i < sortedBuffers.length; i++) {
      const buf = sortedBuffers[i]
      const winNum = i + 1
      if (buf.id === activeBufferId) {
        activeWinNum = winNum
        continue
      }
      if (buf.activity === ActivityLevel.None) continue

      let color = "#9ece6a"
      if (buf.activity >= ActivityLevel.Mention) color = "#bb9af7"
      else if (buf.activity >= ActivityLevel.Highlight) color = "#f7768e"
      else if (buf.activity >= ActivityLevel.Activity) color = "#e0af68"

      if (activityItems.length > 0) {
        activityItems.push(<span key={`as-${winNum}`} fg={sb.dim}>,</span>)
      }
      activityItems.push(
        <span key={`a-${winNum}`} fg={color}>{winNum}</span>
      )
    }

    return (
      <span key={`act-${idx}`} fg={sb.muted}>
        Act: <span fg={sb.accent}>{activeWinNum}</span>
        {activityItems.length > 0 ? (
          <>
            <span fg={sb.dim}> </span>
            {activityItems}
          </>
        ) : null}
      </span>
    )
  }

  function renderNickInfo(idx: number): React.ReactNode {
    const nick = conn?.nick ?? "?"
    const modes = conn?.userModes ? `+${conn.userModes}` : ""
    return (
      <span key={`nick-${idx}`} fg={sb.muted}>
        <span fg={sb.accent}>{nick}</span>
        {modes ? <span fg={sb.muted}>({modes})</span> : null}
      </span>
    )
  }

  function renderChannelInfo(idx: number): React.ReactNode {
    if (!buffer) return null
    if (buffer.type === BufferType.Channel) {
      const modes = buffer.modes ? `+${buffer.modes}` : ""
      return (
        <span key={`chan-${idx}`} fg={sb.muted}>
          <span fg={sb.accent}>{buffer.name}</span>
          {modes ? <span fg={sb.muted}>({modes})</span> : null}
        </span>
      )
    }
    if (buffer.type === BufferType.Query) {
      return (
        <span key={`chan-${idx}`} fg={sb.muted}>
          <span fg="#e0af68">{buffer.name}</span>
        </span>
      )
    }
    if (buffer.type === BufferType.Server) {
      return (
        <span key={`chan-${idx}`} fg={sb.muted}>
          <span fg={sb.muted}>{conn?.label ?? "server"}</span>
        </span>
      )
    }
    return null
  }

  function renderLag(idx: number): React.ReactNode {
    const lag = conn?.lag
    if (lag == null) return null
    const seconds = (lag / 1000).toFixed(1)
    const lagColor = lag > 5000 ? "#f7768e" : lag > 2000 ? "#e0af68" : "#9ece6a"
    return (
      <span key={`lag-${idx}`} fg={sb.muted}>
        Lag: <span fg={lagColor}>{seconds}s</span>
      </span>
    )
  }

  function renderTime(idx: number): React.ReactNode {
    const now = new Date()
    const h = String(now.getHours()).padStart(2, "0")
    const m = String(now.getMinutes()).padStart(2, "0")
    return (
      <span key={`time-${idx}`} fg={sb.muted}>{h}:{m}</span>
    )
  }

  return (
    <box width="100%" height={1}>
      <text>
        <span fg={sb.dim}>[</span>
        {renderedItems}
        <span fg={sb.dim}>]</span>
      </text>
    </box>
  )
}
