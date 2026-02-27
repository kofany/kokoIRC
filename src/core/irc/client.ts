import { Client } from "irc-framework"
import type { ConnectOptions } from "irc-framework"
import type { ServerConfig } from "@/types/config"
import { useStore } from "@/core/state/store"
import { makeBufferId, BufferType, ActivityLevel } from "@/types"
import { bindEvents } from "./events"

const clients = new Map<string, Client>()

export function connectServer(id: string, config: ServerConfig): Client {
  // Disconnect existing connection with the same id if any
  if (clients.has(id)) {
    disconnectServer(id, "Reconnecting")
  }

  const client = new Client()
  clients.set(id, client)

  const store = useStore.getState()
  const general = store.config?.general

  // Per-server nick/username/realname override or fall back to [general]
  const nick = config.nick || general?.nick || "opentui"
  const username = config.username || general?.username || "opentui"
  const realname = config.realname || general?.realname || "OpenTUI IRC"

  store.addConnection({
    id,
    label: config.label,
    status: "connecting",
    nick,
    userModes: "",
    isupport: {},
  })

  // Create Status buffer immediately so pre-registration messages have a destination
  const statusBufferId = makeBufferId(id, "Status")
  if (!store.buffers.has(statusBufferId)) {
    store.addBuffer({
      id: statusBufferId,
      connectionId: id,
      type: BufferType.Server,
      name: "Status",
      messages: [],
      activity: ActivityLevel.None,
      unreadCount: 0,
      lastRead: new Date(),
      users: new Map(),
    })
  }

  // Show connecting message in Status buffer
  store.addMessage(statusBufferId, {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type: "event" as const,
    text: `%Ze0af68Connecting to ${config.address}:${config.port}${config.tls ? " (TLS)" : ""}...%N`,
    highlight: false,
  })

  bindEvents(client, id)

  const connectOpts: ConnectOptions = {
    host: config.address,
    port: config.port,
    tls: config.tls,
    nick,
    username,
    gecos: realname,
    encoding: config.encoding || "utf8",
    auto_reconnect: config.auto_reconnect ?? true,
    auto_reconnect_max_wait: (config.reconnect_delay ?? 30) * 1000,
    auto_reconnect_max_retries: config.reconnect_max_retries ?? 10,
  }

  // TLS verification
  if (config.tls && config.tls_verify === false) {
    connectOpts.rejectUnauthorized = false
  }

  // Server password (PASS command)
  if (config.password) {
    connectOpts.password = config.password
  }

  // Bind IP (vhost / local address)
  if (config.bind_ip) {
    connectOpts.outgoing_addr = config.bind_ip
  }

  // SASL authentication
  if (config.sasl_user) {
    connectOpts.account = {
      account: config.sasl_user,
      password: config.sasl_pass ?? "",
    }
  }

  client.connect(connectOpts)
  return client
}

export function disconnectServer(id: string, message?: string) {
  const client = clients.get(id)
  if (client) {
    client.quit(message ?? "OpenTUI IRC")
    clients.delete(id)
  }
}

export function getClient(id: string): Client | undefined {
  return clients.get(id)
}

export function getAllClientIds(): string[] {
  return Array.from(clients.keys())
}

export function connectAllAutoconnect() {
  const config = useStore.getState().config
  if (!config) return
  for (const [id, server] of Object.entries(config.servers)) {
    if (server.autoconnect) {
      connectServer(id, server)
    }
  }
}
