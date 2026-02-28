import { useState, useRef, useCallback, useEffect } from "react"
import { useStore } from "@/core/state/store"
import { parseCommand, executeCommand, getCommandNames, getSubcommands } from "@/core/commands"
import { getClient } from "@/core/irc"
import { useKeyboard, useRenderer } from "@opentui/react"
import { useStatusbarColors } from "@/ui/hooks/useStatusbarColors"
import type { InputRenderable } from "@opentui/core"

export function CommandInput() {
  const renderer = useRenderer()
  const [value, setValue] = useState("")
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const inputRef = useRef<InputRenderable>(null)

  // Auto-copy selected text to clipboard, then clear selection and refocus input
  useEffect(() => {
    const handleSelection = (selection: any) => {
      if (!selection || selection.isDragging) return
      const text = selection.getSelectedText()
      if (text) {
        renderer.copyToClipboardOSC52(text)
      }
      // Clear selection highlight and return focus to input for immediate Cmd+V
      renderer.clearSelection()
      if (inputRef.current) inputRef.current.focus()
    }
    renderer.on("selection", handleSelection)
    return () => { renderer.off("selection", handleSelection) }
  }, [renderer])

  // Tab completion state
  const tabState = useRef<{
    prefix: string       // the partial text typed by user
    matches: string[]    // sorted matching candidates
    index: number        // current position in matches cycle
    textBefore: string   // text before the word being completed
    isStartOfLine: boolean
    isCommand: boolean   // true = completing /command, false = completing nick
    isSubcommand: boolean // true = completing subcommand after /command
  } | null>(null)

  const buffer = useStore((s) => s.activeBufferId ? s.buffers.get(s.activeBufferId) : null)
  const conn = useStore((s) => {
    const buf = s.activeBufferId ? s.buffers.get(s.activeBufferId) : null
    return buf ? s.connections.get(buf.connectionId) : null
  })
  const addMessage = useStore((s) => s.addMessage)
  const sb = useStatusbarColors()

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

  const tryNickCompletion = (currentValue: string) => {
    if (!buffer) return null
    const nicks = Array.from(buffer.users.keys())
    if (nicks.length === 0) return null

    const spaceIdx = currentValue.lastIndexOf(" ")
    const textBefore = spaceIdx >= 0 ? currentValue.slice(0, spaceIdx + 1) : ""
    const partial = spaceIdx >= 0 ? currentValue.slice(spaceIdx + 1) : currentValue
    const isStartOfLine = spaceIdx < 0

    if (!partial) return null

    const lower = partial.toLowerCase()
    const matches = nicks
      .filter((n) => n.toLowerCase().startsWith(lower))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

    if (matches.length === 0) return null

    const s = { prefix: partial, matches, index: 0, textBefore, isStartOfLine, isCommand: false, isSubcommand: false }
    tabState.current = s
    return s
  }

  const handleTabCompletion = useCallback(() => {
    const currentValue = inputRef.current?.value ?? value
    let state = tabState.current

    if (state) {
      // Continue cycling through matches
      state.index = (state.index + 1) % state.matches.length
    } else {
      // ── Command completion: "/par" → "/part "
      if (currentValue.startsWith("/") && !currentValue.includes(" ")) {
        const partial = currentValue.slice(1).toLowerCase()
        if (!partial) return
        const cmdNames = getCommandNames()
        const matches = cmdNames.filter((n) => n.startsWith(partial))
        if (matches.length === 0) return
        state = { prefix: partial, matches, index: 0, textBefore: "/", isStartOfLine: false, isCommand: true, isSubcommand: false }
        tabState.current = state
      } else if (currentValue.startsWith("/") && currentValue.includes(" ")) {
        // ── Subcommand completion: "/server li" → "/server list "
        const firstSpace = currentValue.indexOf(" ")
        const afterSpace = currentValue.slice(firstSpace + 1)
        // Only complete if there's no second space (still typing first subcommand arg)
        if (!afterSpace.includes(" ")) {
          const cmdName = currentValue.slice(1, firstSpace).toLowerCase()
          const partial = afterSpace.toLowerCase()
          const subs = getSubcommands(cmdName)
          if (subs.length > 0) {
            const matches = partial ? subs.filter((s) => s.startsWith(partial)) : subs
            if (matches.length > 0) {
              state = { prefix: partial, matches, index: 0, textBefore: currentValue.slice(0, firstSpace + 1), isStartOfLine: false, isCommand: false, isSubcommand: true }
              tabState.current = state
            }
          }
        }
        // Fall through to nick completion if no subcommand matches
        if (!state) {
          state = tryNickCompletion(currentValue)
        }
      } else {
        state = tryNickCompletion(currentValue)
      }
    }

    if (!state) return

    if (state.isCommand) {
      const completed = "/" + state.matches[state.index] + " "
      setValue(completed)
      if (inputRef.current) inputRef.current.value = completed
    } else if (state.isSubcommand) {
      const completed = state.textBefore + state.matches[state.index] + " "
      setValue(completed)
      if (inputRef.current) inputRef.current.value = completed
    } else {
      const nick = state.matches[state.index]
      const suffix = state.isStartOfLine ? ": " : " "
      const completed = state.textBefore + nick + suffix
      setValue(completed)
      if (inputRef.current) inputRef.current.value = completed
    }
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

  // Build prompt from config template: $channel, $nick, $buffer, $server
  const promptTemplate = sb.prompt
  const prompt = promptTemplate
    .replace("$server", conn?.label ?? "")
    .replace("$channel", buffer?.name ?? "")
    .replace("$nick", conn?.nick ?? "")
    .replace("$buffer", buffer?.name ?? "")

  return (
    <box flexDirection="row" width="100%" backgroundColor={sb.bg}>
      <text><span fg={sb.promptColor}>{prompt}</span></text>
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
        backgroundColor={sb.bg}
        textColor={sb.inputColor}
        cursorColor={sb.cursorColor}
      />
    </box>
  )
}
