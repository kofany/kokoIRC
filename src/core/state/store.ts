import { create } from "zustand"
import type { Connection, Buffer, Message, NickEntry, ActivityLevel } from "@/types"
import type { AppConfig } from "@/types/config"
import type { ThemeFile } from "@/types/theme"

interface AppState {
  // Data
  connections: Map<string, Connection>
  buffers: Map<string, Buffer>
  activeBufferId: string | null
  config: AppConfig | null
  theme: ThemeFile | null

  // Connection actions
  addConnection: (conn: Connection) => void
  updateConnection: (id: string, updates: Partial<Connection>) => void
  removeConnection: (id: string) => void

  // Buffer actions
  addBuffer: (buffer: Buffer) => void
  removeBuffer: (id: string) => void
  setActiveBuffer: (id: string) => void
  updateBufferActivity: (id: string, level: ActivityLevel) => void

  // Message actions
  addMessage: (bufferId: string, message: Message) => void

  // Nicklist actions
  addNick: (bufferId: string, entry: NickEntry) => void
  removeNick: (bufferId: string, nick: string) => void
  updateNick: (bufferId: string, oldNick: string, newNick: string, prefix?: string) => void

  // Buffer topic & modes
  updateBufferTopic: (bufferId: string, topic: string, setBy?: string) => void
  updateBufferModes: (bufferId: string, modes: string, modeParams?: Record<string, string>) => void

  // Config/Theme
  setConfig: (config: AppConfig) => void
  setTheme: (theme: ThemeFile) => void

  // App lifecycle
  shutdownHandler: (() => void) | null
  setShutdownHandler: (handler: () => void) => void
  requestShutdown: () => void
}

export const useStore = create<AppState>((set, get) => ({
  connections: new Map(),
  buffers: new Map(),
  activeBufferId: null,
  config: null,
  theme: null,

  addConnection: (conn) => set((s) => {
    const connections = new Map(s.connections)
    connections.set(conn.id, conn)
    return { connections }
  }),

  updateConnection: (id, updates) => set((s) => {
    const connections = new Map(s.connections)
    const existing = connections.get(id)
    if (existing) connections.set(id, { ...existing, ...updates })
    return { connections }
  }),

  removeConnection: (id) => set((s) => {
    const connections = new Map(s.connections)
    connections.delete(id)
    return { connections }
  }),

  addBuffer: (buffer) => set((s) => {
    const buffers = new Map(s.buffers)
    buffers.set(buffer.id, buffer)
    return { buffers }
  }),

  removeBuffer: (id) => set((s) => {
    const buffers = new Map(s.buffers)
    buffers.delete(id)
    const activeBufferId = s.activeBufferId === id ? null : s.activeBufferId
    return { buffers, activeBufferId }
  }),

  setActiveBuffer: (id) => set((s) => {
    // Reset activity when switching to buffer
    const buffers = new Map(s.buffers)
    const buf = buffers.get(id)
    if (buf) {
      buffers.set(id, { ...buf, activity: 0, unreadCount: 0, lastRead: new Date() })
    }
    return { activeBufferId: id, buffers }
  }),

  updateBufferActivity: (id, level) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(id)
    if (buf && level > buf.activity) {
      buffers.set(id, { ...buf, activity: level, unreadCount: buf.unreadCount + 1 })
    }
    return { buffers }
  }),

  addMessage: (bufferId, message) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(bufferId)
    if (!buf) return s
    const maxLines = s.config?.display.scrollback_lines ?? 2000
    const messages = [...buf.messages, message]
    if (messages.length > maxLines) messages.splice(0, messages.length - maxLines)
    buffers.set(bufferId, { ...buf, messages })
    return { buffers }
  }),

  addNick: (bufferId, entry) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(bufferId)
    if (!buf) return s
    const users = new Map(buf.users)
    users.set(entry.nick, entry)
    buffers.set(bufferId, { ...buf, users })
    return { buffers }
  }),

  removeNick: (bufferId, nick) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(bufferId)
    if (!buf) return s
    const users = new Map(buf.users)
    users.delete(nick)
    buffers.set(bufferId, { ...buf, users })
    return { buffers }
  }),

  updateNick: (bufferId, oldNick, newNick, prefix) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(bufferId)
    if (!buf) return s
    const users = new Map(buf.users)
    const existing = users.get(oldNick)
    if (existing) {
      users.delete(oldNick)
      users.set(newNick, { ...existing, nick: newNick, prefix: prefix ?? existing.prefix })
    }
    buffers.set(bufferId, { ...buf, users })
    return { buffers }
  }),

  updateBufferTopic: (bufferId, topic, setBy) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(bufferId)
    if (!buf) return s
    buffers.set(bufferId, { ...buf, topic, topicSetBy: setBy })
    return { buffers }
  }),

  updateBufferModes: (bufferId, modes, modeParams) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(bufferId)
    if (!buf) return s
    buffers.set(bufferId, { ...buf, modes, modeParams: modeParams ?? buf.modeParams })
    return { buffers }
  }),

  setConfig: (config) => set({ config }),
  setTheme: (theme) => set({ theme }),

  shutdownHandler: null,
  setShutdownHandler: (handler) => set({ shutdownHandler: handler }),
  requestShutdown: () => {
    const handler = get().shutdownHandler
    if (handler) handler()
  },
}))
