import type { Client } from "irc-framework"
import { useStore } from "@/core/state/store"
import { makeBufferId, BufferType, ActivityLevel } from "@/types"
import type { Message } from "@/types"
import { formatDuration, formatDate, buildModeString, buildPrefixMap, buildModeOrder, getHighestPrefix, getNickMode } from "./formatting"
import { handleNetsplitQuit, handleNetsplitJoin, destroyNetsplitState } from "./netsplit"
import { shouldSuppressNickFlood, destroyAntifloodState } from "./antiflood"
import { shouldIgnore } from "./ignore"

function isChannelTarget(target: string): boolean {
  return target.startsWith("#") || target.startsWith("&") || target.startsWith("+") || target.startsWith("!")
}

export function bindEvents(client: Client, connectionId: string) {
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

  client.on("socket error", (err) => {
    console.error(`[${connectionId}] Socket error:`, err)
    getStore().updateConnection(connectionId, { status: "error" })
    statusMsg(`%Zf7768eSocket error: ${err?.message ?? err}%N`)
  })

  client.on("socket close", (hadError) => {
    if (hadError) {
      statusMsg(`%Zf7768eSocket closed with error%N`)
    }
  })

  // ─── Registration ─────────────────────────────────────────
  client.on("registered", (event) => {
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

  client.on("join", (event) => {
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
      // Switch to the newly joined channel
      getStore().setActiveBuffer(bufferId)
      // Request channel modes so we get RPL_CHANNELMODEIS (324)
      client.raw(`MODE ${event.channel}`)
    } else {
      s.addNick(bufferId, { nick: event.nick, prefix: "", modes: "", away: false, account: event.account })

      // If this join is from a netsplit healing, batch it instead of showing individually
      if (handleNetsplitJoin(connectionId, event.nick, bufferId)) {
        return
      }

      if (shouldIgnore(event.nick, event.ident, event.hostname, "JOINS", event.channel)) return

      s.addMessage(bufferId, makeFormattedEvent("join", [
        event.nick, event.ident || "", event.hostname || "", event.channel,
      ]))
    }
  })

  client.on("part", (event) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    const conn = s.connections.get(connectionId)

    if (event.nick === conn?.nick) {
      s.removeBuffer(bufferId)
    } else {
      s.removeNick(bufferId, event.nick)
      if (shouldIgnore(event.nick, event.ident, event.hostname, "PARTS", event.channel)) return
      s.addMessage(bufferId, makeFormattedEvent("part", [
        event.nick, event.ident || "", event.hostname || "", event.channel, event.message || "",
      ]))
    }
  })

  client.on("quit", (event) => {
    const s = getStore()
    const affected = Array.from(s.buffers.entries())
      .filter(([_, buf]) => buf.connectionId === connectionId && buf.users.has(event.nick))
      .map(([id]) => id)

    // Remove nick from all affected channels
    for (const id of affected) {
      getStore().removeNick(id, event.nick)
    }

    // Check if this is a netsplit — if so, batch it instead of showing individual quits
    if (handleNetsplitQuit(connectionId, event.nick, event.message || "", affected)) {
      return
    }

    if (shouldIgnore(event.nick, event.ident, event.hostname, "QUITS")) return

    for (const id of affected) {
      getStore().addMessage(id, makeFormattedEvent("quit", [
        event.nick, event.ident || "", event.hostname || "", event.message || "",
      ]))
    }
  })

  client.on("kick", (event) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    const conn = s.connections.get(connectionId)

    if (event.kicked === conn?.nick) {
      s.addMessage(bufferId, makeEventMessage(
        `%Zf7768eYou were kicked from ${event.channel} by %Za9b1d6${event.nick}%Zf7768e (${event.message || ""})%N`
      ))
    } else {
      s.removeNick(bufferId, event.kicked)
      if (shouldIgnore(event.nick, event.ident, event.hostname, "KICKS", event.channel)) return
      s.addMessage(bufferId, makeEventMessage(
        `%Ze0af68${event.kicked}%Z565f89 was kicked by %Za9b1d6${event.nick}%Z565f89 (${event.message || ""})%N`
      ))
    }
  })

  client.on("privmsg", (event) => {
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
      nickMode: getNickMode(s.buffers, bufferId, event.nick),
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

  client.on("action", (event) => {
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

  client.on("notice", (event) => {
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

  client.on("nick", (event) => {
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

    const nickIgnored = shouldIgnore(event.nick, event.ident, event.hostname, "NICKS")
    for (const id of affected) {
      getStore().updateNick(id, event.nick, event.new_nick)
      if (nickIgnored) continue
      if (shouldSuppressNickFlood(connectionId, id)) continue
      getStore().addMessage(id, makeFormattedEvent("nick_change", [
        event.nick, event.new_nick,
      ]))
    }
  })

  client.on("topic", (event) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    s.updateBufferTopic(bufferId, event.topic, event.nick)
    if (event.nick) {
      getStore().addMessage(bufferId, makeFormattedEvent("topic", [
        event.nick, event.topic,
      ]))
    }
  })

  client.on("topicsetby", (event) => {
    const bufferId = makeBufferId(connectionId, event.channel)
    const when = event.when ? formatDate(new Date(event.when * 1000)) : ""
    getStore().addMessage(bufferId, makeEventMessage(
      `%Z565f89Topic set by %Za9b1d6${event.nick}%Z565f89${when ? " on " + when : ""}%N`
    ))
  })

  client.on("userlist", (event) => {
    const bufferId = makeBufferId(connectionId, event.channel)
    if (!getStore().buffers.has(bufferId)) return

    const conn = getStore().connections.get(connectionId)
    const prefixMap = buildPrefixMap(conn?.isupport?.PREFIX)
    const modeOrder = buildModeOrder(conn?.isupport?.PREFIX)

    for (const user of event.users) {
      // irc-framework gives modes as array of chars (["o","v"]) or prefix symbols (["@","+"])
      // Normalize to mode chars and store all of them
      const rawModes = (user.modes ?? [])
        .map((m) => {
          // If it's already a mode char in the order list, keep it
          if (modeOrder.includes(m)) return m
          // Otherwise it's a prefix symbol — reverse-lookup
          for (const [modeChar, sym] of Object.entries(prefixMap)) {
            if (sym === m && modeOrder.includes(modeChar)) return modeChar
          }
          return ""
        })
        .filter(Boolean)
        .join("")
      const prefix = getHighestPrefix(rawModes, modeOrder, prefixMap)
      getStore().addNick(bufferId, {
        nick: user.nick,
        prefix,
        modes: rawModes,
        away: !!user.away,
        account: user.account,
      })
    }
  })

  client.on("mode", (event) => {
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
    const modeOrder = buildModeOrder(conn?.isupport?.PREFIX)

    for (const mc of event.modes) {
      if (!mc.param) continue
      const isAdding = mc.mode.startsWith("+")
      const modeChar = mc.mode.replace(/[+-]/, "")
      if (!modeOrder.includes(modeChar)) continue // not a nick prefix mode

      const buf = getStore().buffers.get(bufferId)
      const entry = buf?.users.get(mc.param)
      if (!entry) continue

      // Add or remove this specific mode char from the user's modes string
      let modes = entry.modes ?? ""
      if (isAdding && !modes.includes(modeChar)) {
        modes += modeChar
      } else if (!isAdding) {
        modes = modes.replace(modeChar, "")
      }

      getStore().addNick(bufferId, {
        ...entry,
        modes,
        prefix: getHighestPrefix(modes, modeOrder, prefixMap),
      })
    }

    // Update channel modes (non-nick-prefix modes)
    const buf = getStore().buffers.get(bufferId)
    if (buf) {
      let chanModes = buf.modes ?? ""
      const params: Record<string, string> = { ...buf.modeParams }
      for (const mc of event.modes) {
        const isAdding = mc.mode.startsWith("+")
        const modeChar = mc.mode.replace(/[+-]/, "")
        if (modeOrder.includes(modeChar)) continue // nick prefix mode
        if (isAdding && !chanModes.includes(modeChar)) {
          chanModes += modeChar
        } else if (!isAdding) {
          chanModes = chanModes.replace(modeChar, "")
          delete params[modeChar]
        }
        if (isAdding && mc.param) {
          params[modeChar] = mc.param
        }
      }
      getStore().updateBufferModes(bufferId, chanModes, params)
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
    destroyNetsplitState(connectionId)
    destroyAntifloodState(connectionId)
    getStore().updateConnection(connectionId, { status: "disconnected" })
    statusMsg("%Zf7768eDisconnected from server%N")
  })

  client.on("reconnecting", (event) => {
    getStore().updateConnection(connectionId, { status: "connecting" })
    const attempt = event?.attempt ?? "?"
    const max = event?.max_retries ?? "?"
    statusMsg(`%Ze0af68Reconnecting (attempt ${attempt}/${max})...%N`)
  })

  client.on("error", (event) => {
    console.error(`[${connectionId}] IRC error:`, event)
    statusMsg(`%Zf7768eError: ${event.message || event.error || JSON.stringify(event)}%N`)
  })

  client.on("irc error", (event) => {
    const s = getStore()

    // Route to channel buffer if available
    let targetBuffer = statusId
    if (event.channel) {
      const chanBufferId = makeBufferId(connectionId, event.channel)
      if (s.buffers.has(chanBufferId)) {
        targetBuffer = chanBufferId
      }
    }

    // Build message with context
    const prefix = event.nick ? `${event.nick}: `
      : event.channel ? `${event.channel}: `
      : ""
    const reason = event.reason
      || event.message
      || (event.error ? event.error.replace(/_/g, " ") : "Unknown error")

    s.addMessage(targetBuffer, makeEventMessage(`%Zf7768e${prefix}${reason}%N`))
  })

  // Nick in use — irc-framework does NOT auto-retry, we must send alternate nick
  let nickRetries = 0
  client.on("nick in use", (event) => {
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
  client.on("nick invalid", (event) => {
    statusMsg(`%Zf7768eNick ${event.nick} is invalid: ${event.reason}%N`)
  })

  // SASL failure
  client.on("sasl failed", (event) => {
    statusMsg(`%Zf7768eSASL authentication failed: ${event.reason}${event.message ? " — " + event.message : ""}%N`)
  })

  // Store ISUPPORT/server options
  client.on("server options", (event) => {
    const s = getStore()
    s.updateConnection(connectionId, { isupport: event.options || {} })
  })

  // RPL_UMODEIS — user's own modes (emitted on connect and after MODE <nick>)
  client.on("user info", (event) => {
    const modes = (event.raw_modes || "").replace(/^\+/, "")
    getStore().updateConnection(connectionId, { userModes: modes })
  })

  // ─── MOTD ──────────────────────────────────────────────────
  client.on("motd", (event) => {
    if (event.error) {
      statusMsg(`%Z565f89${event.error}%N`)
      return
    }
    if (!event.motd) return
    for (const line of event.motd.split("\n")) {
      if (line.trim()) statusMsg(`%Z565f89${line}%N`)
    }
  })

  // ─── Away / Back ───────────────────────────────────────────
  client.on("away", (event) => {
    const s = getStore()
    if (event.self) {
      statusMsg(`%Z565f89You are now marked as away${event.message ? ": " + event.message : ""}%N`)
      return
    }
    if (!event.nick) return

    // Update nick away status in all shared channels
    for (const [bufId, buf] of s.buffers) {
      if (buf.connectionId === connectionId && buf.users.has(event.nick)) {
        const entry = buf.users.get(event.nick)!
        getStore().addNick(bufId, { ...entry, away: true })
      }
    }

    // Show in query buffer if we have one open (RPL_AWAY response to messaging)
    const queryId = makeBufferId(connectionId, event.nick)
    if (s.buffers.has(queryId)) {
      s.addMessage(queryId, makeEventMessage(
        `%Z565f89${event.nick} is away${event.message ? ": " + event.message : ""}%N`
      ))
    }
  })

  client.on("back", (event) => {
    const s = getStore()
    if (event.self) {
      statusMsg(`%Z565f89You are no longer marked as away%N`)
      return
    }
    if (!event.nick) return

    // Update nick away status in all shared channels
    for (const [bufId, buf] of s.buffers) {
      if (buf.connectionId === connectionId && buf.users.has(event.nick)) {
        const entry = buf.users.get(event.nick)!
        getStore().addNick(bufId, { ...entry, away: false })
      }
    }
  })

  // ─── Channel redirect ─────────────────────────────────────
  client.on("channel_redirect", (event) => {
    statusMsg(`%Ze0af68${event.from} is redirecting to ${event.to}%N`)
  })

  // ─── Invite ────────────────────────────────────────────────
  client.on("invite", (event) => {
    const s = getStore()
    const target = s.activeBufferId ?? statusId
    s.addMessage(target, makeEventMessage(
      `%Zbb9af7${event.nick} invites you to ${event.channel}%N`
    ))
  })

  client.on("invited", (event) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    const target = s.buffers.has(bufferId) ? bufferId : statusId
    s.addMessage(target, makeEventMessage(
      `%Z9ece6aInviting ${event.nick} to ${event.channel}%N`
    ))
  })

  // ─── Ban list ──────────────────────────────────────────────
  client.on("banlist", (event) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    const target = s.buffers.has(bufferId) ? bufferId : statusId

    if (event.bans.length === 0) {
      s.addMessage(target, makeEventMessage(
        `%Z565f89${event.channel}: Ban list is empty%N`
      ))
      return
    }

    s.addMessage(target, makeEventMessage(
      `%Z7aa2f7───── Ban list for ${event.channel} ─────%N`
    ))
    for (const ban of event.bans) {
      const by = ban.banned_by ? ` set by ${ban.banned_by}` : ""
      const at = ban.banned_at ? ` [${formatDate(new Date(ban.banned_at * 1000))}]` : ""
      getStore().addMessage(target, makeEventMessage(
        `%Za9b1d6  ${ban.banned}%Z565f89${by}${at}%N`
      ))
    }
  })

  // ─── Login / Account ───────────────────────────────────────
  client.on("loggedin", (event) => {
    statusMsg(`%Z9ece6aLogged in as %Zc0caf5${event.account}%N`)
  })

  client.on("loggedout", () => {
    statusMsg(`%Ze0af68Logged out from account%N`)
  })

  // ACCOUNT-NOTIFY — a user's account changed (requires account-notify cap)
  client.on("account", (event) => {
    const s = getStore()
    for (const [bufId, buf] of s.buffers) {
      if (buf.connectionId === connectionId && buf.users.has(event.nick)) {
        const entry = buf.users.get(event.nick)!
        getStore().addNick(bufId, {
          ...entry,
          account: event.account === false ? undefined : event.account,
        })
      }
    }
  })

  // ─── Displayed host ────────────────────────────────────────
  client.on("displayed host", (event) => {
    statusMsg(`%Z565f89Your displayed host is now %Za9b1d6${event.hostname}%N`)
  })

  // ─── Channel info (324 modes, 329 creation time, 328 URL) ─
  client.on("channel info", (event) => {
    const bufferId = makeBufferId(connectionId, event.channel)

    // 324 — RPL_CHANNELMODEIS
    if (event.raw_modes) {
      const modeChars = event.raw_modes.replace(/^\+/, "")
      const params: Record<string, string> = {}
      if (event.modes) {
        for (const mc of event.modes) {
          const ch = mc.mode.replace(/[+-]/, "")
          if (mc.param) params[ch] = mc.param
        }
      }
      getStore().updateBufferModes(bufferId, modeChars, params)
    }

    // 329 — RPL_CREATIONTIME
    if (event.created_at) {
      const buf = getStore().buffers.get(bufferId)
      if (buf) {
        getStore().addMessage(bufferId, makeEventMessage(
          `%Z565f89Channel created: ${formatDate(new Date(event.created_at * 1000))}%N`
        ))
      }
    }
  })

  // ─── Wallops ───────────────────────────────────────────────
  client.on("wallops", (event) => {
    const from = event.from_server ? "Server" : event.nick
    statusMsg(`%Zbb9af7[Wallops/${from}] ${event.message}%N`)
  })

  // ─── CTCP ─────────────────────────────────────────────────
  client.on("ctcp response", (event) => {
    const s = getStore()
    const target = s.activeBufferId ?? statusId
    s.addMessage(target, makeEventMessage(
      `%Z565f89CTCP %Za9b1d6${event.type}%Z565f89 reply from %Zc0caf5${event.nick}%Z565f89: ${event.message}%N`
    ))
  })

  client.on("ctcp request", (event) => {
    // VERSION is handled internally by irc-framework unless version: null
    // Show other CTCP requests (ACTION is handled separately)
    if (event.type === "ACTION" || event.type === "VERSION") return
    const s = getStore()
    const target = s.activeBufferId ?? statusId
    s.addMessage(target, makeEventMessage(
      `%Z565f89CTCP %Za9b1d6${event.type}%Z565f89 from %Zc0caf5${event.nick}%Z565f89${event.message ? ": " + event.message : ""}%N`
    ))
  })

  // ─── Catch-all for unhandled numerics ──────────────────────
  client.on("unknown command", (command) => {
    // Only handle IRC numerics (3-digit codes)
    if (!/^\d{3}$/.test(command.command)) return

    const numeric = parseInt(command.command, 10)
    const params = [...command.params]

    // First param is usually our nick — skip it
    if (params.length > 1) params.shift()

    const text = params.join(" ")
    if (!text.trim()) return

    const isError = numeric >= 400 && numeric < 600
    const s = getStore()

    if (isError) {
      // Route channel errors to the channel buffer
      let targetBuffer = statusId
      for (const p of params) {
        if (isChannelTarget(p)) {
          const chanBufferId = makeBufferId(connectionId, p)
          if (s.buffers.has(chanBufferId)) {
            targetBuffer = chanBufferId
            break
          }
        }
      }
      s.addMessage(targetBuffer, makeEventMessage(`%Zf7768e${text}%N`))
    } else {
      statusMsg(`%Z565f89${text}%N`)
    }
  })

  // ─── Whois response ──────────────────────────────────────
  client.on("whois", (event) => {
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

  // ─── Whowas response ──────────────────────────────────────
  client.on("whowas", (event) => {
    const s = getStore()
    const targetBuffer = s.activeBufferId ?? statusId

    if (event.error) {
      s.addMessage(targetBuffer, makeEventMessage(
        `%Zf7768e${event.nick}: No such nick in history%N`
      ))
      return
    }

    const lines: string[] = []
    lines.push(`%Z7aa2f7───── WHOWAS ${event.nick} ──────────────────────────%N`)

    if (event.ident && event.hostname) {
      lines.push(`%Zc0caf5${event.nick}%Z565f89 was (${event.ident}@${event.hostname})%N`)
    }

    if (event.real_name) {
      lines.push(`  %Za9b1d6${event.real_name}%N`)
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

