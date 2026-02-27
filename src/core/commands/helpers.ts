import { useStore } from "@/core/state/store"
import { makeBufferId } from "@/types"
import type { AppConfig } from "@/types/config"
import { CREDENTIAL_FIELDS } from "./types"
import type { ResolvedConfig } from "./types"

/** Display a local event message in the active buffer. */
export function addLocalEvent(text: string) {
  const s = useStore.getState()
  const buf = s.activeBufferId
  if (!buf) return
  s.addMessage(buf, {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type: "event",
    text,
    highlight: false,
  })
}

/** Switch to a connection's Status buffer. */
export function switchToStatusBuffer(connId: string) {
  const s = useStore.getState()
  const statusId = makeBufferId(connId, "Status")
  if (s.buffers.has(statusId)) {
    s.setActiveBuffer(statusId)
  }
}

// ─── /set helpers ───────────────────────────────────────────

/** Resolve a dot-path like "general.nick" or "servers.ircnet.port" to the config value. */
export function getConfigValue(config: AppConfig, path: string): ResolvedConfig | null {
  const parts = path.split(".")
  if (parts.length < 2) return null

  const section = parts[0]

  // servers.<id>.<field>
  if (section === "servers") {
    if (parts.length < 3) return null
    const serverId = parts[1]
    const field = parts.slice(2).join(".")
    const server = config.servers[serverId]
    if (!server || !(field in server)) return null
    return {
      value: (server as any)[field],
      field,
      isCredential: CREDENTIAL_FIELDS.has(field),
      serverId,
    }
  }

  // aliases.<name> — allow creating new aliases via /set
  if (section === "aliases") {
    if (parts.length < 2) return null
    const name = parts[1]
    const value = config.aliases[name] ?? ""
    return { value, field: name, isCredential: false }
  }

  // sidepanel.left.<field> / sidepanel.right.<field>
  if (section === "sidepanel") {
    if (parts.length < 3) return null
    const side = parts[1] as "left" | "right"
    const field = parts[2]
    const panel = config.sidepanel?.[side]
    if (!panel || !(field in panel)) return null
    return { value: (panel as any)[field], field, isCredential: false }
  }

  // general.<field>, display.<field>, statusbar.<field>
  const field = parts.slice(1).join(".")
  const obj = (config as any)[section]
  if (!obj || typeof obj !== "object" || !(field in obj)) return null
  return { value: obj[field], field, isCredential: false }
}

/** Set a value in the config object in-place. */
export function setConfigValue(config: AppConfig, path: string, value: any): void {
  const parts = path.split(".")
  const section = parts[0]

  if (section === "aliases" && parts.length >= 2) {
    config.aliases[parts[1]] = String(value)
    return
  }

  if (section === "servers" && parts.length >= 3) {
    const server = config.servers[parts[1]]
    if (server) (server as any)[parts.slice(2).join(".")] = value
    return
  }

  if (section === "sidepanel" && parts.length >= 3) {
    const panel = (config.sidepanel as any)?.[parts[1]]
    if (panel) panel[parts[2]] = value
    return
  }

  const field = parts.slice(1).join(".")
  const obj = (config as any)[section]
  if (obj) obj[field] = value
}

/** Coerce a raw string value to match the type of the existing value. */
export function coerceValue(raw: string, existing: any): any {
  if (typeof existing === "boolean") {
    if (raw === "true") return true
    if (raw === "false") return false
    return undefined
  }
  if (typeof existing === "number") {
    const n = Number(raw)
    return isNaN(n) ? undefined : n
  }
  if (Array.isArray(existing)) {
    return raw.split(",").map((s) => s.trim())
  }
  return raw
}

/** Format a value for display. Escapes % so the theme parser doesn't eat color codes. */
export function formatValue(v: any): string {
  const raw = Array.isArray(v) ? v.join(", ") : String(v)
  return raw.replace(/%/g, "%%")
}

/** Display all settings grouped by section. */
export function listAllSettings(config: AppConfig): void {
  addLocalEvent(`%Z7aa2f7───── Settings ─────────────────────────────────%N`)

  const showSection = (label: string, prefix: string, obj: Record<string, any>) => {
    addLocalEvent(`%Z565f89[${label}]%N`)
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "object" && val !== null && !Array.isArray(val)) continue
      const fullPath = `${prefix}.${key}`
      const isCredential = CREDENTIAL_FIELDS.has(key)
      const display = isCredential ? "***" : formatValue(val)
      const envTag = isCredential ? " %Z565f89[.env]%N" : ""
      addLocalEvent(`  %Z7aa2f7${fullPath.padEnd(32)}%N= %Zc0caf5${display}%N${envTag}`)
    }
  }

  showSection("general", "general", config.general)
  showSection("display", "display", config.display)
  showSection("sidepanel.left", "sidepanel.left", config.sidepanel.left)
  showSection("sidepanel.right", "sidepanel.right", config.sidepanel.right)
  showSection("statusbar", "statusbar", config.statusbar)

  if (Object.keys(config.aliases).length > 0) {
    showSection("aliases", "aliases", config.aliases)
  }

  for (const [id, srv] of Object.entries(config.servers)) {
    showSection(`servers.${id}`, `servers.${id}`, srv)
  }

  addLocalEvent(`%Z7aa2f7─────────────────────────────────────────────────%N`)
}
