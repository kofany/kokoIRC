export type NickAlignment = 'left' | 'right' | 'center'

export type StatusbarItem = 'active_windows' | 'nick_info' | 'channel_info' | 'lag' | 'time'

export interface StatusbarConfig {
  // Status line (info bar above input)
  enabled: boolean
  items: StatusbarItem[]
  separator: string
  item_formats: Record<string, string>

  // Shared appearance for the whole bottom area (status + input)
  background: string
  text_color: string
  accent_color: string
  muted_color: string
  dim_color: string

  // Input line (prompt)
  prompt: string              // format: $channel, $nick, $buffer — substituted at render
  prompt_color: string
  input_color: string
  cursor_color: string
}

export const DEFAULT_ITEM_FORMATS: Record<StatusbarItem, string> = {
  active_windows: "Act: $win $activity",
  nick_info: "$nick$modes",
  channel_info: "$name$modes",
  lag: "Lag: $lag",
  time: "$time",
}

export type IgnoreLevel =
  | 'MSGS' | 'PUBLIC' | 'NOTICES' | 'ACTIONS'
  | 'JOINS' | 'PARTS' | 'QUITS' | 'NICKS' | 'KICKS'
  | 'CTCPS' | 'ALL'

export const ALL_IGNORE_LEVELS: IgnoreLevel[] = [
  'MSGS', 'PUBLIC', 'NOTICES', 'ACTIONS',
  'JOINS', 'PARTS', 'QUITS', 'NICKS', 'KICKS',
  'CTCPS', 'ALL',
]

export interface IgnoreEntry {
  mask: string            // nick or nick!user@host wildcard pattern
  levels: IgnoreLevel[]   // which event types to ignore
  channels?: string[]     // restrict to specific channels (empty = all)
}

export interface AppConfig {
  general: GeneralConfig
  display: DisplayConfig
  sidepanel: SidepanelConfig
  statusbar: StatusbarConfig
  servers: Record<string, ServerConfig>
  aliases: Record<string, string>
  ignores: IgnoreEntry[]
}

export interface GeneralConfig {
  nick: string
  username: string
  realname: string
  theme: string
  timestamp_format: string
  flood_protection: boolean
  ctcp_version: string
}

export interface DisplayConfig {
  nick_column_width: number
  nick_max_length: number
  nick_alignment: NickAlignment
  nick_truncation: boolean
  show_timestamps: boolean
  scrollback_lines: number
}

export interface SidepanelConfig {
  left: PanelConfig
  right: PanelConfig
}

export interface PanelConfig {
  width: number
  visible: boolean
}

export interface ServerConfig {
  label: string
  address: string
  port: number
  tls: boolean
  tls_verify: boolean
  autoconnect: boolean
  channels: string[]
  nick?: string              // per-server nick override (falls back to general.nick)
  username?: string           // per-server username override
  realname?: string           // per-server realname override
  password?: string           // server password (PASS command)
  sasl_user?: string
  sasl_pass?: string
  bind_ip?: string            // local IP to bind (vhost)
  encoding?: string           // character encoding (default: utf8)
  auto_reconnect?: boolean    // auto reconnect on disconnect (default: true)
  reconnect_delay?: number    // seconds between reconnect attempts (default: 30)
  reconnect_max_retries?: number // max reconnect attempts (default: 10)
}
