import type { MessageType } from "@/types"

// Re-export from canonical config location
export type { LoggingConfig } from "@/types/config"

export interface LogRow {
  msg_id: string       // UUID from Message.id — shared identity across TUI/web
  network: string
  buffer: string
  timestamp: number    // Unix ms
  type: MessageType
  nick: string | null
  text: string
  highlight: number    // 0 or 1
}

export interface StoredMessage {
  id: number
  msg_id: string
  network: string
  buffer: string
  timestamp: number
  type: MessageType
  nick: string | null
  text: string
  highlight: boolean
}

export interface ReadMarker {
  network: string
  buffer: string
  client: string       // 'tui' or web session id
  last_read: number    // Unix ms timestamp
}

/** Callback for real-time message events (used by WebSocket server). */
export type MessageListener = (row: LogRow) => void
