import type { Connection, Buffer, Message } from "@/types"
import type { AppConfig } from "@/types/config"
import type { Client } from "kofany-irc-framework"

// ─── Event System ────────────────────────────────────────────

export enum EventPriority {
  HIGHEST = 100,
  HIGH = 75,
  NORMAL = 50,
  LOW = 25,
  LOWEST = 0,
}

export interface EventContext {
  /** Prevent lower-priority handlers and built-in store update from running.
   *  Must be called synchronously (before any await). */
  stop(): void
  stopped: boolean
}

export type EventHandler = (data: any, ctx: EventContext) => void | Promise<void>

export interface EventRegistration {
  event: string
  handler: EventHandler
  priority: number
  once: boolean
  owner: string
}

// ─── Script Module ───────────────────────────────────────────

export interface ScriptMeta {
  name: string
  version?: string
  description?: string
}

export interface ScriptModule {
  meta?: ScriptMeta
  config?: Record<string, any>
  default: (api: KokoAPI) => void | (() => void)
}

// ─── Commands ────────────────────────────────────────────────

export interface ScriptCommandDef {
  handler: (args: string[], connectionId: string) => void
  description: string
  usage?: string
}

// ─── Timers ──────────────────────────────────────────────────

export interface TimerHandle {
  clear(): void
}

// ─── Store Access (read-only) ────────────────────────────────

export interface StoreAccess {
  getConnections(): Map<string, Connection>
  getBuffers(): Map<string, Buffer>
  getActiveBufferId(): string | null
  getConfig(): AppConfig | null
  getConnection(id: string): Connection | undefined
  getBuffer(id: string): Buffer | undefined
  subscribe(listener: () => void): () => void
}

// ─── IRC Access ──────────────────────────────────────────────

export interface IrcAccess {
  say(target: string, message: string, connectionId?: string): void
  action(target: string, message: string, connectionId?: string): void
  notice(target: string, message: string, connectionId?: string): void
  join(channel: string, key?: string, connectionId?: string): void
  part(channel: string, message?: string, connectionId?: string): void
  raw(line: string, connectionId?: string): void
  changeNick(nick: string, connectionId?: string): void
  whois(nick: string, connectionId?: string): void
  getClient(connectionId?: string): Client | undefined
}

// ─── UI Access ───────────────────────────────────────────────

export interface UiAccess {
  addLocalEvent(text: string): void
  addMessage(bufferId: string, message: Omit<Message, "id" | "timestamp">): void
  switchBuffer(bufferId: string): void
  makeBufferId(connectionId: string, name: string): string
}

// ─── Config Access ───────────────────────────────────────────

export interface ScriptConfigAccess {
  get<T = any>(key: string, defaultValue: T): T
  set(key: string, value: any): void
}

// ─── KokoAPI ─────────────────────────────────────────────────

export interface KokoAPI {
  meta: ScriptMeta

  // Events
  on(event: string, handler: EventHandler, priority?: number): () => void
  once(event: string, handler: EventHandler, priority?: number): () => void
  emit(event: string, data?: any): boolean

  // Commands
  command(name: string, def: ScriptCommandDef): void
  removeCommand(name: string): void

  // Timers
  timer(ms: number, handler: () => void): TimerHandle
  timeout(ms: number, handler: () => void): TimerHandle

  // Access
  store: StoreAccess
  irc: IrcAccess
  ui: UiAccess
  config: ScriptConfigAccess

  /** Event priority constants — use instead of importing EventPriority */
  EventPriority: typeof EventPriority

  log(...args: any[]): void
}

// ─── Event Payloads ──────────────────────────────────────────

export interface IrcMessageEvent {
  connectionId: string
  nick: string
  ident?: string
  hostname?: string
  target: string
  message: string
  tags?: Record<string, string>
  time?: string
  isChannel: boolean
}

export interface IrcJoinEvent {
  connectionId: string
  nick: string
  ident?: string
  hostname?: string
  channel: string
  account?: string
}

export interface IrcPartEvent {
  connectionId: string
  nick: string
  ident?: string
  hostname?: string
  channel: string
  message?: string
}

export interface IrcQuitEvent {
  connectionId: string
  nick: string
  ident?: string
  hostname?: string
  message?: string
}

export interface IrcKickEvent {
  connectionId: string
  nick: string
  ident?: string
  hostname?: string
  channel: string
  kicked: string
  message?: string
}

export interface IrcNickEvent {
  connectionId: string
  nick: string
  new_nick: string
  ident?: string
  hostname?: string
}

export interface IrcTopicEvent {
  connectionId: string
  nick?: string
  channel: string
  topic: string
}

export interface IrcModeEvent {
  connectionId: string
  nick?: string
  target: string
  modes: Array<{ mode: string; param?: string }>
}

export interface IrcInviteEvent {
  connectionId: string
  nick: string
  channel: string
}

export interface IrcNoticeEvent {
  connectionId: string
  nick?: string
  target?: string
  message: string
  from_server?: boolean
}

export interface IrcCtcpEvent {
  connectionId: string
  nick: string
  type: string
  message?: string
}

export interface IrcWallopsEvent {
  connectionId: string
  nick?: string
  message: string
  from_server?: boolean
}

// App events
export interface MessageAddEvent {
  bufferId: string
  message: Message
}

export interface BufferSwitchEvent {
  from: string | null
  to: string
}

export interface CommandInputEvent {
  command: string
  args: string[]
  connectionId: string
}

export interface ConnectedEvent {
  connectionId: string
  nick: string
}

export interface DisconnectedEvent {
  connectionId: string
}
