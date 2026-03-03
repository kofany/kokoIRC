import { useStore } from "@/core/state/store"
import { getClient } from "@/core/irc"
import { makeBufferId } from "@/types"
import { eventBus } from "./event-bus"
import { EventPriority } from "./types"
import type {
  KokoAPI,
  ScriptMeta,
  ScriptCommandDef,
  EventHandler,
  TimerHandle,
  StoreAccess,
  IrcAccess,
  UiAccess,
  ScriptConfigAccess,
} from "./types"

/** Registry of script-defined commands. Checked in execution.ts between built-ins and aliases. */
export const scriptCommands = new Map<string, { def: ScriptCommandDef; owner: string }>()

export function createScriptAPI(meta: ScriptMeta, scriptDefaults: Record<string, any>): {
  api: KokoAPI
  cleanup: () => void
} {
  const scriptName = meta.name
  const unsubs: Array<() => void> = []
  const timers: Array<TimerHandle> = []
  const registeredCommands: string[] = []

  // ─── Store Access ────────────────────────────────────────

  const store: StoreAccess = {
    getConnections: () => useStore.getState().connections,
    getBuffers: () => useStore.getState().buffers,
    getActiveBufferId: () => useStore.getState().activeBufferId,
    getConfig: () => useStore.getState().config,
    getConnection: (id) => useStore.getState().connections.get(id),
    getBuffer: (id) => useStore.getState().buffers.get(id),
    subscribe: (listener) => useStore.subscribe(listener),
  }

  // ─── IRC Access ──────────────────────────────────────────

  function resolveConnId(explicit?: string): string | undefined {
    if (explicit) return explicit
    const s = useStore.getState()
    const bufId = s.activeBufferId
    if (!bufId) return undefined
    const buf = s.buffers.get(bufId)
    return buf?.connectionId
  }

  const irc: IrcAccess = {
    say(target, message, connectionId) {
      const connId = resolveConnId(connectionId)
      if (!connId) return
      getClient(connId)?.say(target, message)
    },
    action(target, message, connectionId) {
      const connId = resolveConnId(connectionId)
      if (!connId) return
      getClient(connId)?.action(target, message)
    },
    notice(target, message, connectionId) {
      const connId = resolveConnId(connectionId)
      if (!connId) return
      getClient(connId)?.notice(target, message)
    },
    join(channel, key, connectionId) {
      const connId = resolveConnId(connectionId)
      if (!connId) return
      getClient(connId)?.join(channel, key)
    },
    part(channel, message, connectionId) {
      const connId = resolveConnId(connectionId)
      if (!connId) return
      getClient(connId)?.part(channel, message)
    },
    raw(line, connectionId) {
      const connId = resolveConnId(connectionId)
      if (!connId) return
      getClient(connId)?.raw(line)
    },
    changeNick(nick, connectionId) {
      const connId = resolveConnId(connectionId)
      if (!connId) return
      getClient(connId)?.changeNick(nick)
    },
    whois(nick, connectionId) {
      const connId = resolveConnId(connectionId)
      if (!connId) return
      getClient(connId)?.whois(nick)
    },
    getClient(connectionId) {
      const connId = resolveConnId(connectionId)
      if (!connId) return undefined
      return getClient(connId)
    },
  }

  // ─── UI Access ───────────────────────────────────────────

  const ui: UiAccess = {
    addLocalEvent(text) {
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
    },
    addMessage(bufferId, partial) {
      useStore.getState().addMessage(bufferId, {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        ...partial,
      })
    },
    switchBuffer(bufferId) {
      useStore.getState().setActiveBuffer(bufferId)
    },
    makeBufferId,
  }

  // ─── Config Access ───────────────────────────────────────

  const config: ScriptConfigAccess = {
    get<T = any>(key: string, defaultValue: T): T {
      const appConfig = useStore.getState().config
      const scriptConfig = (appConfig as any)?.scripts?.[scriptName]
      if (scriptConfig && key in scriptConfig) return scriptConfig[key]
      if (key in scriptDefaults) return scriptDefaults[key] as T
      return defaultValue
    },
    set(key: string, value: any) {
      const s = useStore.getState()
      const appConfig = s.config
      if (!appConfig) return
      // Mutate scripts config in-place (same pattern as /set command)
      if (!(appConfig as any).scripts) (appConfig as any).scripts = {}
      if (!(appConfig as any).scripts[scriptName]) {
        (appConfig as any).scripts[scriptName] = { ...scriptDefaults }
      }
      ;(appConfig as any).scripts[scriptName][key] = value
      s.setConfig({ ...appConfig })
    },
  }

  // ─── KokoAPI ─────────────────────────────────────────────

  const api: KokoAPI = {
    meta,

    on(event, handler, priority = EventPriority.NORMAL) {
      const unsub = eventBus.on(event, handler, priority, scriptName)
      unsubs.push(unsub)
      return unsub
    },

    once(event, handler, priority = EventPriority.NORMAL) {
      const unsub = eventBus.once(event, handler, priority, scriptName)
      unsubs.push(unsub)
      return unsub
    },

    emit(event, data) {
      return eventBus.emit(`script.${event}`, data)
    },

    command(name, def) {
      const lower = name.toLowerCase()
      scriptCommands.set(lower, { def, owner: scriptName })
      registeredCommands.push(lower)
    },

    removeCommand(name) {
      const lower = name.toLowerCase()
      const entry = scriptCommands.get(lower)
      if (entry?.owner === scriptName) {
        scriptCommands.delete(lower)
      }
    },

    timer(ms, handler) {
      const id = setInterval(handler, ms)
      const handle: TimerHandle = { clear: () => clearInterval(id) }
      timers.push(handle)
      return handle
    },

    timeout(ms, handler) {
      const id = setTimeout(handler, ms)
      const handle: TimerHandle = { clear: () => clearTimeout(id) }
      timers.push(handle)
      return handle
    },

    store,
    irc,
    ui,
    config,

    log(...args) {
      const appConfig = useStore.getState().config
      const debug = (appConfig as any)?.scripts?.debug ?? false
      if (debug) {
        console.log(`[script:${scriptName}]`, ...args)
      }
    },
  }

  // ─── Cleanup ─────────────────────────────────────────────

  function cleanup() {
    // Remove all event handlers
    eventBus.removeAll(scriptName)
    for (const unsub of unsubs) unsub()
    unsubs.length = 0

    // Clear all timers
    for (const t of timers) t.clear()
    timers.length = 0

    // Remove all commands
    for (const name of registeredCommands) {
      const entry = scriptCommands.get(name)
      if (entry?.owner === scriptName) {
        scriptCommands.delete(name)
      }
    }
    registeredCommands.length = 0
  }

  return { api, cleanup }
}
