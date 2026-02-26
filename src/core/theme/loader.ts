import { parse as parseTOML } from "smol-toml"
import type { ThemeFile } from "@/types/theme"

export async function loadTheme(path: string): Promise<ThemeFile> {
  const file = Bun.file(path)
  const text = await file.text()
  const parsed = parseTOML(text) as unknown as ThemeFile
  return parsed
}
