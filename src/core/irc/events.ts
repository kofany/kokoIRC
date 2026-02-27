import { useStore } from "@/core/state/store"
import { makeBufferId, BufferType, ActivityLevel } from "@/types"
import type { Message } from "@/types"

function isChannelTarget(target: string): boolean {
  return target.startsWith("#") || target.startsWith("&") || target.startsWith("+") || target.startsWith("!")
}

export function bindEvents(client: any, connectionId: string) {
  const getStore = () => useStore.getState()
  const statusId = makeBufferId(connectionId, "Status")

  /** Safely add a message to the Status buffer (must exist). */
  function statusMsg(text: string) {
    getStore().addMessage(statusId, makeEventMessage(text))
  }

  // ─── Socket-level events ─────────────────────────────────
  client.on("socket connected", () => {
    statusMsg("%Z9ece6aSocket connected, registering...%N")
  })

  client.on("socket error", (err: any) => {
    console.error(`[${connectionId}] Socket error:`, err)
    getStore().updateConnection(connectionId, { status: "error" })
    statusMsg(`%Zf7768eSocket error: ${err?.message ?? err}%N`)
  })

  client.on("socket close", (hadError: any) => {
    if (hadError) {
      statusMsg(`%Zf7768eSocket closed with error%N`)
    }
  })

  // ─── Registration ─────────────────────────────────────────
  client.on("registered", (event: any) => {
    const s = getStore()
    s.updateConnection(connectionId, { status: "connected", nick: event.nick })
    statusMsg(`%Z9ece6aRegistered as %Zc0caf5${event.nick}%N`)
    // Auto-join channels from config
    const config = s.config
    if (config) {
      const serverConfig = Object.entries(config.servers).find(([id]) => id === connectionId)?.[1]
      if (serverConfig) {
        for (const channel of serverConfig.channels) {
          client.join(channel)
        }
      }
    }
  })

  client.on("join", (event: any) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    const conn = s.connections.get(connectionId)

    if (event.nick === conn?.nick) {
      s.addBuffer({
        id: bufferId,
        connectionId,
        type: BufferType.Channel,
        name: event.channel,
        messages: [],
        activity: ActivityLevel.None,
        unreadCount: 0,
        lastRead: new Date(),
        users: new Map(),
      })
    } else {
      s.addNick(bufferId, { nick: event.nick, prefix: "", away: false, account: event.account })
      s.addMessage(bufferId, makeFormattedEvent("join", [
        event.nick, event.ident || "", event.hostname || "", event.channel,
      ]))
    }
  })

  client.on("part", (event: any) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    const conn = s.connections.get(connectionId)

    if (event.nick === conn?.nick) {
      s.removeBuffer(bufferId)
    } else {
      s.removeNick(bufferId, event.nick)
      s.addMessage(bufferId, makeFormattedEvent("part", [
        event.nick, event.channel, event.message || "",
      ]))
    }
  })

  client.on("quit", (event: any) => {
    const s = getStore()
    const affected = Array.from(s.buffers.entries())
      .filter(([_, buf]) => buf.connectionId === connectionId && buf.users.has(event.nick))
      .map(([id]) => id)

    for (const id of affected) {
      getStore().removeNick(id, event.nick)
      getStore().addMessage(id, makeFormattedEvent("quit", [
        event.nick, event.message || "",
      ]))
    }
  })

  client.on("kick", (event: any) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    const conn = s.connections.get(connectionId)

    if (event.kicked === conn?.nick) {
      s.addMessage(bufferId, makeEventMessage(
        `%Zf7768eYou were kicked from ${event.channel} by %Za9b1d6${event.nick}%Zf7768e (${event.message || ""})%N`
      ))
    } else {
      s.removeNick(bufferId, event.kicked)
      s.addMessage(bufferId, makeEventMessage(
        `%Ze0af68${event.kicked}%Z565f89 was kicked by %Za9b1d6${event.nick}%Z565f89 (${event.message || ""})%N`
      ))
    }
  })

  client.on("privmsg", (event: any) => {
    const s = getStore()
    const isChannel = isChannelTarget(event.target)
    const bufferName = isChannel ? event.target : event.nick
    const bufferId = makeBufferId(connectionId, bufferName)

    // Create query buffer if it doesn't exist
    if (!isChannel && !s.buffers.has(bufferId)) {
      const host = event.ident && event.hostname ? `${event.ident}@${event.hostname}` : undefined
      s.addBuffer({
        id: bufferId,
        connectionId,
        type: BufferType.Query,
        name: event.nick,
        messages: [],
        activity: ActivityLevel.None,
        unreadCount: 0,
        lastRead: new Date(),
        users: new Map(),
        topic: host,
      })
    } else if (!isChannel) {
      // Update hostname if we got new info
      const host = event.ident && event.hostname ? `${event.ident}@${event.hostname}` : undefined
      if (host) {
        const buf = s.buffers.get(bufferId)
        if (buf && buf.type === BufferType.Query && buf.topic !== host) {
          s.updateBufferTopic(bufferId, host)
        }
      }
    }

    const conn = s.connections.get(connectionId)
    const isOwnMsg = event.nick === conn?.nick
    const isMention = !isOwnMsg && conn?.nick
      ? event.message.toLowerCase().includes(conn.nick.toLowerCase())
      : false

    s.addMessage(bufferId, {
      id: crypto.randomUUID(),
      timestamp: new Date(event.time || Date.now()),
      type: "message",
      nick: event.nick,
      nickMode: getNickMode(s, bufferId, event.nick),
      text: event.message,
      highlight: isMention,
      tags: event.tags,
    })

    if (s.activeBufferId !== bufferId && !isOwnMsg) {
      const level = !isChannel ? ActivityLevel.Mention
        : isMention ? ActivityLevel.Mention
        : ActivityLevel.Activity
      s.updateBufferActivity(bufferId, level)
    }
  })

  client.on("action", (event: any) => {
    const s = getStore()
    const isChannel = isChannelTarget(event.target)
    const bufferName = isChannel ? event.target : event.nick
    const bufferId = makeBufferId(connectionId, bufferName)

    s.addMessage(bufferId, {
      id: crypto.randomUUID(),
      timestamp: new Date(event.time || Date.now()),
      type: "action",
      nick: event.nick,
      text: event.message,
      highlight: false,
      tags: event.tags,
    })
  })

  client.on("notice", (event: any) => {
    const s = getStore()
    // Server notices go to server buffer
    const bufferId = event.from_server
      ? makeBufferId(connectionId, "Status")
      : makeBufferId(connectionId, event.target && isChannelTarget(event.target) ? event.target : event.nick || "Status")

    if (!s.buffers.has(bufferId)) {
      // Fallback to server status buffer
      const statusId = makeBufferId(connectionId, "Status")
      s.addMessage(statusId, {
        id: crypto.randomUUID(),
        timestamp: new Date(event.time || Date.now()),
        type: "notice",
        nick: event.nick,
        text: event.message,
        highlight: false,
      })
      return
    }

    s.addMessage(bufferId, {
      id: crypto.randomUUID(),
      timestamp: new Date(event.time || Date.now()),
      type: "notice",
      nick: event.nick,
      text: event.message,
      highlight: false,
    })
  })

  client.on("nick", (event: any) => {
    const s = getStore()
    const conn = s.connections.get(connectionId)

    // If it's us, update connection nick
    if (event.nick === conn?.nick) {
      getStore().updateConnection(connectionId, { nick: event.new_nick })
    }

    // Collect affected buffer IDs first, then mutate with fresh state
    const affected = Array.from(s.buffers.entries())
      .filter(([_, buf]) => buf.connectionId === connectionId && buf.users.has(event.nick))
      .map(([id]) => id)

    for (const id of affected) {
      getStore().updateNick(id, event.nick, event.new_nick)
      getStore().addMessage(id, makeFormattedEvent("nick_change", [
        event.nick, event.new_nick,
      ]))
    }
  })

  client.on("topic", (event: any) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    s.updateBufferTopic(bufferId, event.topic, event.nick)
    if (event.nick) {
      getStore().addMessage(bufferId, makeFormattedEvent("topic", [
        event.nick, event.topic,
      ]))
    }
  })

  client.on("userlist", (event: any) => {
    const bufferId = makeBufferId(connectionId, event.channel)
    if (!getStore().buffers.has(bufferId)) return

    const conn = getStore().connections.get(connectionId)
    const prefixMap = buildPrefixMap(conn?.isupport?.PREFIX)

    for (const user of event.users) {
      const rawMode = user.modes?.[0] ?? ""
      // irc-framework may give mode chars (o,v) or prefix symbols (@,+)
      const prefix = prefixMap[rawMode] ?? rawMode
      getStore().addNick(bufferId, {
        nick: user.nick,
        prefix,
        away: !!user.away,
        account: user.account,
      })
    }
  })

  client.on("mode", (event: any) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.target)
    if (!s.buffers.has(bufferId)) return

    // Build displayable mode string
    const modeStr = buildModeString(event)
    getStore().addMessage(bufferId, makeFormattedEvent("mode", [
      event.nick || "server", modeStr, event.target,
    ]))

    // Update nick prefixes for user prefix modes (+o, +v, etc.)
    if (!Array.isArray(event.modes)) return
    const conn = getStore().connections.get(connectionId)
    const prefixMap = buildPrefixMap(conn?.isupport?.PREFIX)

    for (const mc of event.modes) {
      if (!mc.param) continue
      const isAdding = mc.mode.startsWith("+")
      const modeChar = mc.mode.replace(/[+-]/, "")
      const prefix = prefixMap[modeChar]
      if (!prefix) continue // not a nick prefix mode

      const buf = getStore().buffers.get(bufferId)
      const entry = buf?.users.get(mc.param)
      if (!entry) continue

      getStore().addNick(bufferId, {
        ...entry,
        prefix: isAdding ? prefix : "",
      })
    }
  })

  // Lag measurement via CTCP PING or PONG
  let lastPingSent = 0
  const lagPingInterval = setInterval(() => {
    if (getStore().connections.get(connectionId)?.status === "connected") {
      lastPingSent = Date.now()
      client.raw("PING " + lastPingSent)
    }
  }, 30000)

  client.on("pong", () => {
    if (lastPingSent > 0) {
      const lag = Date.now() - lastPingSent
      getStore().updateConnection(connectionId, { lag })
    }
  })

  client.on("close", () => {
    clearInterval(lagPingInterval)
    getStore().updateConnection(connectionId, { status: "disconnected" })
    statusMsg("%Zf7768eDisconnected from server%N")
  })

  client.on("reconnecting", (event: any) => {
    getStore().updateConnection(connectionId, { status: "connecting" })
    const attempt = event?.attempt ?? "?"
    const max = event?.max_retries ?? "?"
    statusMsg(`%Ze0af68Reconnecting (attempt ${attempt}/${max})...%N`)
  })

  client.on("error", (event: any) => {
    console.error(`[${connectionId}] IRC error:`, event)
    statusMsg(`%Zf7768eError: ${event.message || event.error || JSON.stringify(event)}%N`)
  })

  client.on("irc error", (event: any) => {
    console.error(`[${connectionId}] IRC protocol error:`, event)
    const reason = event.reason || event.error || event.message || JSON.stringify(event)
    statusMsg(`%Zf7768eIRC error: ${reason}%N`)
  })

  // Nick in use — irc-framework does NOT auto-retry, we must send alternate nick
  let nickRetries = 0
  client.on("nick in use", (event: any) => {
    nickRetries++
    if (nickRetries > 5) {
      statusMsg(`%Zf7768eCould not find available nick after 5 attempts%N`)
      return
    }
    const newNick = event.nick + "_"
    statusMsg(`%Ze0af68Nick ${event.nick} is already in use, trying ${newNick}...%N`)
    client.changeNick(newNick)
    getStore().updateConnection(connectionId, { nick: newNick })
  })

  // Invalid nick
  client.on("nick invalid", (event: any) => {
    statusMsg(`%Zf7768eNick ${event.nick} is invalid: ${event.reason}%N`)
  })

  // SASL failure
  client.on("sasl failed", (event: any) => {
    statusMsg(`%Zf7768eSASL authentication failed: ${event.reason}${event.message ? " — " + event.message : ""}%N`)
  })

  // Store ISUPPORT/server options
  client.on("server options", (event: any) => {
    const s = getStore()
    s.updateConnection(connectionId, { isupport: event.options || {} })
  })

  // ─── Whois response ──────────────────────────────────────
  client.on("whois", (event: any) => {
    const s = getStore()
    const targetBuffer = s.activeBufferId
    if (!targetBuffer) return

    if (event.error) {
      s.addMessage(targetBuffer, makeEventMessage(
        `%Zf7768e${event.nick || "?"}: No such nick/channel%N`
      ))
      return
    }

    const lines: string[] = []
    lines.push(`%Z7aa2f7───── WHOIS ${event.nick} ──────────────────────────%N`)

    if (event.ident && event.hostname) {
      lines.push(`%Zc0caf5${event.nick}%Z565f89 (${event.ident}@${event.hostname})%N`)
    }

    if (event.real_name) {
      lines.push(`  %Za9b1d6${event.real_name}%N`)
    }

    if (event.channels) {
      lines.push(`%Z565f89  channels: %Za9b1d6${event.channels}%N`)
    }

    if (event.server) {
      const info = event.server_info ? ` (${event.server_info})` : ""
      lines.push(`%Z565f89  server: %Za9b1d6${event.server}${info}%N`)
    }

    if (event.account) {
      lines.push(`%Z565f89  account: %Z9ece6a${event.account}%N`)
    }

    if (event.idle != null) {
      let line = `%Z565f89  idle: %Za9b1d6${formatDuration(event.idle)}`
      if (event.logon) {
        line += `%Z565f89, signon: %Za9b1d6${formatDate(new Date(event.logon * 1000))}`
      }
      lines.push(line + `%N`)
    }

    if (event.away) {
      lines.push(`%Z565f89  away: %Ze0af68${event.away}%N`)
    }

    if (event.operator) {
      lines.push(`  %Zbb9af7${event.operator}%N`)
    }

    if (event.secure || event.actually_secure) {
      lines.push(`  %Z9ece6ais using a secure connection%N`)
    }

    if (event.bot) {
      lines.push(`  %Z7dcfffis a bot%N`)
    }

    // RPL_WHOISSPECIAL — can be array or string
    if (event.special) {
      const specials = Array.isArray(event.special) ? event.special : [event.special]
      for (const line of specials) {
        lines.push(`  %Zbb9af7${line}%N`)
      }
    }

    lines.push(`%Z7aa2f7─────────────────────────────────────────────%N`)

    for (const line of lines) {
      getStore().addMessage(targetBuffer, makeEventMessage(line))
    }
  })
}

/** System/inline event — text may contain %Z color codes. */
function makeEventMessage(text: string): Message {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type: "event",
    text,
    highlight: false,
  }
}

/** IRC event with theme format key — rendered via [formats.events] in MessageLine. */
function makeFormattedEvent(key: string, params: string[]): Message {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type: "event",
    text: params.join(" "),
    eventKey: key,
    eventParams: params,
    highlight: false,
  }
}

/** Reconstruct a displayable mode string from irc-framework mode event. */
function buildModeString(event: any): string {
  if (event.raw_modes) {
    const params = event.raw_params ?? []
    return event.raw_modes + (params.length > 0 ? " " + params.join(" ") : "")
  }
  if (!Array.isArray(event.modes)) return String(event.modes ?? "")

  let modeChars = ""
  const params: string[] = []
  let lastSign = ""

  for (const m of event.modes) {
    const sign = m.mode[0]
    const char = m.mode.slice(1)
    if (sign !== lastSign) {
      modeChars += sign
      lastSign = sign
    }
    modeChars += char
    if (m.param) params.push(m.param)
  }

  return modeChars + (params.length > 0 ? " " + params.join(" ") : "")
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (mins > 0) parts.push(`${mins}m`)
  if (secs > 0 && days === 0) parts.push(`${secs}s`)
  return parts.join(" ")
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const h = String(date.getHours()).padStart(2, "0")
  const mi = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`
}

function getNickMode(store: any, bufferId: string, nick: string): string {
  const buf = store.buffers.get(bufferId)
  return buf?.users.get(nick)?.prefix ?? ""
}

/**
 * Build a map from mode char → prefix symbol using ISUPPORT PREFIX.
 * e.g., "(ov)@+" → { o: "@", v: "+" }
 * Also maps prefix symbols to themselves so both formats work.
 */
function buildPrefixMap(isupportPrefix: unknown): Record<string, string> {
  const map: Record<string, string> = {}
  if (typeof isupportPrefix !== "string") {
    // Default fallback mapping
    map["o"] = "@"; map["v"] = "+"; map["h"] = "%"
    map["a"] = "&"; map["q"] = "~"
    map["@"] = "@"; map["+"] = "+"; map["%"] = "%"
    map["&"] = "&"; map["~"] = "~"
    return map
  }
  const match = isupportPrefix.match(/^\(([^)]+)\)(.+)$/)
  if (!match) return map
  const modes = match[1]
  const prefixes = match[2]
  for (let i = 0; i < modes.length && i < prefixes.length; i++) {
    map[modes[i]] = prefixes[i]
    map[prefixes[i]] = prefixes[i] // identity mapping for prefix symbols
  }
  return map
}
