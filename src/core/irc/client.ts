import { Client } from "irc-framework"
import type { ServerConfig } from "@/types/config"
import { useStore } from "@/core/state/store"
import { bindEvents } from "./events"

const clients = new Map<string, Client>()

export function connectServer(id: string, config: ServerConfig): Client {
  const client = new Client()
  clients.set(id, client)

  const store = useStore.getState()
  store.addConnection({
    id,
    label: config.label,
    status: "connecting",
    nick: store.config?.general.nick ?? "opentui",
    userModes: "",
    isupport: {},
  })

  bindEvents(client, id)

  const connectOpts: any = {
    host: config.address,
    port: config.port,
    tls: config.tls,
    nick: store.config?.general.nick ?? "opentui",
    username: store.config?.general.username ?? "opentui",
    gecos: store.config?.general.realname ?? "OpenTUI IRC",
  }

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

export function connectAllAutoconnect() {
  const config = useStore.getState().config
  if (!config) return
  for (const [id, server] of Object.entries(config.servers)) {
    if (server.autoconnect) {
      connectServer(id, server)
    }
  }
}
