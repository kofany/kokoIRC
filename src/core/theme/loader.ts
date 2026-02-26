import { parse as parseTOML } from "smol-toml"
import type { ThemeFile } from "@/types/theme"

const DEFAULT_THEME: ThemeFile = {
  meta: { name: "Fallback", description: "Minimal fallback theme" },
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
  const parsed = parseTOML(text) as unknown as ThemeFile
  return parsed
}
