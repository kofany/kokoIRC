import { create } from "zustand"
import type { Connection, Buffer, Message, NickEntry, ActivityLevel, ListEntry, ListModeKey } from "@/types"
import type { AppConfig } from "@/types/config"
import type { ThemeFile } from "@/types/theme"
import { logMessage, updateReadMarker } from "@/core/storage"

interface AppState {
  // Data
  connections: Map<string, Connection>
  buffers: Map<string, Buffer>
  activeBufferId: string | null
  previousActiveBufferId: string | null
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
  clearMessages: (bufferId: string) => void

  // Nicklist actions
  addNick: (bufferId: string, entry: NickEntry) => void
  removeNick: (bufferId: string, nick: string) => void
  updateNick: (bufferId: string, oldNick: string, newNick: string, prefix?: string) => void

  // Buffer topic & modes
  updateBufferTopic: (bufferId: string, topic: string, setBy?: string) => void
  updateBufferModes: (bufferId: string, modes: string, modeParams?: Record<string, string>) => void

  // List modes (bans, exceptions, invex, reop)
  setListEntries: (bufferId: string, modeChar: ListModeKey, entries: ListEntry[]) => void
  addListEntry: (bufferId: string, modeChar: ListModeKey, entry: ListEntry) => void
  removeListEntry: (bufferId: string, modeChar: ListModeKey, mask: string) => void

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
  previousActiveBufferId: null,
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
    if (s.activeBufferId !== id) return { buffers }
    // Fall back to previous buffer if it still exists, otherwise null
    const fallback = s.previousActiveBufferId && buffers.has(s.previousActiveBufferId)
      ? s.previousActiveBufferId : null
    return { buffers, activeBufferId: fallback }
  }),

  setActiveBuffer: (id) => {
    // Persist read marker for TUI client
    const slashIdx = id.indexOf("/")
    if (slashIdx > 0) {
      const network = id.slice(0, slashIdx)
      const buffer = id.slice(slashIdx + 1)
      updateReadMarker(network, buffer, "tui", Date.now())
    }

    return set((s) => {
      // Reset activity when switching to buffer
      const buffers = new Map(s.buffers)
      const buf = buffers.get(id)
      if (buf) {
        buffers.set(id, { ...buf, activity: 0, unreadCount: 0, lastRead: new Date() })
      }
      const previousActiveBufferId = s.activeBufferId !== id ? s.activeBufferId : s.previousActiveBufferId
      return { activeBufferId: id, previousActiveBufferId, buffers }
    })
  },

  updateBufferActivity: (id, level) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(id)
    if (buf && level > buf.activity) {
      buffers.set(id, { ...buf, activity: level, unreadCount: buf.unreadCount + 1 })
    }
    return { buffers }
  }),

  addMessage: (bufferId, message) => {
    // Log to persistent storage (fire-and-forget, outside Zustand set)
    const slashIdx = bufferId.indexOf("/")
    if (slashIdx > 0) {
      const network = bufferId.slice(0, slashIdx)
      const buffer = bufferId.slice(slashIdx + 1)
      logMessage(network, buffer, message.id, message.type, message.text, message.nick ?? null, message.highlight, message.timestamp)
    }

    return set((s) => {
      const buffers = new Map(s.buffers)
      const buf = buffers.get(bufferId)
      if (!buf) return s
      const maxLines = s.config?.display.scrollback_lines ?? 2000
      const messages = [...buf.messages, message]
      if (messages.length > maxLines) messages.splice(0, messages.length - maxLines)
      buffers.set(bufferId, { ...buf, messages })
      return { buffers }
    })
  },

  clearMessages: (bufferId) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(bufferId)
    if (!buf) return s
    buffers.set(bufferId, { ...buf, messages: [] })
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

  setListEntries: (bufferId, modeChar, entries) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(bufferId)
    if (!buf) return s
    const listModes = new Map(buf.listModes)
    listModes.set(modeChar, entries)
    buffers.set(bufferId, { ...buf, listModes })
    return { buffers }
  }),

  addListEntry: (bufferId, modeChar, entry) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(bufferId)
    if (!buf) return s
    const listModes = new Map(buf.listModes)
    const existing = listModes.get(modeChar) ?? []
    // Deduplicate by mask
    if (existing.some((e) => e.mask === entry.mask)) return s
    listModes.set(modeChar, [...existing, entry])
    buffers.set(bufferId, { ...buf, listModes })
    return { buffers }
  }),

  removeListEntry: (bufferId, modeChar, mask) => set((s) => {
    const buffers = new Map(s.buffers)
    const buf = buffers.get(bufferId)
    if (!buf) return s
    const listModes = new Map(buf.listModes)
    const existing = listModes.get(modeChar)
    if (!existing) return s
    listModes.set(modeChar, existing.filter((e) => e.mask !== mask))
    buffers.set(bufferId, { ...buf, listModes })
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
