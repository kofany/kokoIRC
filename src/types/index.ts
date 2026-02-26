// === Connection ===

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface Connection {
  id: string
  label: string
  status: ConnectionStatus
  nick: string
  userModes: string
  isupport: Record<string, string>
  error?: string
}

// === Buffer ===

export enum BufferType {
  Server = 'server',
  Channel = 'channel',
  Query = 'query',
  Special = 'special',
}

export enum SortGroup {
  Server = 1,
  Channel = 2,
  Query = 3,
  Special = 4,
}

export enum ActivityLevel {
  None = 0,
  Events = 1,
  Highlight = 2,
  Activity = 3,
  Mention = 4,
}

export interface Buffer {
  id: string
  connectionId: string
  type: BufferType
  name: string
  messages: Message[]
  activity: ActivityLevel
  unreadCount: number
  lastRead: Date
  topic?: string
  topicSetBy?: string
  users: Map<string, NickEntry>
  modes?: string
}

// === Message ===

export type MessageType = 'message' | 'action' | 'event' | 'notice' | 'ctcp'

export interface Message {
  id: string
  timestamp: Date
  type: MessageType
  nick?: string
  nickMode?: string
  text: string
  highlight: boolean
  tags?: Record<string, string>
}

// === NickList ===

export interface NickEntry {
  nick: string
  prefix: string
  away: boolean
  account?: string
}

// === Sort helpers ===

export function getSortGroup(type: BufferType): SortGroup {
  switch (type) {
    case BufferType.Server: return SortGroup.Server
    case BufferType.Channel: return SortGroup.Channel
    case BufferType.Query: return SortGroup.Query
    case BufferType.Special: return SortGroup.Special
  }
}

export function makeBufferId(connectionId: string, name: string): string {
  return `${connectionId}/${name.toLowerCase()}`
}
