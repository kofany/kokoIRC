declare module "kofany-irc-framework" {
  // ─── Event interfaces ──────────────────────────────────────

  export interface RegisteredEvent {
    nick: string
  }

  export interface JoinEvent {
    nick: string
    ident: string
    hostname: string
    gecos?: string
    channel: string
    time?: number
    account?: string
  }

  export interface PartEvent {
    nick: string
    ident: string
    hostname: string
    channel: string
    message?: string
    time?: number
  }

  export interface QuitEvent {
    nick: string
    ident: string
    hostname: string
    message?: string
    time?: number
  }

  export interface KickEvent {
    nick: string
    ident: string
    hostname: string
    kicked: string
    channel: string
    message?: string
    time?: number
  }

  export interface PrivmsgEvent {
    nick: string
    ident?: string
    hostname?: string
    target: string
    message: string
    time?: string
    tags?: Record<string, string>
    account?: string
  }

  export interface ActionEvent {
    nick: string
    ident?: string
    hostname?: string
    target: string
    message: string
    time?: string
    tags?: Record<string, string>
    account?: string
  }

  export interface NoticeEvent {
    nick: string
    ident?: string
    hostname?: string
    target: string
    message: string
    from_server?: boolean
    group?: string           // e.g. "@" for op-only notices
    time?: string
    tags?: Record<string, string>
    account?: string
  }

  export interface NickEvent {
    nick: string
    new_nick: string
    ident?: string
    hostname?: string
    time?: number
  }

  export interface TopicEvent {
    nick?: string
    channel: string
    topic: string
    time?: number
  }

  export interface TopicSetByEvent {
    nick: string
    ident?: string
    hostname?: string
    channel: string
    when: number             // unix timestamp
  }

  export interface UserlistEvent {
    channel: string
    users: Array<{
      nick: string
      modes?: string[]
      ident?: string
      hostname?: string
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

  export interface ChannelInfoEvent {
    channel: string
    // 324 — RPL_CHANNELMODEIS
    modes?: Array<{ mode: string; param?: string }>
    raw_modes?: string
    raw_params?: string[]
    // 329 — RPL_CREATIONTIME
    created_at?: number
    // 328 — RPL_CHANNEL_URL
    url?: string
    tags?: Record<string, string>
  }

  export interface UserInfoEvent {
    nick: string
    raw_modes: string        // e.g. "+Ri"
    tags?: Record<string, string>
  }

  export interface AccountEvent {
    nick: string
    ident?: string
    hostname?: string
    account: string | false  // false = logged out
    time?: number
  }

  export interface WhoisEvent {
    nick: string
    error?: boolean
    ident?: string
    hostname?: string
    actual_ip?: string
    actual_hostname?: string
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
    reason?: string
  }

  export interface NickInvalidEvent {
    nick: string
    reason: string
  }

  export interface SaslFailedEvent {
    reason: string
    message?: string
    nick?: string
    time?: number
    tags?: Record<string, string>
  }

  export interface ServerOptionsEvent {
    options: Record<string, string>
    cap?: Record<string, string>
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
    time?: number
    tags?: Record<string, string>
  }

  export interface BackEvent {
    self?: boolean
    nick?: string
    message?: string
    time?: number
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

  export interface LoggedOutEvent {
    nick: string
    ident?: string
    hostname?: string
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
    error?: boolean | string
    ident?: string
    hostname?: string
    actual_ip?: string
    actual_hostname?: string
    real_name?: string
    server?: string
    server_info?: string
    account?: string
    whowas?: Array<{
      nick: string
      ident?: string
      hostname?: string
      actual_ip?: string
      actual_hostname?: string
      real_name?: string
      server?: string
      server_info?: string
      account?: string
    }>
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

  export interface RawEvent {
    line: string
    from_server: boolean
  }

  export interface CtcpRequestEvent {
    nick: string
    ident?: string
    hostname?: string
    target: string
    type: string
    message: string
    time?: number
    account?: string
  }

  export interface CtcpResponseEvent {
    nick: string
    ident?: string
    hostname?: string
    target: string
    type: string
    message: string
    time?: number
    account?: string
  }

  export interface UserUpdatedEvent {
    nick: string
    ident: string
    hostname: string
    new_ident: string
    new_hostname: string
    time?: number
  }

  export interface ChannelListEvent {
    channel: string
    num_users: number
    topic: string
    tags?: Record<string, string>
  }

  export interface WholistEvent {
    target: string
    users: Array<{
      nick: string
      ident?: string
      hostname?: string
      server?: string
      real_name?: string
      away?: boolean
      num_hops_away?: number
      channel?: string
      tags?: Record<string, string>
    }>
    tags?: Record<string, string>
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
    version?: string | null            // null to handle VERSION CTCP manually
    enable_chghost?: boolean           // enable CHGHOST cap
    enable_echomessage?: boolean       // enable echo-message cap
    auto_reconnect?: boolean
    auto_reconnect_max_wait?: number
    auto_reconnect_max_retries?: number
    ping_interval?: number             // seconds between PINGs (default: 30)
    ping_timeout?: number              // seconds before timeout (default: 120)
    sasl_disconnect_on_fail?: boolean
    rejectUnauthorized?: boolean
    password?: string
    outgoing_addr?: string
    account?: {
      account: string
      password: string
    }
    webirc?: {
      password: string
      username: string
      hostname: string
      ip: string
      options?: Record<string, string>
    }
    client_certificate?: {
      private_key: string
      certificate: string
    }
    path?: string                      // Unix socket path
  }

  // ─── Channel object ────────────────────────────────────────

  export interface ChannelObject {
    say(message: string): void
    notice(message: string): void
    action(message: string): void
    part(message?: string): void
    join(key?: string): void
  }

  // ─── Client ────────────────────────────────────────────────

  export class Client {
    constructor()

    /** Whether the client is registered on the network */
    connected: boolean

    // Connection
    connect(options: ConnectOptions): void
    quit(message?: string): void
    ping(message?: string): void
    raw(rawLine: string): void
    rawString(...args: string[]): string
    requestCap(capability: string): void
    use(middleware: (client: Client, raw_events: any, parsed_events: any) => void): void

    // Messaging
    say(target: string, message: string, tags?: Record<string, string>): void
    notice(target: string, message: string, tags?: Record<string, string>): void
    action(target: string, message: string): void
    ctcpRequest(target: string, type: string, ...params: string[]): void
    ctcpResponse(target: string, type: string, ...params: string[]): void

    // Channels
    join(channel: string, key?: string): void
    part(channel: string, message?: string): void
    setTopic(channel: string, topic: string): void
    clearTopic(channel: string): void
    channel(name: string, key?: string): ChannelObject

    // Users
    changeNick(nick: string): void
    whois(nick: string, cb?: (event: WhoisEvent) => void): void
    who(target: string, cb?: (event: WholistEvent) => void): void
    list(...params: string[]): void

    // MONITOR
    addMonitor(target: string): void
    removeMonitor(target: string): void
    clearMonitor(): void
    monitorlist(cb?: (event: { nicks: string[] }) => void): void
    queryMonitor(): void

    // String utils (network casemapping)
    caseCompare(a: string, b: string): number
    caseUpper(str: string): string
    caseLower(str: string): string

    // Pattern matching
    match(regex: RegExp, cb: (event: any) => void, type?: string): void
    matchNotice(regex: RegExp, cb: (event: NoticeEvent) => void): void
    matchMessage(regex: RegExp, cb: (event: PrivmsgEvent) => void): void
    matchAction(regex: RegExp, cb: (event: ActionEvent) => void): void

    // Typed event overloads
    on(event: "registered", handler: (event: RegisteredEvent) => void): void
    on(event: "connected", handler: (event: RegisteredEvent) => void): void
    on(event: "join", handler: (event: JoinEvent) => void): void
    on(event: "part", handler: (event: PartEvent) => void): void
    on(event: "quit", handler: (event: QuitEvent) => void): void
    on(event: "kick", handler: (event: KickEvent) => void): void
    on(event: "privmsg", handler: (event: PrivmsgEvent) => void): void
    on(event: "action", handler: (event: ActionEvent) => void): void
    on(event: "notice", handler: (event: NoticeEvent) => void): void
    on(event: "nick", handler: (event: NickEvent) => void): void
    on(event: "topic", handler: (event: TopicEvent) => void): void
    on(event: "topicsetby", handler: (event: TopicSetByEvent) => void): void
    on(event: "userlist", handler: (event: UserlistEvent) => void): void
    on(event: "mode", handler: (event: ModeEvent) => void): void
    on(event: "channel info", handler: (event: ChannelInfoEvent) => void): void
    on(event: "user info", handler: (event: UserInfoEvent) => void): void
    on(event: "account", handler: (event: AccountEvent) => void): void
    on(event: "whois", handler: (event: WhoisEvent) => void): void
    on(event: "whowas", handler: (event: WhowasEvent) => void): void
    on(event: "wholist", handler: (event: WholistEvent) => void): void
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
    on(event: "loggedout", handler: (event: LoggedOutEvent) => void): void
    on(event: "displayed host", handler: (event: DisplayedHostEvent) => void): void
    on(event: "banlist", handler: (event: BanListEvent) => void): void
    on(event: "wallops", handler: (event: WallopsEvent) => void): void
    on(event: "unknown command", handler: (event: UnknownCommandEvent) => void): void
    on(event: "raw", handler: (event: RawEvent) => void): void
    on(event: "ctcp request", handler: (event: CtcpRequestEvent) => void): void
    on(event: "ctcp response", handler: (event: CtcpResponseEvent) => void): void
    on(event: "user updated", handler: (event: UserUpdatedEvent) => void): void
    on(event: "channel list start", handler: () => void): void
    on(event: "channel list", handler: (event: ChannelListEvent[]) => void): void
    on(event: "channel list end", handler: () => void): void
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
      host?: string
      away?: string
      modes?: Set<string>
    }
  }
}
