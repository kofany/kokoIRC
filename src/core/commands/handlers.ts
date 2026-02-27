import { getClient, connectServer, disconnectServer, getAllClientIds } from "@/core/irc"
import { useStore } from "@/core/state/store"
import { loadConfig, saveConfig, saveCredentialsToEnv } from "@/core/config/loader"
import { loadTheme } from "@/core/theme/loader"
import { makeBufferId, BufferType } from "@/types"
import type { ServerConfig } from "@/types/config"
import { parseCommand } from "./parser"
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

/** Switch to a connection's Status buffer. */
function switchToStatusBuffer(connId: string) {
  const s = useStore.getState()
  const statusId = makeBufferId(connId, "Status")
  if (s.buffers.has(statusId)) {
    s.setActiveBuffer(statusId)
  }
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
      let [channel, key] = args
      if (!channel) {
        addLocalEvent(`%Zf7768eUsage: /join <channel> [key]%N`)
        return
      }
      // Auto-prefix # unless it already has a valid channel prefix (RFC 2811: #, &, !, +)
      if (!/^[#&!+]/.test(channel)) {
        channel = "#" + channel
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

  server: {
    async handler(args) {
      const sub = args[0]?.toLowerCase()

      if (!sub || sub === "list") {
        // /server list — show all configured servers and their status
        const s = useStore.getState()
        const servers = s.config?.servers ?? {}
        addLocalEvent(`%Z7aa2f7───── Servers ─────────────────────────────%N`)
        if (Object.keys(servers).length === 0) {
          addLocalEvent(`  %Z565f89No servers configured%N`)
        } else {
          for (const [id, srv] of Object.entries(servers)) {
            const conn = s.connections.get(id)
            const status = conn?.status ?? "disconnected"
            const statusColor = status === "connected" ? "#9ece6a"
              : status === "connecting" ? "#e0af68" : "#f7768e"
            const bindInfo = srv.bind_ip ? ` %Z565f89bind:${srv.bind_ip}%N` : ""
            addLocalEvent(
              `  %Z7aa2f7${id.padEnd(12)}%N %Za9b1d6${srv.label}%N %Z565f89(${srv.address}:${srv.port})%N %Z${statusColor.slice(1)}${status}%N${bindInfo}`
            )
          }
        }
        addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────%N`)
        return
      }

      if (sub === "add") {
        // /server add <id> <address>[:<port>] [options...]
        // Options: -tls -noauto -bind=<ip> -nick=<nick> -password=<pass> -sasl=<user>:<pass> -label=<label>
        const id = args[1]?.toLowerCase()
        const addrArg = args[2]
        if (!id || !addrArg) {
          addLocalEvent(`%Zf7768eUsage: /server add <id> <address>[:<port>] [-tls] [-noauto] [-bind=<ip>] [-label=<name>] [-password=<pass>] [-sasl=<user>:<pass>]%N`)
          return
        }

        // Parse address:port
        let address = addrArg
        let port = 6667
        let tls = false
        const colonIdx = addrArg.lastIndexOf(":")
        if (colonIdx > 0) {
          const portStr = addrArg.slice(colonIdx + 1)
          if (/^\d+$/.test(portStr)) {
            address = addrArg.slice(0, colonIdx)
            port = parseInt(portStr, 10)
          }
        }

        // Parse flags
        let autoconnect = true
        let bind_ip: string | undefined
        let nick: string | undefined
        let password: string | undefined
        let sasl_user: string | undefined
        let sasl_pass: string | undefined
        let label = id
        let tls_verify = true

        for (let i = 3; i < args.length; i++) {
          const a = args[i]
          if (a === "-tls") { tls = true; if (port === 6667) port = 6697 }
          else if (a === "-noauto") autoconnect = false
          else if (a === "-notlsverify") tls_verify = false
          else if (a.startsWith("-bind=")) bind_ip = a.slice(6)
          else if (a.startsWith("-nick=")) nick = a.slice(6)
          else if (a.startsWith("-password=")) password = a.slice(10)
          else if (a.startsWith("-label=")) label = a.slice(7)
          else if (a.startsWith("-sasl=")) {
            const saslParts = a.slice(6).split(":")
            sasl_user = saslParts[0]
            sasl_pass = saslParts.slice(1).join(":")
          }
        }

        const serverConfig: ServerConfig = {
          label,
          address,
          port,
          tls,
          tls_verify,
          autoconnect,
          channels: [],
          nick,
          bind_ip,
          sasl_user,
        }

        // Save to config
        const s = useStore.getState()
        const config = s.config
        if (!config) return
        config.servers[id] = serverConfig
        s.setConfig({ ...config })

        try {
          await saveConfig("config/config.toml", config)
          // Save credentials to .env
          if (password || sasl_pass) {
            await saveCredentialsToEnv(id, { password, sasl_pass, sasl_user })
          }
          addLocalEvent(`%Z9ece6aServer '${id}' added: ${address}:${port}${tls ? " (TLS)" : ""}${bind_ip ? " bind:" + bind_ip : ""}%N`)
        } catch (err: any) {
          addLocalEvent(`%Zf7768eFailed to save config: ${err.message}%N`)
        }
        return
      }

      if (sub === "remove" || sub === "del") {
        const id = args[1]?.toLowerCase()
        if (!id) {
          addLocalEvent(`%Zf7768eUsage: /server remove <id>%N`)
          return
        }
        const s = useStore.getState()
        const config = s.config
        if (!config || !config.servers[id]) {
          addLocalEvent(`%Zf7768eServer '${id}' not found%N`)
          return
        }

        // Disconnect if connected
        disconnectServer(id, "Server removed")

        delete config.servers[id]
        s.setConfig({ ...config })

        try {
          await saveConfig("config/config.toml", config)
          addLocalEvent(`%Z9ece6aServer '${id}' removed%N`)
        } catch (err: any) {
          addLocalEvent(`%Zf7768eFailed to save config: ${err.message}%N`)
        }
        return
      }

      addLocalEvent(`%Zf7768eUnknown subcommand: /server ${sub}. Use: list, add, remove%N`)
    },
    description: "Manage servers (add/list/remove)",
    usage: "/server [list|add|remove] [args...]",
  },

  connect: {
    handler(args) {
      const target = args[0]
      if (!target) {
        addLocalEvent(`%Zf7768eUsage: /connect <server-id|address>[:<port>] [-tls] [-bind=<ip>]%N`)
        return
      }

      const s = useStore.getState()
      const config = s.config
      if (!config) return

      // First try matching by server id (label)
      const serverId = target.toLowerCase()
      let serverConfig = config.servers[serverId]

      if (!serverConfig) {
        // Try matching by label
        for (const [id, srv] of Object.entries(config.servers)) {
          if (srv.label.toLowerCase() === serverId) {
            serverConfig = srv
            connectServer(id, srv)
            switchToStatusBuffer(id)
            return
          }
        }
      }

      if (serverConfig) {
        // Apply runtime overrides from flags
        const overrides: Partial<ServerConfig> = {}
        for (let i = 1; i < args.length; i++) {
          const a = args[i]
          if (a === "-tls") overrides.tls = true
          else if (a.startsWith("-bind=")) overrides.bind_ip = a.slice(6)
        }
        const merged = { ...serverConfig, ...overrides }
        connectServer(serverId, merged)
        switchToStatusBuffer(serverId)
        return
      }

      // Not in config — treat as ad-hoc address
      let address = target
      let port = 6667
      let tls = false
      const colonIdx = target.lastIndexOf(":")
      if (colonIdx > 0) {
        const portStr = target.slice(colonIdx + 1)
        if (/^\d+$/.test(portStr)) {
          address = target.slice(0, colonIdx)
          port = parseInt(portStr, 10)
        }
      }

      let bind_ip: string | undefined
      for (let i = 1; i < args.length; i++) {
        const a = args[i]
        if (a === "-tls") { tls = true; if (port === 6667) port = 6697 }
        else if (a.startsWith("-bind=")) bind_ip = a.slice(6)
      }

      // Generate temporary id from address
      const tempId = address.replace(/[^a-zA-Z0-9]/g, "_")
      const adhocConfig: ServerConfig = {
        label: address,
        address,
        port,
        tls,
        tls_verify: true,
        autoconnect: false,
        channels: [],
        bind_ip,
      }

      connectServer(tempId, adhocConfig)
      switchToStatusBuffer(tempId)
    },
    description: "Connect to a server by id, label, or address",
    usage: "/connect <server-id|address>[:<port>] [-tls] [-bind=<ip>]",
    aliases: ["c"],
  },

  set: {
    async handler(args) {
      const s = useStore.getState()
      const config = s.config
      if (!config) return

      // /set — list all settings
      if (args.length === 0) {
        listAllSettings(config)
        return
      }

      const path = args[0]

      // /set <path> — show current value
      const resolved = getConfigValue(config, path)
      if (!resolved) {
        addLocalEvent(`%Zf7768eUnknown setting: ${path}%N`)
        return
      }

      if (!args[1]) {
        const display = resolved.isCredential ? "***" : formatValue(resolved.value)
        const envTag = resolved.isCredential ? " %Z565f89[.env]%N" : ""
        addLocalEvent(`%Z7aa2f7${path}%N = %Zc0caf5${display}%N${envTag}`)
        return
      }

      // /set <path> <value> — set value
      const rawValue = args[1]
      const coerced = coerceValue(rawValue, resolved.value)
      if (coerced === undefined) {
        addLocalEvent(`%Zf7768eCannot coerce '${rawValue}' to ${typeof resolved.value}%N`)
        return
      }

      // Apply in-memory
      setConfigValue(config, path, coerced)
      s.setConfig({ ...config })

      // Persist
      try {
        if (resolved.isCredential && resolved.serverId) {
          const creds: Record<string, string | undefined> = {}
          creds[resolved.field] = String(coerced)
          await saveCredentialsToEnv(resolved.serverId, creds)
          addLocalEvent(`%Z9ece6a${path}%N = %Zc0caf5***%N %Z565f89[saved to .env]%N`)
        } else {
          await saveConfig("config/config.toml", config)
          addLocalEvent(`%Z9ece6a${path}%N = %Zc0caf5${formatValue(coerced)}%N`)
        }

        // Theme change → auto-reload
        if (path === "general.theme") {
          const themePath = `themes/${coerced}.theme`
          const theme = await loadTheme(themePath)
          s.setTheme(theme)
          addLocalEvent(`%Z9ece6aTheme '${coerced}' loaded%N`)
        }
      } catch (err: any) {
        addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
      }
    },
    description: "View or change configuration",
    usage: "/set [section.field] [value]",
  },

  alias: {
    async handler(args) {
      const s = useStore.getState()
      const config = s.config
      if (!config) return

      // /alias — list all
      if (args.length === 0) {
        const entries = Object.entries(config.aliases)
        if (entries.length === 0) {
          addLocalEvent(`%Z565f89No aliases defined%N`)
          return
        }
        addLocalEvent(`%Z7aa2f7───── Aliases ─────────────────────────────────%N`)
        for (const [name, body] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
          addLocalEvent(`  %Z7aa2f7${name.padEnd(16)}%N= %Zc0caf5${body.replace(/%/g, "%%")}%N`)
        }
        addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────────%N`)
        return
      }

      const name = args[0]

      // /alias -name — remove
      if (name.startsWith("-")) {
        const aliasName = name.slice(1).toLowerCase()
        if (!config.aliases[aliasName]) {
          addLocalEvent(`%Zf7768eAlias '${aliasName}' not found%N`)
          return
        }
        delete config.aliases[aliasName]
        s.setConfig({ ...config })
        try {
          await saveConfig("config/config.toml", config)
          addLocalEvent(`%Z9ece6aAlias '${aliasName}' removed%N`)
        } catch (err: any) {
          addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
        }
        return
      }

      const aliasName = name.toLowerCase()

      // /alias name — show one
      if (!args[1]) {
        const body = config.aliases[aliasName]
        if (!body) {
          addLocalEvent(`%Zf7768eAlias '${aliasName}' not found%N`)
          return
        }
        addLocalEvent(`%Z7aa2f7${aliasName}%N = %Zc0caf5${body.replace(/%/g, "%%")}%N`)
        return
      }

      // /alias name body — create/overwrite
      const body = args[1]

      // Protect built-in commands
      if (commands[aliasName] || aliasMap[aliasName]) {
        addLocalEvent(`%Zf7768eCannot override built-in command '${aliasName}'%N`)
        return
      }

      config.aliases[aliasName] = body
      s.setConfig({ ...config })
      try {
        await saveConfig("config/config.toml", config)
        addLocalEvent(`%Z9ece6aAlias '${aliasName}' = %Zc0caf5${body.replace(/%/g, "%%")}%N`)
      } catch (err: any) {
        addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
      }
    },
    description: "Define, list, or remove user aliases",
    usage: "/alias [[-]name] [body]",
  },

  unalias: {
    async handler(args) {
      if (!args[0]) {
        addLocalEvent(`%Zf7768eUsage: /unalias <name>%N`)
        return
      }
      const s = useStore.getState()
      const config = s.config
      if (!config) return

      const aliasName = args[0].toLowerCase()
      if (!config.aliases[aliasName]) {
        addLocalEvent(`%Zf7768eAlias '${aliasName}' not found%N`)
        return
      }
      delete config.aliases[aliasName]
      s.setConfig({ ...config })
      try {
        await saveConfig("config/config.toml", config)
        addLocalEvent(`%Z9ece6aAlias '${aliasName}' removed%N`)
      } catch (err: any) {
        addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
      }
    },
    description: "Remove a user alias",
    usage: "/unalias <name>",
  },

  disconnect: {
    handler(args, connId) {
      const target = args[0]?.toLowerCase()
      const message = args.slice(1).join(" ") || "Leaving"

      if (target) {
        // Disconnect specific server
        const s = useStore.getState()
        if (s.connections.has(target)) {
          disconnectServer(target, message)
          addLocalEvent(`%Ze0af68Disconnected from ${target}%N`)
        } else {
          // Try by label
          for (const [id, conn] of s.connections) {
            if (conn.label.toLowerCase() === target) {
              disconnectServer(id, message)
              addLocalEvent(`%Ze0af68Disconnected from ${conn.label}%N`)
              return
            }
          }
          addLocalEvent(`%Zf7768eServer '${target}' not found%N`)
        }
      } else {
        // Disconnect current server
        disconnectServer(connId, message)
        addLocalEvent(`%Ze0af68Disconnected from current server%N`)
      }
    },
    description: "Disconnect from a server",
    usage: "/disconnect [server-id] [message]",
  },
}

// ─── /set helpers ───────────────────────────────────────────

const CREDENTIAL_FIELDS = new Set(["password", "sasl_pass"])

interface ResolvedConfig {
  value: any
  field: string
  isCredential: boolean
  serverId?: string
}

/** Resolve a dot-path like "general.nick" or "servers.ircnet.port" to the config value. */
function getConfigValue(config: import("@/types/config").AppConfig, path: string): ResolvedConfig | null {
  const parts = path.split(".")
  if (parts.length < 2) return null

  const section = parts[0]

  // servers.<id>.<field>
  if (section === "servers") {
    if (parts.length < 3) return null
    const serverId = parts[1]
    const field = parts.slice(2).join(".")
    const server = config.servers[serverId]
    if (!server || !(field in server)) return null
    return {
      value: (server as any)[field],
      field,
      isCredential: CREDENTIAL_FIELDS.has(field),
      serverId,
    }
  }

  // aliases.<name> — allow creating new aliases via /set
  if (section === "aliases") {
    if (parts.length < 2) return null
    const name = parts[1]
    const value = config.aliases[name] ?? ""
    return { value, field: name, isCredential: false }
  }

  // sidepanel.left.<field> / sidepanel.right.<field>
  if (section === "sidepanel") {
    if (parts.length < 3) return null
    const side = parts[1] as "left" | "right"
    const field = parts[2]
    const panel = config.sidepanel?.[side]
    if (!panel || !(field in panel)) return null
    return { value: (panel as any)[field], field, isCredential: false }
  }

  // general.<field>, display.<field>, statusbar.<field>
  const field = parts.slice(1).join(".")
  const obj = (config as any)[section]
  if (!obj || typeof obj !== "object" || !(field in obj)) return null
  return { value: obj[field], field, isCredential: false }
}

/** Set a value in the config object in-place. */
function setConfigValue(config: import("@/types/config").AppConfig, path: string, value: any): void {
  const parts = path.split(".")
  const section = parts[0]

  if (section === "aliases" && parts.length >= 2) {
    config.aliases[parts[1]] = String(value)
    return
  }

  if (section === "servers" && parts.length >= 3) {
    const server = config.servers[parts[1]]
    if (server) (server as any)[parts.slice(2).join(".")] = value
    return
  }

  if (section === "sidepanel" && parts.length >= 3) {
    const panel = (config.sidepanel as any)?.[parts[1]]
    if (panel) panel[parts[2]] = value
    return
  }

  const field = parts.slice(1).join(".")
  const obj = (config as any)[section]
  if (obj) obj[field] = value
}

/** Coerce a raw string value to match the type of the existing value. */
function coerceValue(raw: string, existing: any): any {
  if (typeof existing === "boolean") {
    if (raw === "true") return true
    if (raw === "false") return false
    return undefined
  }
  if (typeof existing === "number") {
    const n = Number(raw)
    return isNaN(n) ? undefined : n
  }
  if (Array.isArray(existing)) {
    return raw.split(",").map((s) => s.trim())
  }
  return raw
}

/** Format a value for display. Escapes % so the theme parser doesn't eat color codes. */
function formatValue(v: any): string {
  const raw = Array.isArray(v) ? v.join(", ") : String(v)
  return raw.replace(/%/g, "%%")
}

/** Display all settings grouped by section. */
function listAllSettings(config: import("@/types/config").AppConfig): void {
  addLocalEvent(`%Z7aa2f7───── Settings ─────────────────────────────────%N`)

  const showSection = (label: string, prefix: string, obj: Record<string, any>) => {
    addLocalEvent(`%Z565f89[${label}]%N`)
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "object" && val !== null && !Array.isArray(val)) continue
      const fullPath = `${prefix}.${key}`
      const isCredential = CREDENTIAL_FIELDS.has(key)
      const display = isCredential ? "***" : formatValue(val)
      const envTag = isCredential ? " %Z565f89[.env]%N" : ""
      addLocalEvent(`  %Z7aa2f7${fullPath.padEnd(32)}%N= %Zc0caf5${display}%N${envTag}`)
    }
  }

  showSection("general", "general", config.general)
  showSection("display", "display", config.display)
  showSection("sidepanel.left", "sidepanel.left", config.sidepanel.left)
  showSection("sidepanel.right", "sidepanel.right", config.sidepanel.right)
  showSection("statusbar", "statusbar", config.statusbar)

  if (Object.keys(config.aliases).length > 0) {
    showSection("aliases", "aliases", config.aliases)
  }

  for (const [id, srv] of Object.entries(config.servers)) {
    showSection(`servers.${id}`, `servers.${id}`, srv)
  }

  addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────────%N`)
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

// ─── User Alias Expansion ────────────────────────────────────

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

// ─── Public API ──────────────────────────────────────────────

export function executeCommand(parsed: ParsedCommand, connectionId: string, depth = 0): boolean {
  // Recursion guard
  if (depth > MAX_ALIAS_DEPTH) {
    addLocalEvent(`%Zf7768eAlias recursion limit reached (max ${MAX_ALIAS_DEPTH})%N`)
    return false
  }

  // 1. Built-in command or built-in alias
  const def = commands[parsed.command] ?? findByAlias(parsed.command)
  if (def) {
    def.handler(parsed.args, connectionId)
    return true
  }

  // 2. User alias
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

  // 3. Unknown
  addLocalEvent(`%Zf7768eUnknown command: /${parsed.command}. Type /help for available commands.%N`)
  return false
}

/** All registered command names + built-in aliases + user aliases, sorted. For tab completion. */
export function getCommandNames(): string[] {
  const names = Object.keys(commands)
  for (const alias of Object.keys(aliasMap)) {
    names.push(alias)
  }
  const userAliases = useStore.getState().config?.aliases ?? {}
  for (const name of Object.keys(userAliases)) {
    names.push(name)
  }
  return names.sort()
}
