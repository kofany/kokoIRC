import { create } from "zustand"
import type { Connection, Buffer, Message, NickEntry, ActivityLevel, ListEntry, ListModeKey } from "@/types"
import type { AppConfig } from "@/types/config"
import type { ThemeFile } from "@/types/theme"

export interface ImagePreviewState {
  url: string
  status: "loading" | "ready" | "error"
  error?: string
  width: number
  height: number
  title?: string
  protocol?: string  // needed for cleanup on dismiss
}

interface AppState {
  // Data
  connections: Map<string, Connection>
  buffers: Map<string, Buffer>
  activeBufferId: string | null
  previousActiveBufferId: string | null
  config: AppConfig | null
  theme: ThemeFile | null

  // Image preview
  imagePreview: ImagePreviewState | null
  showImagePreview: (url: string) => void
  updateImagePreview: (updates: Partial<ImagePreviewState>) => void
  hideImagePreview: () => void

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

  // Image preview
  imagePreview: null,
  showImagePreview: (url) => {
    // Concurrency guard — ignore if already loading
    const current = get().imagePreview
    if (current?.status === "loading") return

    set({
      imagePreview: { url, status: "loading", width: 0, height: 0 },
    })
    // Kick off the async render pipeline
    import("@/core/image-preview/render").then(({ preparePreview }) => {
      preparePreview(url)
    }).catch((err) => {
      const s = get()
      const buf = s.activeBufferId
      if (buf) {
        s.addMessage(buf, {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "event",
          text: `%Zf7768e[img] import failed: ${err.message}%N`,
          highlight: false,
        })
      }
      set({ imagePreview: null })
    })
  },
  updateImagePreview: (updates) => set((s) => {
    if (!s.imagePreview) return s
    return { imagePreview: { ...s.imagePreview, ...updates } }
  }),
  hideImagePreview: () => {
    const prev = get().imagePreview
    if (!prev) { set({ imagePreview: null }); return }

    try {
      const { writeSync } = require("node:fs")
      const inTmux = !!process.env.TMUX

      // Disable mouse tracking during cleanup writes (same reason as render.ts)
      writeSync(1, "\x1b[?1003l\x1b[?1006l\x1b[?1002l\x1b[?1000l")

      // Protocol-specific cleanup (like erssi's image_render_clear_graphics)
      if (prev.protocol === "kitty") {
        // q=2: suppress terminal response to prevent PTY echo / malloc issues
        const deleteCmd = "\x1b_Ga=d,q=2\x1b\\"
        if (inTmux) {
          const escaped = deleteCmd.replace(/\x1b/g, "\x1b\x1b")
          writeSync(1, `\x1bPtmux;${escaped}\x1b\\`)
        } else {
          writeSync(1, deleteCmd)
        }
      } else if (prev.protocol && prev.protocol !== "kitty") {
        // iTerm2/Sixel/Symbols: images are part of the cell buffer, not a
        // separate graphics layer. Write blank spaces over the image area
        // to force the terminal to clear inline image cells.
        const termCols = process.stdout.columns || 80
        const termRows = process.stdout.rows || 24
        const w = prev.width || 0
        const h = prev.height || 0
        const left = Math.max(0, Math.floor((termCols - w) / 2))
        const top = Math.max(0, Math.floor((termRows - h) / 2))
        const blankLine = " ".repeat(w)
        let clear = "\x1b7" // save cursor
        for (let row = 0; row < h; row++) {
          clear += `\x1b[${top + row + 1};${left + 1}H${blankLine}`
        }
        clear += "\x1b8" // restore cursor
        writeSync(1, clear)
      }

      // tmux: small delay to let tmux process the clear (like erssi's usleep(10000))
      if (inTmux) {
        Bun.sleepSync(10)
      }

      // Re-enable mouse tracking
      writeSync(1, "\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1006h")
    } catch {}

    // Remove overlay from React tree, then force OpenTUI full repaint
    // via SIGWINCH (fake resize signal) — erssi equivalent of mainwindows_redraw()
    set({ imagePreview: null })
    setTimeout(() => {
      process.kill(process.pid, "SIGWINCH")
    }, 16)
  },

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

  setActiveBuffer: (id) => set((s) => {
    // Reset activity when switching to buffer
    const buffers = new Map(s.buffers)
    const buf = buffers.get(id)
    if (buf) {
      buffers.set(id, { ...buf, activity: 0, unreadCount: 0, lastRead: new Date() })
    }
    const previousActiveBufferId = s.activeBufferId !== id ? s.activeBufferId : s.previousActiveBufferId
    return { activeBufferId: id, previousActiveBufferId, buffers }
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
