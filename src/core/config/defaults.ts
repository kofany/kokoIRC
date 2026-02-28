import type { AppConfig } from "@/types/config"

export const DEFAULT_CONFIG: AppConfig = {
  general: {
    nick: "opentui",
    username: "opentui",
    realname: "OpenTUI IRC Client",
    theme: "default",
    timestamp_format: "%H:%M:%S",
    flood_protection: true,
    ctcp_version: "kokoIRC \u2014 koko maxed irc client",
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
    items: ["active_windows", "nick_info", "channel_info", "lag"],
    separator: " | ",
    item_formats: {},

    // "" means "use theme color" — resolved at render time
    background: "",
    text_color: "",
    accent_color: "",
    muted_color: "",
    dim_color: "",

    prompt: "[$channel] > ",
    prompt_color: "",
    input_color: "",
    cursor_color: "",
  },
  servers: {},
  aliases: {},
  ignores: [],
}
