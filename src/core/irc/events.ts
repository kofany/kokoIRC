import { useStore } from "@/core/state/store"
import { makeBufferId, BufferType, ActivityLevel } from "@/types"
import type { Message } from "@/types"

export function bindEvents(client: any, connectionId: string) {
  const getStore = () => useStore.getState()

  client.on("registered", (event: any) => {
    const s = getStore()
    s.updateConnection(connectionId, { status: "connected", nick: event.nick })
    s.addBuffer({
      id: makeBufferId(connectionId, "Status"),
      connectionId,
      type: BufferType.Server,
      name: "Status",
      messages: [],
      activity: ActivityLevel.None,
      unreadCount: 0,
      lastRead: new Date(),
      users: new Map(),
    })
    if (!s.activeBufferId) {
      s.setActiveBuffer(makeBufferId(connectionId, "Status"))
    }
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
      s.addMessage(bufferId, makeEventMessage(
        `${event.nick} (${event.ident}@${event.hostname}) has joined ${event.channel}`
      ))
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
      s.addMessage(bufferId, makeEventMessage(
        `${event.nick} has left ${event.channel} (${event.message || ""})`
      ))
    }
  })

  client.on("quit", (event: any) => {
    const s = getStore()
    // Remove nick from all channel buffers of this connection
    for (const [id, buf] of s.buffers) {
      if (buf.connectionId === connectionId && buf.users.has(event.nick)) {
        s.removeNick(id, event.nick)
        s.addMessage(id, makeEventMessage(
          `${event.nick} has quit (${event.message || ""})`
        ))
      }
    }
  })

  client.on("kick", (event: any) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    const conn = s.connections.get(connectionId)

    if (event.kicked === conn?.nick) {
      s.addMessage(bufferId, makeEventMessage(
        `You were kicked from ${event.channel} by ${event.nick} (${event.message || ""})`
      ))
    } else {
      s.removeNick(bufferId, event.kicked)
      s.addMessage(bufferId, makeEventMessage(
        `${event.kicked} was kicked by ${event.nick} (${event.message || ""})`
      ))
    }
  })

  client.on("privmsg", (event: any) => {
    const s = getStore()
    const isChannel = event.target.startsWith("#") || event.target.startsWith("&") || event.target.startsWith("+") || event.target.startsWith("!")
    const bufferName = isChannel ? event.target : event.nick
    const bufferId = makeBufferId(connectionId, bufferName)

    // Create query buffer if it doesn't exist
    if (!isChannel && !s.buffers.has(bufferId)) {
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
      })
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
    const isChannel = event.target.startsWith("#") || event.target.startsWith("&")
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
      : makeBufferId(connectionId, event.target?.startsWith("#") ? event.target : event.nick || "Status")

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
      s.updateConnection(connectionId, { nick: event.new_nick })
    }

    // Update nick in all buffers
    for (const [id, buf] of s.buffers) {
      if (buf.connectionId === connectionId && buf.users.has(event.nick)) {
        s.updateNick(id, event.nick, event.new_nick)
        s.addMessage(id, makeEventMessage(`${event.nick} is now known as ${event.new_nick}`))
      }
    }
  })

  client.on("topic", (event: any) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    const buf = s.buffers.get(bufferId)
    if (buf) {
      const buffers = new Map(s.buffers)
      buffers.set(bufferId, { ...buf, topic: event.topic, topicSetBy: event.nick })
      useStore.setState({ buffers })
    }
    if (event.nick) {
      s.addMessage(bufferId, makeEventMessage(`Topic set by ${event.nick}: ${event.topic}`))
    }
  })

  client.on("userlist", (event: any) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    const buf = s.buffers.get(bufferId)
    if (!buf) return

    for (const user of event.users) {
      s.addNick(bufferId, {
        nick: user.nick,
        prefix: user.modes?.[0] ?? "",
        away: !!user.away,
        account: user.account,
      })
    }
  })

  // Handle mode changes that affect nick prefixes
  client.on("mode", (_event: any) => {
    // Mode handling is complex — for MVP just re-request userlist
    // irc-framework handles prefix updates in its channel objects
  })

  client.on("close", () => {
    const s = getStore()
    s.updateConnection(connectionId, { status: "disconnected" })
    s.addMessage(makeBufferId(connectionId, "Status"), makeEventMessage("Disconnected from server"))
  })

  client.on("reconnecting", () => {
    const s = getStore()
    s.updateConnection(connectionId, { status: "connecting" })
    s.addMessage(makeBufferId(connectionId, "Status"), makeEventMessage("Reconnecting..."))
  })

  // Store ISUPPORT/server options
  client.on("server options", (event: any) => {
    const s = getStore()
    s.updateConnection(connectionId, { isupport: event.options || {} })
  })
}

function makeEventMessage(text: string): Message {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type: "event",
    text,
    highlight: false,
  }
}

function getNickMode(store: any, bufferId: string, nick: string): string {
  const buf = store.buffers.get(bufferId)
  return buf?.users.get(nick)?.prefix ?? ""
}
