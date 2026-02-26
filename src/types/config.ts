export type NickAlignment = 'left' | 'right' | 'center'

export interface AppConfig {
  general: GeneralConfig
  display: DisplayConfig
  sidepanel: SidepanelConfig
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
