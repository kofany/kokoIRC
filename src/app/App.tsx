import { useEffect } from "react"
import { useRenderer, useKeyboard } from "@opentui/react"
import { useStore } from "@/core/state/store"
import { loadConfig } from "@/core/config/loader"
import { loadTheme } from "@/core/theme/loader"
import { connectAllAutoconnect } from "@/core/irc"
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

  useKeyboard((key) => {
    if (key.name === "q" && key.ctrl) {
      renderer.destroy()
    }
  })

  useEffect(() => {
    async function init() {
      const config = await loadConfig("config/config.toml")
      setConfig(config)

      const themePath = `themes/${config.general.theme}.theme`
      const theme = await loadTheme(themePath)
      setTheme(theme)

      connectAllAutoconnect()
    }
    init().catch((err) => console.error("[init]", err))
  }, [])

  // Show loading state until config is loaded
  if (!config) {
    return (
      <box width="100%" height="100%" justifyContent="center" alignItems="center" backgroundColor="#1a1b26">
        <text><span fg="#565f89">Loading...</span></text>
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
