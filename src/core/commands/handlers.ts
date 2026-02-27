import { getClient } from "@/core/irc"
import { useStore } from "@/core/state/store"
import { loadConfig } from "@/core/config/loader"
import { loadTheme } from "@/core/theme/loader"
import { makeBufferId, BufferType } from "@/types"
import type { ParsedCommand } from "./parser"

type Handler = (args: string[], connectionId: string) => void

export interface CommandDef {
  handler: Handler
  description: string
  usage: string
  aliases?: string[]
}

/** Display a local event message in the active buffer. */
function addLocalEvent(text: string) {
  const s = useStore.getState()
  const buf = s.activeBufferId
  if (!buf) return
  s.addMessage(buf, {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type: "event",
    text,
    highlight: false,
  })
}

// ─── Command Registry ────────────────────────────────────────

export const commands: Record<string, CommandDef> = {
  help: {
    handler(args) {
      if (args[0]) {
        const name = args[0].replace(/^\//, "").toLowerCase()
        const def = commands[name] ?? findByAlias(name)
        if (!def) {
          addLocalEvent(`%Zf7768eUnknown command: ${name}%N`)
          return
        }
        const canonical = getCanonicalName(name)
        const lines = [
          `%Z7aa2f7───── /${canonical} ─────────────────────────────%N`,
          `  %Zc0caf5${def.usage}%N`,
          `  %Za9b1d6${def.description}%N`,
        ]
        if (def.aliases?.length) {
          lines.push(`  %Z565f89Aliases: ${def.aliases.map((a) => "/" + a).join(", ")}%N`)
        }
        lines.push(`%Z7aa2f7─────────────────────────────────────────%N`)
        for (const line of lines) addLocalEvent(line)
      } else {
        const sorted = Object.keys(commands).sort()
        addLocalEvent(`%Z7aa2f7───── Commands ─────────────────────────────%N`)
        for (const name of sorted) {
          const padded = ("/" + name).padEnd(15)
          addLocalEvent(`  %Z7aa2f7${padded}%Z565f89${commands[name].description}%N`)
        }
        addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────%N`)
        addLocalEvent(`  %Z565f89Type %Z7aa2f7/help <command>%Z565f89 for detailed usage%N`)
      }
    },
    description: "Show help for commands",
    usage: "/help [command]",
  },

  join: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client) return
      const [channel, key] = args
      if (!channel) {
        addLocalEvent(`%Zf7768eUsage: /join <channel> [key]%N`)
        return
      }
      client.join(channel, key)
    },
    description: "Join a channel",
    usage: "/join <channel> [key]",
    aliases: ["j"],
  },

  part: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client) return
      const s = useStore.getState()
      const buf = s.activeBufferId ? s.buffers.get(s.activeBufferId) : null
      const channel = args[0] || buf?.name
      const message = args[1]
      if (channel) client.part(channel, message)
    },
    description: "Leave a channel",
    usage: "/part [channel] [message]",
  },

  msg: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client || args.length < 2) {
        addLocalEvent(`%Zf7768eUsage: /msg <target> <message>%N`)
        return
      }
      client.say(args[0], args[1])
    },
    description: "Send a private message",
    usage: "/msg <target> <message>",
  },

  me: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client) return
      const s = useStore.getState()
      const buf = s.activeBufferId ? s.buffers.get(s.activeBufferId) : null
      if (buf && args[0]) {
        client.action(buf.name, args[0])
      }
    },
    description: "Send an action message",
    usage: "/me <action>",
  },

  nick: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client || !args[0]) {
        addLocalEvent(`%Zf7768eUsage: /nick <newnick>%N`)
        return
      }
      client.changeNick(args[0])
    },
    description: "Change your nickname",
    usage: "/nick <newnick>",
  },

  quit: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client) return
      client.quit(args[0] ?? "OpenTUI IRC")
    },
    description: "Disconnect from server",
    usage: "/quit [message]",
  },

  topic: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client) return
      const s = useStore.getState()
      const buf = s.activeBufferId ? s.buffers.get(s.activeBufferId) : null
      if (args.length >= 2) {
        client.setTopic(args[0], args[1])
      } else if (buf && args[0]) {
        client.setTopic(buf.name, args[0])
      }
    },
    description: "Set or view channel topic",
    usage: "/topic [channel] <text>",
  },

  notice: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client || args.length < 2) {
        addLocalEvent(`%Zf7768eUsage: /notice <target> <message>%N`)
        return
      }
      client.notice(args[0], args[1])
    },
    description: "Send a notice",
    usage: "/notice <target> <message>",
  },

  close: {
    handler(args, connId) {
      const s = useStore.getState()
      const buf = s.activeBufferId ? s.buffers.get(s.activeBufferId) : null
      if (!buf) return

      if (buf.type === BufferType.Channel) {
        const client = getClient(connId)
        if (client) {
          client.part(buf.name, args[0] ?? "Window closed")
        }
        // Buffer removed by the part event handler
      } else if (buf.type === BufferType.Query) {
        s.removeBuffer(buf.id)
      } else if (buf.type === BufferType.Server) {
        addLocalEvent(`%Ze0af68Cannot close server buffer%N`)
      }
    },
    description: "Close current buffer",
    usage: "/close [reason]",
  },

  whois: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client || !args[0]) {
        addLocalEvent(`%Zf7768eUsage: /whois <nick>%N`)
        return
      }
      client.whois(args[0])
    },
    description: "Look up user information",
    usage: "/whois <nick>",
    aliases: ["wi"],
  },

  wii: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client || !args[0]) {
        addLocalEvent(`%Zf7768eUsage: /wii <nick>%N`)
        return
      }
      // WHOIS nick nick → server returns idle time from remote server
      client.raw(`WHOIS ${args[0]} ${args[0]}`)
    },
    description: "Whois with idle time",
    usage: "/wii <nick>",
  },

  mode: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client) return
      if (args.length === 0) {
        const conn = useStore.getState().connections.get(connId)
        if (conn) client.raw(`MODE ${conn.nick}`)
      } else {
        client.raw(`MODE ${args.join(" ")}`)
      }
    },
    description: "Set or query channel/user modes",
    usage: "/mode [target] [+/-modes] [params]",
  },

  reload: {
    async handler() {
      try {
        const s = useStore.getState()
        const config = await loadConfig("config/config.toml")
        s.setConfig(config)

        const themePath = `themes/${config.general.theme}.theme`
        const theme = await loadTheme(themePath)
        s.setTheme(theme)

        addLocalEvent(`%Z9ece6aTheme and config reloaded%N`)
      } catch (err: any) {
        addLocalEvent(`%Zf7768eReload failed: ${err.message}%N`)
      }
    },
    description: "Reload theme and config",
    usage: "/reload",
  },
}

// ─── Alias Resolution ────────────────────────────────────────

const aliasMap: Record<string, string> = {}
for (const [name, def] of Object.entries(commands)) {
  if (def.aliases) {
    for (const alias of def.aliases) {
      aliasMap[alias] = name
    }
  }
}

function findByAlias(name: string): CommandDef | undefined {
  const canonical = aliasMap[name]
  return canonical ? commands[canonical] : undefined
}

function getCanonicalName(name: string): string {
  return aliasMap[name] ?? name
}

// ─── Public API ──────────────────────────────────────────────

export function executeCommand(parsed: ParsedCommand, connectionId: string): boolean {
  const def = commands[parsed.command] ?? findByAlias(parsed.command)
  if (!def) {
    addLocalEvent(`%Zf7768eUnknown command: /${parsed.command}. Type /help for available commands.%N`)
    return false
  }
  def.handler(parsed.args, connectionId)
  return true
}

/** All registered command names + aliases, sorted. For tab completion. */
export function getCommandNames(): string[] {
  const names = Object.keys(commands)
  for (const alias of Object.keys(aliasMap)) {
    names.push(alias)
  }
  return names.sort()
}
