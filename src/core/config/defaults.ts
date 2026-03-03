import type { AppConfig } from "@/types/config"

export const DEFAULT_CONFIG: AppConfig = {
  general: {
    nick: "kokoIRC",
    username: "kokoirc",
    realname: "kokoIRC Client",
    theme: "default",
    timestamp_format: "%H:%M:%S",
    flood_protection: true,
    ctcp_version: "kokoIRC",
  },
  display: {
    nick_column_width: 8,
    nick_max_length: 8,
    nick_alignment: "right",
    nick_truncation: true,
    show_timestamps: true,
    scrollback_lines: 2000,
  },
  sidepanel: {
    left: { width: 20, visible: true },
    right: { width: 18, visible: true },
  },
  statusbar: {
    enabled: true,
    items: ["time", "nick_info", "channel_info", "lag", "active_windows"],
    separator: " | ",
    item_formats: {},

    // "" means "use theme color" — resolved at render time
    background: "",
    text_color: "",
    accent_color: "",
    muted_color: "",
    dim_color: "",

    prompt: "[$server\u2771 ",
    prompt_color: "",
    input_color: "",
    cursor_color: "",
  },
  servers: {
    ircnet: {
      label: "IRCnet",
      address: "hostsailor.ircnet.nl",
      port: 6697,
      tls: true,
      tls_verify: true,
      autoconnect: false,
      channels: ["#ircnet", "#polska"],
    },
  },
  aliases: {},
  ignores: [],
  scripts: {
    autoload: [],
    debug: false,
  },
}
