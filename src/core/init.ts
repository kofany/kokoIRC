import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { HOME_DIR, CONFIG_PATH, DEFAULT_THEMES_DIR, SCRIPTS_DIR } from "./constants"
import { DEFAULT_CONFIG } from "./config/defaults"
import { saveConfig } from "./config/loader"

/** Create ~/.kokoirc/ and copy default themes + generate config on first run */
export async function initHomeDir(): Promise<void> {
  const themesDir = join(HOME_DIR, "themes")

  // Create directories
  await mkdir(themesDir, { recursive: true })
  await mkdir(SCRIPTS_DIR, { recursive: true })

  // Generate default config if missing
  const configFile = Bun.file(CONFIG_PATH)
  if (!(await configFile.exists())) {
    await saveConfig(CONFIG_PATH, DEFAULT_CONFIG)
  }

  // Copy default themes if themes dir is empty
  const glob = new Bun.Glob("*.theme")
  let hasThemes = false
  for await (const _ of glob.scan(themesDir)) { hasThemes = true; break }

  if (!hasThemes) {
    for await (const file of glob.scan(DEFAULT_THEMES_DIR)) {
      const src = Bun.file(join(DEFAULT_THEMES_DIR, file))
      await Bun.write(join(themesDir, file), src)
    }
  }
}
