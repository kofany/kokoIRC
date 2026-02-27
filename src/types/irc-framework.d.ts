declare module "irc-framework" {
  // ─── Event interfaces ──────────────────────────────────────

  export interface RegisteredEvent {
    nick: string
  }

  export interface JoinEvent {
    nick: string
    ident: string
    hostname: string
    channel: string
    account?: string
  }

  export interface PartEvent {
    nick: string
    channel: string
    message?: string
  }

  export interface QuitEvent {
    nick: string
    message?: string
  }

  export interface KickEvent {
    nick: string
    kicked: string
    channel: string
    message?: string
  }

  export interface PrivmsgEvent {
    nick: string
    ident?: string
    hostname?: string
    target: string
    message: string
    time?: string
    tags?: Record<string, string>
  }

  export interface ActionEvent {
    nick: string
    target: string
    message: string
    time?: string
    tags?: Record<string, string>
  }

  export interface NoticeEvent {
    nick: string
    ident?: string
    hostname?: string
    target: string
    message: string
    from_server?: boolean
    time?: string
  }

  export interface NickEvent {
    nick: string
    new_nick: string
  }

  export interface TopicEvent {
    nick?: string
    channel: string
    topic: string
  }

  export interface UserlistEvent {
    channel: string
    users: Array<{
      nick: string
      modes?: string[]
      away?: boolean
      account?: string
    }>
  }

  export interface ModeChange {
    mode: string
    param?: string
  }

  export interface ModeEvent {
    nick?: string
    target: string
    modes?: ModeChange[]
    raw_modes?: string
    raw_params?: string[]
  }

  export interface WhoisEvent {
    nick: string
    error?: boolean
    ident?: string
    hostname?: string
    real_name?: string
    channels?: string
    server?: string
    server_info?: string
    account?: string
    idle?: number
    logon?: number
    away?: string
    operator?: string
    secure?: boolean
    actually_secure?: boolean
    bot?: boolean
    special?: string | string[]
  }

  export interface NickInUseEvent {
    nick: string
  }

  export interface NickInvalidEvent {
    nick: string
    reason: string
  }

  export interface SaslFailedEvent {
    reason: string
    message?: string
  }

  export interface ServerOptionsEvent {
    options: Record<string, string>
  }

  export interface ReconnectingEvent {
    attempt?: number
    max_retries?: number
  }

  export interface IrcErrorEvent {
    message?: string
    error?: string
    reason?: string
    nick?: string
    channel?: string
    command?: string
    server?: string
    target_group?: string
  }

  export interface MotdEvent {
    motd: string
    error?: string
    tags?: Record<string, string>
  }

  export interface AwayEvent {
    self?: boolean
    nick?: string
    message?: string
    tags?: Record<string, string>
  }

  export interface BackEvent {
    self?: boolean
    nick?: string
    message?: string
    tags?: Record<string, string>
  }

  export interface ChannelRedirectEvent {
    from: string
    to: string
  }

  export interface InviteEvent {
    nick: string
    ident?: string
    hostname?: string
    channel: string
    time?: number
    tags?: Record<string, string>
  }

  export interface InvitedEvent {
    nick: string
    channel: string
    tags?: Record<string, string>
  }

  export interface LoggedInEvent {
    nick: string
    ident?: string
    hostname?: string
    account: string
    time?: number
    tags?: Record<string, string>
  }

  export interface DisplayedHostEvent {
    nick: string
    hostname: string
    tags?: Record<string, string>
  }

  export interface WhowasEvent {
    nick: string
    error?: boolean
    ident?: string
    hostname?: string
    real_name?: string
  }

  export interface BanListEvent {
    channel: string
    bans: Array<{
      banned: string
      banned_by: string
      banned_at: number
      tags?: Record<string, string>
    }>
    tags?: Record<string, string>
  }

  export interface WallopsEvent {
    from_server: boolean
    nick: string
    ident?: string
    hostname?: string
    message: string
    tags?: Record<string, string>
  }

  export interface UnknownCommandEvent {
    command: string
    params: string[]
    tags?: Record<string, string>
    prefix?: string
    nick?: string
    ident?: string
    hostname?: string
  }

  export interface SocketErrorEvent {
    message?: string
  }

  // ─── Connect options ───────────────────────────────────────

  export interface ConnectOptions {
    host: string
    port: number
    tls: boolean
    nick: string
    username: string
    gecos: string
    encoding?: string
    auto_reconnect?: boolean
    auto_reconnect_max_wait?: number
    auto_reconnect_max_retries?: number
    rejectUnauthorized?: boolean
    password?: string
    outgoing_addr?: string
    account?: {
      account: string
      password: string
    }
  }

  // ─── Client ────────────────────────────────────────────────

  export class Client {
    constructor()
    connect(options: ConnectOptions): void
    join(channel: string, key?: string): void
    part(channel: string, message?: string): void
    quit(message?: string): void
    say(target: string, message: string): void
    notice(target: string, message: string): void
    action(target: string, message: string): void
    raw(rawLine: string): void
    whois(nick: string, cb?: (event: WhoisEvent) => void): void
    changeNick(nick: string): void
    setTopic(channel: string, topic: string): void

    // Typed event overloads
    on(event: "registered", handler: (event: RegisteredEvent) => void): void
    on(event: "join", handler: (event: JoinEvent) => void): void
    on(event: "part", handler: (event: PartEvent) => void): void
    on(event: "quit", handler: (event: QuitEvent) => void): void
    on(event: "kick", handler: (event: KickEvent) => void): void
    on(event: "privmsg", handler: (event: PrivmsgEvent) => void): void
    on(event: "action", handler: (event: ActionEvent) => void): void
    on(event: "notice", handler: (event: NoticeEvent) => void): void
    on(event: "nick", handler: (event: NickEvent) => void): void
    on(event: "topic", handler: (event: TopicEvent) => void): void
    on(event: "userlist", handler: (event: UserlistEvent) => void): void
    on(event: "mode", handler: (event: ModeEvent) => void): void
    on(event: "whois", handler: (event: WhoisEvent) => void): void
    on(event: "nick in use", handler: (event: NickInUseEvent) => void): void
    on(event: "nick invalid", handler: (event: NickInvalidEvent) => void): void
    on(event: "sasl failed", handler: (event: SaslFailedEvent) => void): void
    on(event: "server options", handler: (event: ServerOptionsEvent) => void): void
    on(event: "reconnecting", handler: (event: ReconnectingEvent) => void): void
    on(event: "error", handler: (event: IrcErrorEvent) => void): void
    on(event: "irc error", handler: (event: IrcErrorEvent) => void): void
    on(event: "motd", handler: (event: MotdEvent) => void): void
    on(event: "away", handler: (event: AwayEvent) => void): void
    on(event: "back", handler: (event: BackEvent) => void): void
    on(event: "channel_redirect", handler: (event: ChannelRedirectEvent) => void): void
    on(event: "invite", handler: (event: InviteEvent) => void): void
    on(event: "invited", handler: (event: InvitedEvent) => void): void
    on(event: "loggedin", handler: (event: LoggedInEvent) => void): void
    on(event: "displayed host", handler: (event: DisplayedHostEvent) => void): void
    on(event: "whowas", handler: (event: WhowasEvent) => void): void
    on(event: "banlist", handler: (event: BanListEvent) => void): void
    on(event: "wallops", handler: (event: WallopsEvent) => void): void
    on(event: "unknown command", handler: (event: UnknownCommandEvent) => void): void
    on(event: "pong", handler: () => void): void
    on(event: "close", handler: () => void): void
    on(event: "socket connected", handler: () => void): void
    on(event: "socket error", handler: (error: SocketErrorEvent) => void): void
    on(event: "socket close", handler: (hadError: boolean) => void): void
    // Fallback for unknown events
    on(event: string, handler: (...args: any[]) => void): void

    off(event: string, handler: (...args: any[]) => void): void

    user: {
      nick: string
      username: string
      gecos: string
    }
  }
}
