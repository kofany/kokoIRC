import type { AppConfig } from "@/types/config"

export const DEFAULT_CONFIG: AppConfig = {
  general: {
    nick: "opentui",
    username: "opentui",
    realname: "OpenTUI IRC Client",
    theme: "default",
    timestamp_format: "%H:%M:%S",
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
  servers: {},
}
