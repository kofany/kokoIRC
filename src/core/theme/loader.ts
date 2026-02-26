import { parse as parseTOML } from "smol-toml"
import type { ThemeFile, ThemeColors } from "@/types/theme"

const DEFAULT_COLORS: ThemeColors = {
  bg: "#1a1b26",
  bg_alt: "#16161e",
  border: "#292e42",
  fg: "#a9b1d6",
  fg_muted: "#565f89",
  fg_dim: "#292e42",
  accent: "#7aa2f7",
  cursor: "#7aa2f7",
}

const DEFAULT_THEME: ThemeFile = {
  meta: { name: "Fallback", description: "Minimal fallback theme" },
  colors: DEFAULT_COLORS,
  abstracts: {
    timestamp: "$*",
    msgnick: "$0$1> ",
    ownnick: "$*",
    pubnick: "$*",
  },
  formats: {
    messages: { pubmsg: "$0 $1", own_msg: "$0 $1" },
    events: {},
    sidepanel: { header: "$0", item: "$0. $1", item_selected: "> $0. $1" },
    nicklist: { normal: " $0" },
  },
}

export async function loadTheme(path: string): Promise<ThemeFile> {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    return DEFAULT_THEME
  }
  const text = await file.text()
  const parsed = parseTOML(text) as unknown as Partial<ThemeFile>
  return {
    meta: parsed.meta ?? DEFAULT_THEME.meta,
    colors: { ...DEFAULT_COLORS, ...parsed.colors },
    abstracts: parsed.abstracts ?? DEFAULT_THEME.abstracts,
    formats: parsed.formats ?? DEFAULT_THEME.formats,
  }
}
