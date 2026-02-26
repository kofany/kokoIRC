import { getClient } from "@/core/irc"
import { useStore } from "@/core/state/store"
import type { ParsedCommand } from "./parser"

type Handler = (args: string[], connectionId: string) => void

const handlers: Record<string, Handler> = {
  join(args, connId) {
    const client = getClient(connId)
    if (!client) return
    const [channel, key] = args
    if (!channel) return
    client.join(channel, key)
  },

  part(args, connId) {
    const client = getClient(connId)
    if (!client) return
    const store = useStore.getState()
    const buf = store.activeBufferId ? store.buffers.get(store.activeBufferId) : null
    const channel = args[0] || buf?.name
    const message = args[1]
    if (channel) client.part(channel, message)
  },

  msg(args, connId) {
    const client = getClient(connId)
    if (!client || args.length < 2) return
    client.say(args[0], args[1])
  },

  me(args, connId) {
    const client = getClient(connId)
    if (!client) return
    const store = useStore.getState()
    const buf = store.activeBufferId ? store.buffers.get(store.activeBufferId) : null
    if (buf && args[0]) {
      client.action(buf.name, args[0])
    }
  },

  nick(args, connId) {
    const client = getClient(connId)
    if (!client || !args[0]) return
    client.changeNick(args[0])
  },

  quit(args, connId) {
    const client = getClient(connId)
    if (!client) return
    client.quit(args[0] ?? "OpenTUI IRC")
  },

  topic(args, connId) {
    const client = getClient(connId)
    if (!client) return
    const store = useStore.getState()
    const buf = store.activeBufferId ? store.buffers.get(store.activeBufferId) : null
    if (args.length >= 2) {
      client.setTopic(args[0], args[1])
    } else if (buf && args[0]) {
      client.setTopic(buf.name, args[0])
    }
  },

  notice(args, connId) {
    const client = getClient(connId)
    if (!client || args.length < 2) return
    client.notice(args[0], args[1])
  },
}

export function executeCommand(parsed: ParsedCommand, connectionId: string): boolean {
  const handler = handlers[parsed.command]
  if (!handler) return false
  handler(parsed.args, connectionId)
  return true
}
