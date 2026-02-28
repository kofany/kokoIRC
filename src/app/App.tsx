import { useState, useEffect, useCallback } from "react"
import { useRenderer, useKeyboard } from "@opentui/react"
import { useStore } from "@/core/state/store"
import { loadConfig } from "@/core/config/loader"
import { loadTheme } from "@/core/theme/loader"
import { connectAllAutoconnect } from "@/core/irc"
import { CONFIG_PATH, THEME_PATH } from "@/core/constants"
import { loadAllDocs } from "@/core/commands"
import { BufferType } from "@/types"
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

  useKeyboard((key) => {
    if (key.name === "q" && key.ctrl) {
      renderer.destroy()
    }
  })

  // Register shutdown handler so commands can close the app
  useEffect(() => {
    useStore.getState().setShutdownHandler(() => renderer.destroy())
  }, [renderer])

  // Load config + theme during splash (but don't connect yet)
  useEffect(() => {
    async function init() {
      const config = await loadConfig(CONFIG_PATH)
      setConfig(config)

      const themePath = THEME_PATH(config.general.theme)
      const theme = await loadTheme(themePath)
      setTheme(theme)

      await loadAllDocs()
    }
    init().catch((err) => console.error("[init]", err))
  }, [])

  // After splash finishes → connect and switch to Status window
  const handleSplashDone = useCallback(() => {
    setShowSplash(false)
    connectAllAutoconnect()
    // Activate first Status buffer so user sees connection progress
    const s = useStore.getState()
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
