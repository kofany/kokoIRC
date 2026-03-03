import type { MessageType } from "@/types"

// Re-export from canonical config location
export type { LoggingConfig } from "@/types/config"

export interface LogRow {
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
  network: string
  buffer: string
  timestamp: number
  type: MessageType
  nick: string | null
  text: string
  highlight: boolean
}
