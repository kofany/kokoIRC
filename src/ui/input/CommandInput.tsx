import { useState } from "react"
import { useStore } from "@/core/state/store"
import { parseCommand, executeCommand } from "@/core/commands"
import { getClient } from "@/core/irc"
import { useKeyboard } from "@opentui/react"

export function CommandInput() {
  const [value, setValue] = useState("")
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const buffer = useStore((s) => s.activeBufferId ? s.buffers.get(s.activeBufferId) : null)
  const addMessage = useStore((s) => s.addMessage)

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return

    setHistory((h) => [trimmed, ...h].slice(0, 100))
    setHistoryIndex(-1)
    setValue("")

    if (!buffer) return

    const parsed = parseCommand(trimmed)

    if (parsed) {
      executeCommand(parsed, buffer.connectionId)
    } else {
      // Plain text -> send to active buffer
      const client = getClient(buffer.connectionId)
      if (client) {
        client.say(buffer.name, trimmed)
        const conn = useStore.getState().connections.get(buffer.connectionId)
        addMessage(buffer.id, {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "message",
          nick: conn?.nick ?? "",
          nickMode: "",
          text: trimmed,
          highlight: false,
        })
      }
    }
  }

  useKeyboard((key) => {
    if (key.name === "up" && key.eventType === "press") {
      if (history.length > 0) {
        const newIdx = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(newIdx)
        setValue(history[newIdx])
      }
    }
    if (key.name === "down" && key.eventType === "press") {
      if (historyIndex > 0) {
        const newIdx = historyIndex - 1
        setHistoryIndex(newIdx)
        setValue(history[newIdx])
      } else {
        setHistoryIndex(-1)
        setValue("")
      }
    }
    if (key.name === "return" && key.eventType === "press") {
      handleSubmit()
    }
  })

  const prompt = buffer ? `[${buffer.name}] > ` : "> "

  return (
    <box flexDirection="row" width="100%">
      <text><span fg="#5555ff">{prompt}</span></text>
      <input
        value={value}
        onChange={setValue}
        focused
        flexGrow={1}
        backgroundColor="transparent"
        textColor="#ffffff"
        cursorColor="#55ffff"
      />
    </box>
  )
}
