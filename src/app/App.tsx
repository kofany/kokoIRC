import { useState, useEffect, useCallback, useRef } from "react"
import { useRenderer, useKeyboard } from "@opentui/react"
import { useStore } from "@/core/state/store"
import { loadConfig } from "@/core/config/loader"
import { loadTheme } from "@/core/theme/loader"
import { connectAllAutoconnect } from "@/core/irc"
import { CONFIG_PATH, THEME_PATH } from "@/core/constants"
import { loadAllDocs } from "@/core/commands"
import { initHomeDir } from "@/core/init"
import { autoloadScripts } from "@/core/scripts/manager"
import { initStorage, shutdownStorage } from "@/core/storage"
import { BufferType, ActivityLevel, makeBufferId, getSortGroup } from "@/types"
import { SplashScreen } from "@/ui/splash/SplashScreen"
import { AppLayout } from "@/ui/layout/AppLayout"
import { TopicBar } from "@/ui/layout/TopicBar"
import { BufferList } from "@/ui/sidebar/BufferList"
import { NickList } from "@/ui/sidebar/NickList"
import { ChatView } from "@/ui/chat/ChatView"
import { CommandInput } from "@/ui/input/CommandInput"
import { StatusLine } from "@/ui/statusbar/StatusLine"

export function App() {
  const renderer = useRenderer()
  const setConfig = useStore((s) => s.setConfig)
  const setTheme = useStore((s) => s.setTheme)
  const config = useStore((s) => s.config)
  const [showSplash, setShowSplash] = useState(true)

  // Escape-prefix timestamp for irssi-style Esc+N window switching.
  // OpenTUI's stdin buffer uses a 5ms timeout — too short for manual Esc then N.
  // We track when Escape was pressed and check on the next keypress.
  const escPressedAt = useRef(0)

  useKeyboard((key) => {
    if (key.name === "q" && key.ctrl) {
      shutdownStorage().finally(() => renderer.destroy())
      return
    }

    // Track standalone Escape keypresses for Esc+N prefix
    if (key.name === "escape" && !key.ctrl && !key.shift) {
      escPressedAt.current = Date.now()
      return
    }

    // Check if this keypress is an Esc+key combo:
    // Either key.meta is set (terminal sent Alt+N natively, e.g. iTerm2 with Option-as-Meta)
    // or Escape was pressed within the last 500ms (manual Esc then N)
    const isEscCombo = key.meta || (Date.now() - escPressedAt.current < 500)

    if (isEscCombo) {
      // Reset the escape timestamp so it doesn't trigger again
      escPressedAt.current = 0

      const s = useStore.getState()

      // Build sorted buffer list (same order as sidebar)
      const getSortedIds = () => {
        const bufs = Array.from(s.buffers.values())
          .filter((b) => b.connectionId !== "_default")
          .map((b) => ({
            ...b,
            connectionLabel: s.connections.get(b.connectionId)?.label ?? b.connectionId,
          }))
          .sort((a, b) => {
            const lc = a.connectionLabel.localeCompare(b.connectionLabel, undefined, { sensitivity: "base" })
            if (lc !== 0) return lc
            const ga = getSortGroup(a.type), gb = getSortGroup(b.type)
            if (ga !== gb) return ga - gb
            return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          })
        return bufs.map((b) => b.id)
      }

      // Esc+1..9 → buffer 1-9, Esc+0 → buffer 10
      if (key.name >= "1" && key.name <= "9") {
        const idx = parseInt(key.name, 10) - 1
        const ids = getSortedIds()
        if (idx < ids.length) {
          s.setActiveBuffer(ids[idx])
          key.preventDefault()
        }
        return
      }
      if (key.name === "0") {
        const ids = getSortedIds()
        if (ids.length >= 10) {
          s.setActiveBuffer(ids[9])
          key.preventDefault()
        }
        return
      }

      // Esc+Left/Right → prev/next buffer (wrap)
      if (key.name === "left" || key.name === "right") {
        const ids = getSortedIds()
        if (ids.length === 0) return
        const currentIdx = s.activeBufferId ? ids.indexOf(s.activeBufferId) : -1
        let next: number
        if (key.name === "left") {
          next = currentIdx <= 0 ? ids.length - 1 : currentIdx - 1
        } else {
          next = currentIdx >= ids.length - 1 ? 0 : currentIdx + 1
        }
        s.setActiveBuffer(ids[next])
        key.preventDefault()
        return
      }
    }
  })

  // Register shutdown handler so commands can close the app
  useEffect(() => {
    useStore.getState().setShutdownHandler(() => {
      shutdownStorage().finally(() => renderer.destroy())
    })
  }, [renderer])

  // Load config + theme during splash (but don't connect yet)
  useEffect(() => {
    async function init() {
      await initHomeDir()
      const config = await loadConfig(CONFIG_PATH)
      setConfig(config)

      // Initialize persistent log storage before any connections
      await initStorage(config.logging)

      const themePath = THEME_PATH(config.general.theme)
      const theme = await loadTheme(themePath)
      setTheme(theme)

      await loadAllDocs()
    }
    init().catch((err) => console.error("[init]", err))
  }, [])

  // After splash finishes → connect, autoload scripts, switch to Status window
  const handleSplashDone = useCallback(() => {
    setShowSplash(false)
    connectAllAutoconnect()
    autoloadScripts().catch((err) => console.error("[scripts] autoload error:", err))

    const s = useStore.getState()

    // If no autoconnect created a buffer, create a default Status buffer
    if (s.buffers.size === 0) {
      const bufferId = makeBufferId("_default", "Status")
      s.addBuffer({
        id: bufferId,
        connectionId: "_default",
        type: BufferType.Server,
        name: "Status",
        messages: [{
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "event" as const,
          text: "Welcome to kokoIRC. Type /connect to connect to a server.",
          highlight: false,
        }],
        activity: ActivityLevel.None,
        unreadCount: 0,
        lastRead: new Date(),
        users: new Map(),
        listModes: new Map(),
      })
      s.setActiveBuffer(bufferId)
      return
    }

    // Activate first Status buffer so user sees connection progress
    for (const buf of s.buffers.values()) {
      if (buf.type === BufferType.Server) {
        s.setActiveBuffer(buf.id)
        break
      }
    }
  }, [])

  if (showSplash) {
    return <SplashScreen onDone={handleSplashDone} />
  }

  // Show loading state until config is loaded
  if (!config) {
    return (
      <box width="100%" height="100%" justifyContent="center" alignItems="center" backgroundColor="#1a1b26">
        <text><span fg="#565f89">Connecting...</span></text>
      </box>
    )
  }

  const statusbarEnabled = config?.statusbar?.enabled ?? true

  return (
    <AppLayout
      topicbar={<TopicBar />}
      sidebar={<BufferList />}
      chat={<ChatView />}
      nicklist={<NickList />}
      input={<CommandInput />}
      statusline={statusbarEnabled ? <StatusLine /> : undefined}
    />
  )
}
