import { homedir } from "node:os"
import { join } from "node:path"

// Package directory — where bundled defaults and docs live
const PKG_DIR = join(import.meta.dir, "../..")

// User home directory — mutable config, themes, .env
export const HOME_DIR = join(homedir(), ".kokoirc")

export const CONFIG_PATH = join(HOME_DIR, "config.toml")
export const THEME_PATH = (name: string) => join(HOME_DIR, "themes", `${name}.theme`)
export const DOCS_DIR = join(PKG_DIR, "docs/commands")
export const ENV_PATH = join(HOME_DIR, ".env")

// Default assets bundled with the package
export const DEFAULT_THEMES_DIR = join(PKG_DIR, "themes")
