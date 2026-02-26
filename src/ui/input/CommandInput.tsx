import { useState, useRef, useCallback } from "react"
import { useStore } from "@/core/state/store"
import { parseCommand, executeCommand } from "@/core/commands"
import { getClient } from "@/core/irc"
import { useKeyboard } from "@opentui/react"
import type { InputRenderable } from "@opentui/core"

export function CommandInput() {
  const [value, setValue] = useState("")
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<InputRenderable>(null)

  // Tab completion state
  const tabState = useRef<{
    prefix: string       // the partial nick typed by user
    matches: string[]    // sorted matching nicks
    index: number        // current position in matches cycle
    textBefore: string   // text before the word being completed
    isStartOfLine: boolean
  } | null>(null)

  const buffer = useStore((s) => s.activeBufferId ? s.buffers.get(s.activeBufferId) : null)
  const addMessage = useStore((s) => s.addMessage)
  const colors = useStore((s) => s.theme?.colors)

  const handleSubmit = useCallback((submittedValue?: string | unknown) => {
    const text = typeof submittedValue === "string" ? submittedValue : value
    const trimmed = text.trim()
    if (!trimmed) return

    setHistory((h) => [trimmed, ...h].slice(0, 100))
    setHistoryIndex(-1)
    setValue("")
    // Force clear via ref in case React state sync is delayed
    if (inputRef.current) {
      inputRef.current.value = ""
      inputRef.current.focus()
    }

    if (!buffer) return

    const parsed = parseCommand(trimmed)

    if (parsed) {
      executeCommand(parsed, buffer.connectionId)
    } else {
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
  }, [value, buffer, addMessage])

  const handleTabCompletion = useCallback(() => {
    if (!buffer) return

    const currentValue = inputRef.current?.value ?? value
    const nicks = Array.from(buffer.users.keys())
    if (nicks.length === 0) return

    let state = tabState.current

    if (state) {
      // Continue cycling through matches
      state.index = (state.index + 1) % state.matches.length
    } else {
      // Start new tab completion
      // Find the last word (partial nick) in the input
      const spaceIdx = currentValue.lastIndexOf(" ")
      const textBefore = spaceIdx >= 0 ? currentValue.slice(0, spaceIdx + 1) : ""
      const partial = spaceIdx >= 0 ? currentValue.slice(spaceIdx + 1) : currentValue
      const isStartOfLine = spaceIdx < 0

      if (!partial) return

      const lower = partial.toLowerCase()
      const matches = nicks
        .filter((n) => n.toLowerCase().startsWith(lower))
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

      if (matches.length === 0) return

      state = { prefix: partial, matches, index: 0, textBefore, isStartOfLine }
      tabState.current = state
    }

    const nick = state.matches[state.index]
    // At start of line: "nick: " (like irssi), mid-line: just "nick "
    const suffix = state.isStartOfLine ? ": " : " "
    const completed = state.textBefore + nick + suffix

    setValue(completed)
    if (inputRef.current) inputRef.current.value = completed
  }, [value, buffer])

  const resetTabState = useCallback(() => {
    tabState.current = null
  }, [])

  useKeyboard((key) => {
    if (key.eventType !== "press") return

    // Ensure input stays focused on any keypress
    if (inputRef.current) inputRef.current.focus()

    if (key.name === "tab") {
      handleTabCompletion()
      return
    }

    // Any non-tab key resets tab completion cycling
    resetTabState()

    if (key.name === "up") {
      if (history.length > 0) {
        const newIdx = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(newIdx)
        const val = history[newIdx]
        setValue(val)
        if (inputRef.current) inputRef.current.value = val
      }
    }
    if (key.name === "down") {
      if (historyIndex > 0) {
        const newIdx = historyIndex - 1
        setHistoryIndex(newIdx)
        const val = history[newIdx]
        setValue(val)
        if (inputRef.current) inputRef.current.value = val
      } else {
        setHistoryIndex(-1)
        setValue("")
        if (inputRef.current) inputRef.current.value = ""
      }
    }
  })

  const prompt = buffer ? `[${buffer.name}] > ` : "> "

  return (
    <box flexDirection="row" width="100%">
      <text><span fg={colors?.fg_muted ?? "#565f89"}>{prompt}</span></text>
      <input
        ref={inputRef}
        value={value}
        onChange={(v: string) => {
          setValue(v)
          // Reset tab state when user types (onChange fires on character input, not tab)
          resetTabState()
        }}
        onSubmit={handleSubmit}
        focused
        flexGrow={1}
        backgroundColor="transparent"
        textColor={colors?.fg ?? "#c0caf5"}
        cursorColor={colors?.cursor ?? "#7aa2f7"}
      />
    </box>
  )
}
