import { useStore } from "@/core/state/store"
import { parseCommand } from "./parser"
import type { ParsedCommand } from "./parser"
import { commands, aliasMap, findByAlias } from "./registry"
import { addLocalEvent } from "./helpers"
import { eventBus, scriptCommands } from "@/core/scripts"

const MAX_ALIAS_DEPTH = 10

/** Expand a user alias template with positional args and context variables. */
function expandAlias(template: string, args: string[], connectionId: string): string {
  let body = template

  // Auto-append $* if body contains no $ references
  if (!body.includes("$")) {
    body += " $*"
  }

  // Context variables
  const s = useStore.getState()
  const conn = s.connections.get(connectionId)
  const buf = s.activeBufferId ? s.buffers.get(s.activeBufferId) : null

  body = body.replace(/\$\{?C\}?/g, buf?.name ?? "")
  body = body.replace(/\$\{?N\}?/g, conn?.nick ?? "")
  body = body.replace(/\$\{?S\}?/g, conn?.label ?? "")
  body = body.replace(/\$\{?T\}?/g, buf?.name ?? "")

  // Range args: $0-, $1-, $2-, etc.
  body = body.replace(/\$(\d)-/g, (_match, n) => {
    const idx = parseInt(n, 10)
    return args.slice(idx).join(" ")
  })

  // $* — all args
  body = body.replace(/\$\*/g, args.join(" "))

  // Single positional: $0 .. $9
  body = body.replace(/\$(\d)/g, (_match, n) => {
    const idx = parseInt(n, 10)
    return args[idx] ?? ""
  })

  return body.trim()
}

export function executeCommand(parsed: ParsedCommand, connectionId: string, depth = 0): boolean {
  // Recursion guard
  if (depth > MAX_ALIAS_DEPTH) {
    addLocalEvent(`%Zf7768eAlias recursion limit reached (max ${MAX_ALIAS_DEPTH})%N`)
    return false
  }

  // Emit command_input event (scripts can intercept/block commands)
  if (depth === 0) {
    const proceed = eventBus.emit("command_input", {
      command: parsed.command,
      args: parsed.args,
      connectionId,
    })
    if (!proceed) return true // script stopped propagation
  }

  // 1. Built-in command or built-in alias
  const def = commands[parsed.command] ?? findByAlias(parsed.command)
  if (def) {
    def.handler(parsed.args, connectionId)
    return true
  }

  // 2. Script command
  const scriptCmd = scriptCommands.get(parsed.command)
  if (scriptCmd) {
    scriptCmd.def.handler(parsed.args, connectionId)
    return true
  }

  // 3. User alias
  const config = useStore.getState().config
  const aliasBody = config?.aliases[parsed.command]
  if (aliasBody) {
    const expanded = expandAlias(aliasBody, parsed.args, connectionId)
    // Split by ; for command chaining
    const parts = expanded.split(";").map((p) => p.trim()).filter(Boolean)
    for (const part of parts) {
      const sub = parseCommand(part)
      if (sub) {
        executeCommand(sub, connectionId, depth + 1)
      }
    }
    return true
  }

  // 4. Unknown
  addLocalEvent(`%Zf7768eUnknown command: /${parsed.command}. Type /help for available commands.%N`)
  return false
}

/** All registered command names + built-in aliases + script commands + user aliases, sorted. For tab completion. */
export function getCommandNames(): string[] {
  const names = Object.keys(commands)
  for (const alias of Object.keys(aliasMap)) {
    names.push(alias)
  }
  for (const name of scriptCommands.keys()) {
    names.push(name)
  }
  const userAliases = useStore.getState().config?.aliases ?? {}
  for (const name of Object.keys(userAliases)) {
    names.push(name)
  }
  return names.sort()
}
