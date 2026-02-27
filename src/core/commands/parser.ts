export interface ParsedCommand {
  command: string
  args: string[]
}

const GREEDY_COMMANDS = new Set(["msg", "notice", "me", "quit", "topic", "kick", "close"])

export function parseCommand(input: string): ParsedCommand | null {
  if (!input.startsWith("/")) return null

  const trimmed = input.slice(1)
  const spaceIndex = trimmed.indexOf(" ")

  if (spaceIndex === -1) {
    return { command: trimmed.toLowerCase(), args: [] }
  }

  const command = trimmed.slice(0, spaceIndex).toLowerCase()
  const rest = trimmed.slice(spaceIndex + 1).trim()

  if (GREEDY_COMMANDS.has(command)) {
    if (command === "me" || command === "quit" || command === "close") {
      return { command, args: [rest] }
    }
    const firstSpace = rest.indexOf(" ")
    if (firstSpace === -1) {
      return { command, args: [rest] }
    }
    return { command, args: [rest.slice(0, firstSpace), rest.slice(firstSpace + 1)] }
  }

  return { command, args: rest.split(/\s+/) }
}
