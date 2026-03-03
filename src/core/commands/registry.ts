import { getClient, connectServer, disconnectServer, getAllClientIds } from "@/core/irc"
import { useStore } from "@/core/state/store"
import { loadConfig, saveConfig, saveCredentialsToEnv, cloneConfig } from "@/core/config/loader"
import { loadTheme } from "@/core/theme/loader"
import { BufferType, makeBufferId, ActivityLevel } from "@/types"
import { DEFAULT_ITEM_FORMATS, ALL_IGNORE_LEVELS, type ServerConfig, type StatusbarItem, type IgnoreLevel, type IgnoreEntry } from "@/types/config"
import { DEFAULT_CONFIG } from "@/core/config/defaults"
import { CONFIG_PATH, THEME_PATH, LOG_DB_PATH } from "@/core/constants"
import {
  loadScript,
  unloadScript,
  reloadScript,
  getLoadedScripts,
  getAvailableScripts,
} from "@/core/scripts/manager"
import type { CommandDef } from "./types"
import {
  addLocalEvent,
  switchToStatusBuffer,
  getActiveChannel,
  getConfigValue,
  setConfigValue,
  coerceValue,
  formatValue,
  listAllSettings,
} from "./helpers"
import { showCommandList, showCommandHelp, showSubcommandHelp } from "./help-formatter"
import { searchMessages, getStats, isStorageActive } from "@/core/storage"

// ─── List mode command factory ────────────────────────────────

function makeListModeCommands(opts: {
  addCmd: string
  removeCmd: string
  modeChar: string
  listLabel: string
}): { add: CommandDef; remove: CommandDef } {
  const { addCmd, removeCmd, modeChar, listLabel } = opts

  const add: CommandDef = {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client) return
      const channel = getActiveChannel()
      if (!channel) { addLocalEvent(`%Zf7768eNo active channel%N`); return }

      if (args.length === 0) {
        // No args → request list from server
        client.raw(`MODE ${channel} +${modeChar}`)
        return
      }
      // With args → set mode
      client.raw(`MODE ${channel} +${modeChar} ${args.join(" ")}`)
    },
    description: `Add to ${listLabel.toLowerCase()} (no args: show list)`,
    usage: `/${addCmd} [mask]`,
  }

  const remove: CommandDef = {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client) return
      const channel = getActiveChannel()
      if (!channel) { addLocalEvent(`%Zf7768eNo active channel%N`); return }

      if (args.length === 0) {
        addLocalEvent(`%Zf7768eUsage: /${removeCmd} <number|mask> [number2 ...]%N`)
        return
      }

      const s = useStore.getState()
      const buf = s.activeBufferId ? s.buffers.get(s.activeBufferId) : null
      const entries = buf?.listModes.get(modeChar) ?? []

      // Collect masks to remove
      const masks: string[] = []
      for (const arg of args) {
        const num = parseInt(arg, 10)
        if (!isNaN(num) && arg === String(num)) {
          // Numeric reference (1-based)
          if (num < 1 || num > entries.length) {
            addLocalEvent(`%Zf7768e${listLabel} #${num} out of range (1-${entries.length})%N`)
            return
          }
          masks.push(entries[num - 1].mask)
        } else {
          // Treat as mask/wildcard
          masks.push(arg)
        }
      }

      for (const mask of masks) {
        client.raw(`MODE ${channel} -${modeChar} ${mask}`)
      }
    },
    description: `Remove from ${listLabel.toLowerCase()}`,
    usage: `/${removeCmd} <number|mask> [number2 ...]`,
  }

  return { add, remove }
}

// ─── Command Registry ────────────────────────────────────────

const banCmds = makeListModeCommands({ addCmd: "ban", removeCmd: "unban", modeChar: "b", listLabel: "Ban list" })
const exceptCmds = makeListModeCommands({ addCmd: "except", removeCmd: "unexcept", modeChar: "e", listLabel: "Exception list" })
const invexCmds = makeListModeCommands({ addCmd: "invex", removeCmd: "uninvex", modeChar: "I", listLabel: "Invite exception list" })
const reopCmds = makeListModeCommands({ addCmd: "reop", removeCmd: "unreop", modeChar: "R", listLabel: "Reop list" })

export const commands: Record<string, CommandDef> = {
  help: {
    handler(args) {
      if (args.length >= 2) {
        const cmd = args[0].replace(/^\//, "").toLowerCase()
        const sub = args[1].toLowerCase()
        showSubcommandHelp(cmd, sub)
      } else if (args[0]) {
        const name = args[0].replace(/^\//, "").toLowerCase()
        showCommandHelp(name)
      } else {
        showCommandList()
      }
    },
    description: "Show help for commands",
    usage: "/help [command] [subcommand]",
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
      const [target, message] = args
      client.say(target, message)

      const s = useStore.getState()
      const conn = s.connections.get(connId)
      const isChannel = /^[#&!+]/.test(target)
      const bufferId = makeBufferId(connId, target)

      // For private messages, open a query window if not already open
      if (!isChannel && !s.buffers.has(bufferId)) {
        s.addBuffer({
          id: bufferId,
          connectionId: connId,
          type: BufferType.Query,
          name: target,
          messages: [],
          activity: ActivityLevel.None,
          unreadCount: 0,
          lastRead: new Date(),
          users: new Map(),
          listModes: new Map(),
        })
      }

      // Show the sent message in the target buffer
      if (s.buffers.has(bufferId)) {
        s.addMessage(bufferId, {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "message",
          nick: conn?.nick ?? "",
          nickMode: "",
          text: message,
          highlight: false,
        })
        // Switch to the query window so user sees the conversation
        if (!isChannel) {
          s.setActiveBuffer(bufferId)
        }
      }
    },
    description: "Send a message to a user or channel",
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
        const conn = s.connections.get(connId)
        s.addMessage(buf.id, {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "action",
          nick: conn?.nick ?? "",
          text: args[0],
          highlight: false,
        })
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
    handler(args) {
      const reason = args.join(" ") || "kIRC"
      const ids = getAllClientIds()
      for (const id of ids) {
        disconnectServer(id, reason)
      }
      // Give IRC a moment to send QUIT, then close the app
      setTimeout(() => useStore.getState().requestShutdown(), 300)
    },
    description: "Quit all connections and close kIRC",
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
        // No args: query own user modes
        const conn = useStore.getState().connections.get(connId)
        if (conn) client.raw(`MODE ${conn.nick}`)
      } else if (/^[+-]/.test(args[0])) {
        // First arg starts with +/- → mode change for active channel
        const channel = getActiveChannel()
        if (!channel) {
          addLocalEvent(`%Zf7768eNo active channel for /mode%N`)
          return
        }
        client.raw(`MODE ${channel} ${args.join(" ")}`)
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
        const config = await loadConfig(CONFIG_PATH)
        s.setConfig(config)

        const themePath = THEME_PATH(config.general.theme)
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
        const id = args[1]?.toLowerCase()
        const addrArg = args[2]
        if (!id || !addrArg) {
          addLocalEvent(`%Zf7768eUsage: /server add <id> <address>[:<port>] [-tls] [-noauto] [-bind=<ip>] [-label=<name>] [-password=<pass>] [-sasl=<user>:<pass>]%N`)
          return
        }

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

        const s = useStore.getState()
        if (!s.config) return
        const config = cloneConfig(s.config)
        config.servers[id] = serverConfig
        s.setConfig(config)

        try {
          await saveConfig(CONFIG_PATH, config)
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
        if (!s.config || !s.config.servers[id]) {
          addLocalEvent(`%Zf7768eServer '${id}' not found%N`)
          return
        }

        disconnectServer(id, "Server removed")

        const config = cloneConfig(s.config)
        delete config.servers[id]
        s.setConfig(config)

        try {
          await saveConfig(CONFIG_PATH, config)
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

      const serverId = target.toLowerCase()
      let serverConfig = config.servers[serverId]

      if (!serverConfig) {
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
      if (!s.config) return

      if (args.length === 0) {
        listAllSettings(s.config)
        return
      }

      const path = args[0]

      const resolved = getConfigValue(s.config, path)
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

      const rawValue = args[1]
      const coerced = coerceValue(rawValue, resolved.value)
      if (coerced === undefined) {
        addLocalEvent(`%Zf7768eCannot coerce '${rawValue}' to ${typeof resolved.value}%N`)
        return
      }

      const config = cloneConfig(s.config)
      setConfigValue(config, path, coerced)
      s.setConfig(config)

      try {
        if (resolved.isCredential && resolved.serverId) {
          const creds: Record<string, string | undefined> = {}
          creds[resolved.field] = String(coerced)
          await saveCredentialsToEnv(resolved.serverId, creds)
          addLocalEvent(`%Z9ece6a${path}%N = %Zc0caf5***%N %Z565f89[saved to .env]%N`)
        } else {
          await saveConfig(CONFIG_PATH, config)
          addLocalEvent(`%Z9ece6a${path}%N = %Zc0caf5${formatValue(coerced)}%N`)
        }

        if (path === "general.theme") {
          const themePath = THEME_PATH(coerced)
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
      if (!s.config) return

      if (args.length === 0) {
        const entries = Object.entries(s.config.aliases)
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

      if (name.startsWith("-")) {
        const aliasName = name.slice(1).toLowerCase()
        if (!s.config.aliases[aliasName]) {
          addLocalEvent(`%Zf7768eAlias '${aliasName}' not found%N`)
          return
        }
        const config = cloneConfig(s.config)
        delete config.aliases[aliasName]
        s.setConfig(config)
        try {
          await saveConfig(CONFIG_PATH, config)
          addLocalEvent(`%Z9ece6aAlias '${aliasName}' removed%N`)
        } catch (err: any) {
          addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
        }
        return
      }

      const aliasName = name.toLowerCase()

      if (!args[1]) {
        const body = s.config.aliases[aliasName]
        if (!body) {
          addLocalEvent(`%Zf7768eAlias '${aliasName}' not found%N`)
          return
        }
        addLocalEvent(`%Z7aa2f7${aliasName}%N = %Zc0caf5${body.replace(/%/g, "%%")}%N`)
        return
      }

      const body = args[1]

      if (commands[aliasName] || aliasMap[aliasName]) {
        addLocalEvent(`%Zf7768eCannot override built-in command '${aliasName}'%N`)
        return
      }

      const config = cloneConfig(s.config)
      config.aliases[aliasName] = body
      s.setConfig(config)
      try {
        await saveConfig(CONFIG_PATH, config)
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
      if (!s.config) return

      const aliasName = args[0].toLowerCase()
      if (!s.config.aliases[aliasName]) {
        addLocalEvent(`%Zf7768eAlias '${aliasName}' not found%N`)
        return
      }
      const config = cloneConfig(s.config)
      delete config.aliases[aliasName]
      s.setConfig(config)
      try {
        await saveConfig(CONFIG_PATH, config)
        addLocalEvent(`%Z9ece6aAlias '${aliasName}' removed%N`)
      } catch (err: any) {
        addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
      }
    },
    description: "Remove a user alias",
    usage: "/unalias <name>",
  },

  op: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client || !args[0]) {
        addLocalEvent(`%Zf7768eUsage: /op <nick> [nick2 ...]%N`)
        return
      }
      const channel = getActiveChannel()
      if (!channel) { addLocalEvent(`%Zf7768eNo active channel%N`); return }
      const modes = "+" + "o".repeat(args.length)
      client.raw(`MODE ${channel} ${modes} ${args.join(" ")}`)
    },
    description: "Give operator status",
    usage: "/op <nick> [nick2 ...]",
  },

  deop: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client || !args[0]) {
        addLocalEvent(`%Zf7768eUsage: /deop <nick> [nick2 ...]%N`)
        return
      }
      const channel = getActiveChannel()
      if (!channel) { addLocalEvent(`%Zf7768eNo active channel%N`); return }
      const modes = "-" + "o".repeat(args.length)
      client.raw(`MODE ${channel} ${modes} ${args.join(" ")}`)
    },
    description: "Remove operator status",
    usage: "/deop <nick> [nick2 ...]",
  },

  voice: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client || !args[0]) {
        addLocalEvent(`%Zf7768eUsage: /voice <nick> [nick2 ...]%N`)
        return
      }
      const channel = getActiveChannel()
      if (!channel) { addLocalEvent(`%Zf7768eNo active channel%N`); return }
      const modes = "+" + "v".repeat(args.length)
      client.raw(`MODE ${channel} ${modes} ${args.join(" ")}`)
    },
    description: "Give voice status",
    usage: "/voice <nick> [nick2 ...]",
    aliases: ["v"],
  },

  devoice: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client || !args[0]) {
        addLocalEvent(`%Zf7768eUsage: /devoice <nick> [nick2 ...]%N`)
        return
      }
      const channel = getActiveChannel()
      if (!channel) { addLocalEvent(`%Zf7768eNo active channel%N`); return }
      const modes = "-" + "v".repeat(args.length)
      client.raw(`MODE ${channel} ${modes} ${args.join(" ")}`)
    },
    description: "Remove voice status",
    usage: "/devoice <nick> [nick2 ...]",
  },

  kick: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client || !args[0]) {
        addLocalEvent(`%Zf7768eUsage: /kick <nick> [reason]%N`)
        return
      }
      const channel = getActiveChannel()
      if (!channel) { addLocalEvent(`%Zf7768eNo active channel%N`); return }
      const reason = args[1] || args[0]
      client.raw(`KICK ${channel} ${args[0]} :${reason}`)
    },
    description: "Kick a user from the channel",
    usage: "/kick <nick> [reason]",
    aliases: ["k"],
  },

  ban: { ...banCmds.add, aliases: ["b"] },
  unban: banCmds.remove,
  except: exceptCmds.add,
  unexcept: exceptCmds.remove,
  invex: invexCmds.add,
  uninvex: invexCmds.remove,
  reop: reopCmds.add,
  unreop: reopCmds.remove,

  kb: {
    handler(args, connId) {
      const client = getClient(connId)
      if (!client || !args[0]) {
        addLocalEvent(`%Zf7768eUsage: /kb <nick> [reason]%N`)
        return
      }
      const channel = getActiveChannel()
      if (!channel) { addLocalEvent(`%Zf7768eNo active channel%N`); return }
      const nick = args[0]
      const reason = args[1] || nick

      // Fetch ident@host via USERHOST for a proper ban mask
      const onReply = (event: { command: string; params: string[] }) => {
        if (event.command !== "302") return
        client.off("unknown command", onReply)
        clearTimeout(timer)

        // RPL_USERHOST format: "nick[*]=<+|->ident@host"
        const reply = event.params.slice(1).join(" ")
        const match = reply.match(/=[-+](\S+)@(\S+)/)

        // Kick first, then ban
        client.raw(`KICK ${channel} ${nick} :${reason}`)
        if (match) {
          client.raw(`MODE ${channel} +b *!*${match[1]}@${match[2]}`)
        } else {
          client.raw(`MODE ${channel} +b ${nick}!*@*`)
        }
      }

      client.on("unknown command", onReply)
      client.raw(`USERHOST ${nick}`)

      // Fallback: if no USERHOST reply in 5s, kick+ban with nick-based mask
      const timer = setTimeout(() => {
        client.off("unknown command", onReply)
        client.raw(`KICK ${channel} ${nick} :${reason}`)
        client.raw(`MODE ${channel} +b ${nick}!*@*`)
      }, 5000)
    },
    description: "Kickban a user (kick then ban *!*ident@host)",
    usage: "/kb <nick> [reason]",
    aliases: ["kickban"],
  },

  items: {
    async handler(args) {
      const s = useStore.getState()
      if (!s.config) return
      const sub = args[0]?.toLowerCase()
      const validItems = Object.keys(DEFAULT_ITEM_FORMATS) as StatusbarItem[]

      if (!sub || sub === "list") {
        const currentItems = s.config.statusbar.items
        addLocalEvent(`%Z7aa2f7───── Statusbar Items ─────────────────────%N`)
        for (let i = 0; i < currentItems.length; i++) {
          const fmt = s.config.statusbar.item_formats?.[currentItems[i]] ?? DEFAULT_ITEM_FORMATS[currentItems[i] as StatusbarItem] ?? ""
          addLocalEvent(`  %Z7aa2f7${(i + 1).toString().padEnd(3)}%Za9b1d6${currentItems[i].padEnd(18)}%Z565f89${fmt}%N`)
        }
        addLocalEvent(`  %Z565f89Separator:%N %Zc0caf5"${s.config.statusbar.separator}"%N`)
        addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────%N`)
        return
      }

      if (sub === "available") {
        const current = new Set(s.config.statusbar.items)
        addLocalEvent(`%Z7aa2f7───── Available Items ────────────────────%N`)
        for (const item of validItems) {
          const active = current.has(item) ? "%Z9ece6a●%N" : "%Z565f89○%N"
          const fmt = DEFAULT_ITEM_FORMATS[item]
          addLocalEvent(`  ${active} %Za9b1d6${item.padEnd(18)}%Z565f89${fmt}%N`)
        }
        addLocalEvent(`  %Z565f89Variables: $win $activity $nick $modes $name $lag $time%N`)
        addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────%N`)
        return
      }

      if (sub === "add") {
        const item = args[1]?.toLowerCase()
        if (!item) {
          addLocalEvent(`%Zf7768eUsage: /items add <item>%N`)
          return
        }
        if (!validItems.includes(item as StatusbarItem)) {
          addLocalEvent(`%Zf7768eUnknown item: ${item}. Available: ${validItems.join(", ")}%N`)
          return
        }
        if (s.config.statusbar.items.includes(item as StatusbarItem)) {
          addLocalEvent(`%Ze0af68Item '${item}' already in statusbar%N`)
          return
        }
        const config = cloneConfig(s.config)
        config.statusbar.items = [...config.statusbar.items, item as StatusbarItem]
        s.setConfig(config)
        try {
          await saveConfig(CONFIG_PATH, config)
          addLocalEvent(`%Z9ece6aAdded '${item}' to statusbar%N`)
        } catch (err: any) {
          addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
        }
        return
      }

      if (sub === "remove" || sub === "del") {
        const item = args[1]?.toLowerCase()
        if (!item) {
          addLocalEvent(`%Zf7768eUsage: /items remove <item>%N`)
          return
        }
        if (!s.config.statusbar.items.includes(item as StatusbarItem)) {
          addLocalEvent(`%Zf7768eItem '${item}' not in statusbar%N`)
          return
        }
        const config = cloneConfig(s.config)
        config.statusbar.items = config.statusbar.items.filter((i) => i !== item)
        s.setConfig(config)
        try {
          await saveConfig(CONFIG_PATH, config)
          addLocalEvent(`%Z9ece6aRemoved '${item}' from statusbar%N`)
        } catch (err: any) {
          addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
        }
        return
      }

      if (sub === "move") {
        const item = args[1]?.toLowerCase()
        const pos = parseInt(args[2], 10)
        if (!item || isNaN(pos)) {
          addLocalEvent(`%Zf7768eUsage: /items move <item> <position>%N`)
          return
        }
        const currentItems = [...s.config.statusbar.items]
        const idx = currentItems.indexOf(item as StatusbarItem)
        if (idx === -1) {
          addLocalEvent(`%Zf7768eItem '${item}' not in statusbar%N`)
          return
        }
        currentItems.splice(idx, 1)
        const newIdx = Math.max(0, Math.min(currentItems.length, pos - 1))
        currentItems.splice(newIdx, 0, item as StatusbarItem)
        const config = cloneConfig(s.config)
        config.statusbar.items = currentItems
        s.setConfig(config)
        try {
          await saveConfig(CONFIG_PATH, config)
          addLocalEvent(`%Z9ece6aMoved '${item}' to position ${newIdx + 1}%N`)
        } catch (err: any) {
          addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
        }
        return
      }

      if (sub === "separator" || sub === "sep") {
        if (args.length <= 1) {
          addLocalEvent(`%Z565f89Current separator:%N %Zc0caf5"${s.config.statusbar.separator}"%N`)
          return
        }
        const config = cloneConfig(s.config)
        config.statusbar.separator = args.slice(1).join(" ")
        s.setConfig(config)
        try {
          await saveConfig(CONFIG_PATH, config)
          addLocalEvent(`%Z9ece6aSeparator set to "%Zc0caf5${config.statusbar.separator}%Z9ece6a"%N`)
        } catch (err: any) {
          addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
        }
        return
      }

      if (sub === "format" || sub === "fmt") {
        const item = args[1]?.toLowerCase()
        if (!item) {
          addLocalEvent(`%Zf7768eUsage: /items format <item> [format_string]%N`)
          addLocalEvent(`%Z565f89Variables: $win, $activity, $nick, $modes, $name, $lag, $time%N`)
          return
        }
        if (!validItems.includes(item as StatusbarItem)) {
          addLocalEvent(`%Zf7768eUnknown item: ${item}%N`)
          return
        }
        if (args.length <= 2) {
          const fmt = s.config.statusbar.item_formats?.[item] ?? DEFAULT_ITEM_FORMATS[item as StatusbarItem]
          addLocalEvent(`%Z7aa2f7${item}%N format: %Zc0caf5${fmt}%N`)
          const defaultFmt = DEFAULT_ITEM_FORMATS[item as StatusbarItem]
          if (s.config.statusbar.item_formats?.[item]) {
            addLocalEvent(`  %Z565f89Default: ${defaultFmt}%N`)
          }
          return
        }
        const formatStr = args.slice(2).join(" ")
        const config = cloneConfig(s.config)
        config.statusbar.item_formats[item] = formatStr
        s.setConfig(config)
        try {
          await saveConfig(CONFIG_PATH, config)
          addLocalEvent(`%Z9ece6a${item}%N format set to: %Zc0caf5${formatStr}%N`)
        } catch (err: any) {
          addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
        }
        return
      }

      if (sub === "reset") {
        const config = cloneConfig(s.config)
        config.statusbar.items = [...DEFAULT_CONFIG.statusbar.items]
        config.statusbar.item_formats = {}
        config.statusbar.separator = DEFAULT_CONFIG.statusbar.separator
        s.setConfig(config)
        try {
          await saveConfig(CONFIG_PATH, config)
          addLocalEvent(`%Z9ece6aStatusbar reset to defaults%N`)
        } catch (err: any) {
          addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
        }
        return
      }

      addLocalEvent(`%Zf7768eUnknown subcommand: /items ${sub}%N`)
      addLocalEvent(`%Z565f89Use: list, add, remove, move, format, separator, available, reset%N`)
    },
    description: "Manage statusbar items and formats",
    usage: "/items [list|add|remove|move|format|separator|available|reset] [args...]",
  },

  ignore: {
    async handler(args) {
      const s = useStore.getState()
      if (!s.config) return

      // No args: list current ignores
      if (args.length === 0) {
        const ignores = s.config.ignores
        if (ignores.length === 0) {
          addLocalEvent(`%Z565f89No ignore rules defined%N`)
          return
        }
        addLocalEvent(`%Z7aa2f7───── Ignore list ─────────────────────────────%N`)
        for (let i = 0; i < ignores.length; i++) {
          const e = ignores[i]
          const chans = e.channels?.length ? ` %Z565f89channels: ${e.channels.join(",")}%N` : ""
          addLocalEvent(`  %Ze0af68${i + 1}.%N %Zc0caf5${e.mask}%N %Z565f89[${e.levels.join(", ")}]%N${chans}`)
        }
        addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────────%N`)
        return
      }

      // Parse: /ignore <mask> [levels...] [-channels #a,#b]
      const mask = args[0]
      let levels: IgnoreLevel[] = []
      let channels: string[] | undefined

      for (let i = 1; i < args.length; i++) {
        if (args[i] === "-channels" && i + 1 < args.length) {
          channels = args[i + 1].split(",").map((c) => c.trim()).filter(Boolean)
          i++ // skip next arg
        } else {
          const upper = args[i].toUpperCase() as IgnoreLevel
          if (ALL_IGNORE_LEVELS.includes(upper)) {
            levels.push(upper)
          } else {
            addLocalEvent(`%Zf7768eUnknown ignore level: ${args[i]}%N`)
            addLocalEvent(`%Z565f89Valid levels: ${ALL_IGNORE_LEVELS.join(", ")}%N`)
            return
          }
        }
      }

      // Default to ALL if no levels specified
      if (levels.length === 0) levels = ["ALL"]

      const entry: IgnoreEntry = { mask, levels }
      if (channels?.length) entry.channels = channels

      const config = cloneConfig(s.config)
      config.ignores.push(entry)
      s.setConfig(config)

      try {
        await saveConfig(CONFIG_PATH, config)
      } catch (err: any) {
        addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
      }

      const chansStr = channels?.length ? ` in ${channels.join(",")}` : ""
      addLocalEvent(`%Z9ece6aIgnoring%N %Zc0caf5${mask}%N %Z565f89[${levels.join(", ")}]${chansStr}%N`)
    },
    description: "Add an ignore rule",
    usage: "/ignore [mask] [levels...] [-channels #a,#b]",
  },

  unignore: {
    async handler(args) {
      const s = useStore.getState()
      if (!s.config) return

      if (args.length === 0) {
        addLocalEvent(`%Zf7768eUsage: /unignore <number|mask>%N`)
        return
      }

      const config = cloneConfig(s.config)
      const input = args[0]
      const num = parseInt(input, 10)
      let removed: IgnoreEntry | undefined

      if (!isNaN(num) && num >= 1 && num <= config.ignores.length) {
        // Remove by 1-based index
        removed = config.ignores.splice(num - 1, 1)[0]
      } else {
        // Remove by exact mask match
        const idx = config.ignores.findIndex((e) => e.mask.toLowerCase() === input.toLowerCase())
        if (idx !== -1) {
          removed = config.ignores.splice(idx, 1)[0]
        }
      }

      if (!removed) {
        addLocalEvent(`%Zf7768eNo ignore rule matching '${input}'%N`)
        return
      }

      s.setConfig(config)

      try {
        await saveConfig(CONFIG_PATH, config)
      } catch (err: any) {
        addLocalEvent(`%Zf7768eFailed to save: ${err.message}%N`)
      }

      addLocalEvent(`%Z9ece6aRemoved ignore:%N %Zc0caf5${removed.mask}%N %Z565f89[${removed.levels.join(", ")}]%N`)
    },
    description: "Remove an ignore rule",
    usage: "/unignore <number|mask>",
  },

  script: {
    async handler(args) {
      const sub = args[0]?.toLowerCase()

      if (!sub || sub === "list") {
        const scripts = getLoadedScripts()
        addLocalEvent(`%Z7aa2f7───── Loaded Scripts ─────────────────────%N`)
        if (scripts.length === 0) {
          addLocalEvent(`  %Z565f89No scripts loaded%N`)
        } else {
          for (const s of scripts) {
            const ver = s.meta.version ? ` %Z565f89v${s.meta.version}%N` : ""
            const desc = s.meta.description ? ` — %Z565f89${s.meta.description}%N` : ""
            addLocalEvent(`  %Z9ece6a●%N %Za9b1d6${s.name}%N${ver}${desc}`)
          }
        }
        addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────%N`)
        return
      }

      if (sub === "available") {
        const scripts = await getAvailableScripts()
        addLocalEvent(`%Z7aa2f7───── Available Scripts ───────────────────%N`)
        if (scripts.length === 0) {
          addLocalEvent(`  %Z565f89No scripts in ~/.kokoirc/scripts/%N`)
        } else {
          for (const s of scripts) {
            const status = s.loaded ? "%Z9ece6a●%N" : "%Z565f89○%N"
            addLocalEvent(`  ${status} %Za9b1d6${s.name}%N`)
          }
        }
        addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────%N`)
        return
      }

      if (sub === "load") {
        const name = args[1]
        if (!name) {
          addLocalEvent(`%Zf7768eUsage: /script load <name|path>%N`)
          return
        }
        const result = await loadScript(name)
        if (result.ok) {
          addLocalEvent(`%Z9ece6aScript '${result.name}' loaded%N`)
        } else {
          addLocalEvent(`%Zf7768e${result.error}%N`)
        }
        return
      }

      if (sub === "unload") {
        const name = args[1]
        if (!name) {
          addLocalEvent(`%Zf7768eUsage: /script unload <name>%N`)
          return
        }
        if (unloadScript(name)) {
          addLocalEvent(`%Z9ece6aScript '${name}' unloaded%N`)
        } else {
          addLocalEvent(`%Zf7768eScript '${name}' is not loaded%N`)
        }
        return
      }

      if (sub === "reload") {
        const name = args[1]
        if (!name) {
          addLocalEvent(`%Zf7768eUsage: /script reload <name>%N`)
          return
        }
        const result = await reloadScript(name)
        if (result.ok) {
          addLocalEvent(`%Z9ece6aScript '${result.name}' reloaded%N`)
        } else {
          addLocalEvent(`%Zf7768e${result.error}%N`)
        }
        return
      }

      addLocalEvent(`%Zf7768eUnknown subcommand: /script ${sub}%N`)
      addLocalEvent(`%Z565f89Use: list, available, load, unload, reload%N`)
    },
    description: "Manage scripts (load/unload/reload/list)",
    usage: "/script [list|available|load|unload|reload] [name]",
  },

  log: {
    async handler(args, connId) {
      const sub = args[0]?.toLowerCase()

      if (!sub || sub === "status") {
        if (!isStorageActive()) {
          addLocalEvent(`%Z565f89Logging is disabled%N`)
          return
        }
        const stats = getStats()
        if (!stats) {
          addLocalEvent(`%Zf7768eDatabase not available%N`)
          return
        }
        const sizeKB = (stats.dbSizeBytes / 1024).toFixed(1)
        const sizeMB = (stats.dbSizeBytes / (1024 * 1024)).toFixed(1)
        const sizeStr = stats.dbSizeBytes > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`
        const config = useStore.getState().config
        const encrypted = config?.logging.encrypt ? "%Ze0af68encrypted%N" : "%Z9ece6aplain text%N"

        addLocalEvent(`%Z7aa2f7───── Log Status ─────────────────────────%N`)
        addLocalEvent(`  Messages: %Zc0caf5${stats.messageCount.toLocaleString()}%N`)
        addLocalEvent(`  Database: %Zc0caf5${sizeStr}%N`)
        addLocalEvent(`  Mode:     ${encrypted}`)
        addLocalEvent(`  Path:     %Z565f89${LOG_DB_PATH}%N`)
        addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────%N`)
        return
      }

      if (sub === "search") {
        const query = args.slice(1).join(" ")
        if (!query) {
          addLocalEvent(`%Zf7768eUsage: /log search <query>%N`)
          return
        }
        if (!isStorageActive()) {
          addLocalEvent(`%Zf7768eLogging is disabled%N`)
          return
        }
        const config = useStore.getState().config
        if (config?.logging.encrypt) {
          addLocalEvent(`%Zf7768eSearch is not available in encrypted mode%N`)
          return
        }

        const s = useStore.getState()
        const buf = s.activeBufferId ? s.buffers.get(s.activeBufferId) : null
        const slashIdx = s.activeBufferId?.indexOf("/") ?? -1
        const network = slashIdx > 0 ? s.activeBufferId!.slice(0, slashIdx) : undefined
        const buffer = buf?.name?.toLowerCase()

        const results = await searchMessages(query, network, buffer)
        if (results.length === 0) {
          addLocalEvent(`%Z565f89No results for "${query}"%N`)
          return
        }

        addLocalEvent(`%Z7aa2f7───── Search: ${query} (${results.length} results) ────%N`)
        for (const msg of results.slice(-20)) {
          const time = new Date(msg.timestamp).toLocaleTimeString()
          const nick = msg.nick ? `%Za9b1d6<${msg.nick}>%N ` : ""
          addLocalEvent(`  %Z565f89${time}%N ${nick}${msg.text}`)
        }
        addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────%N`)
        return
      }

      addLocalEvent(`%Zf7768eUnknown subcommand: /log ${sub}%N`)
      addLocalEvent(`%Z565f89Use: status, search%N`)
    },
    description: "Chat log management (search, status)",
    usage: "/log [status|search] [query]",
  },

  disconnect: {
    handler(args, connId) {
      const target = args[0]?.toLowerCase()
      const message = args.slice(1).join(" ") || "Leaving"

      if (target) {
        const s = useStore.getState()
        if (s.connections.has(target)) {
          disconnectServer(target, message)
          addLocalEvent(`%Ze0af68Disconnected from ${target}%N`)
        } else {
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
        disconnectServer(connId, message)
        addLocalEvent(`%Ze0af68Disconnected from current server%N`)
      }
    },
    description: "Disconnect from a server",
    usage: "/disconnect [server-id] [message]",
  },
}

// ─── Built-in Alias Resolution ────────────────────────────────

export const aliasMap: Record<string, string> = {}
for (const [name, def] of Object.entries(commands)) {
  if (def.aliases) {
    for (const alias of def.aliases) {
      aliasMap[alias] = name
    }
  }
}

export function findByAlias(name: string): CommandDef | undefined {
  const canonical = aliasMap[name]
  return canonical ? commands[canonical] : undefined
}

export function getCanonicalName(name: string): string {
  return aliasMap[name] ?? name
}
