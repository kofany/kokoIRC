export type NickAlignment = 'left' | 'right' | 'center'

export type StatusbarItem = 'active_windows' | 'nick_info' | 'channel_info' | 'lag' | 'time'

export interface StatusbarConfig {
  // Status line (info bar above input)
  enabled: boolean
  items: StatusbarItem[]
  separator: string

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

export interface AppConfig {
  general: GeneralConfig
  display: DisplayConfig
  sidepanel: SidepanelConfig
  statusbar: StatusbarConfig
  servers: Record<string, ServerConfig>
}

export interface GeneralConfig {
  nick: string
  username: string
  realname: string
  theme: string
  timestamp_format: string
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
  autoconnect: boolean
  channels: string[]
  sasl_user?: string
  sasl_pass?: string
}
