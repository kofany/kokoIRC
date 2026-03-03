import { parse as parseTOML, stringify as stringifyTOML } from "smol-toml"
import { DEFAULT_CONFIG } from "./defaults"
import { ENV_PATH } from "@/core/constants"
import type { AppConfig, ServerConfig, IgnoreEntry, ScriptsConfig } from "@/types/config"

/** Create a deep-ish clone of config, safe for in-place mutation. */
export function cloneConfig(config: AppConfig): AppConfig {
  return {
    general: { ...config.general },
    display: { ...config.display },
    sidepanel: {
      left: { ...config.sidepanel.left },
      right: { ...config.sidepanel.right },
    },
    statusbar: { ...config.statusbar, items: [...config.statusbar.items], item_formats: { ...config.statusbar.item_formats } },
    servers: Object.fromEntries(
      Object.entries(config.servers).map(([id, srv]) => [id, { ...srv, channels: [...srv.channels] }])
    ),
    aliases: { ...config.aliases },
    ignores: config.ignores.map((e) => ({
      ...e,
      levels: [...e.levels],
      channels: e.channels ? [...e.channels] : undefined,
    })),
    scripts: {
      ...config.scripts,
      autoload: [...config.scripts.autoload],
    },
    logging: {
      ...config.logging,
      exclude_types: [...config.logging.exclude_types],
    },
  }
}

export function mergeWithDefaults(partial: Record<string, any>): AppConfig {
  return {
    general: { ...DEFAULT_CONFIG.general, ...partial.general },
    display: { ...DEFAULT_CONFIG.display, ...partial.display },
    sidepanel: {
      left: { ...DEFAULT_CONFIG.sidepanel.left, ...partial.sidepanel?.left },
      right: { ...DEFAULT_CONFIG.sidepanel.right, ...partial.sidepanel?.right },
    },
    statusbar: { ...DEFAULT_CONFIG.statusbar, ...partial.statusbar },
    servers: partial.servers ?? {},
    aliases: partial.aliases ?? {},
    ignores: (partial.ignores as IgnoreEntry[] | undefined) ?? [],
    scripts: {
      autoload: [],
      debug: false,
      ...DEFAULT_CONFIG.scripts,
      ...partial.scripts,
    },
    logging: { ...DEFAULT_CONFIG.logging, ...partial.logging },
  }
}

export function loadCredentials(
  servers: Record<string, ServerConfig>,
  env: Record<string, string | undefined>,
): Record<string, ServerConfig> {
  const result: Record<string, ServerConfig> = {}
  for (const [id, server] of Object.entries(servers)) {
    const prefix = id.toUpperCase()
    result[id] = {
      ...server,
      sasl_user: env[`${prefix}_SASL_USER`] ?? server.sasl_user,
      sasl_pass: env[`${prefix}_SASL_PASS`] ?? server.sasl_pass,
      password: env[`${prefix}_PASSWORD`] ?? server.password,
    }
  }
  return result
}

export async function loadConfig(configPath: string): Promise<AppConfig> {
  const file = Bun.file(configPath)
  if (!(await file.exists())) {
    return { ...DEFAULT_CONFIG }
  }
  const text = await file.text()
  const parsed = parseTOML(text)
  const config = mergeWithDefaults(parsed)
  config.servers = loadCredentials(config.servers, process.env)
  return config
}

/** Strip undefined/empty optional fields before serializing to TOML */
function cleanServerForTOML(server: ServerConfig): Record<string, any> {
  const obj: Record<string, any> = {
    label: server.label,
    address: server.address,
    port: server.port,
    tls: server.tls,
    tls_verify: server.tls_verify,
    autoconnect: server.autoconnect,
    channels: server.channels,
  }
  // Only include non-empty optional fields
  if (server.nick) obj.nick = server.nick
  if (server.username) obj.username = server.username
  if (server.realname) obj.realname = server.realname
  if (server.bind_ip) obj.bind_ip = server.bind_ip
  if (server.encoding && server.encoding !== "utf8") obj.encoding = server.encoding
  if (server.auto_reconnect === false) obj.auto_reconnect = false
  if (server.reconnect_delay && server.reconnect_delay !== 30) obj.reconnect_delay = server.reconnect_delay
  if (server.reconnect_max_retries != null) obj.reconnect_max_retries = server.reconnect_max_retries
  // SASL and password stored in config only if NOT in .env — sasl_user kept, pass stripped
  if (server.sasl_user) obj.sasl_user = server.sasl_user
  // password and sasl_pass NOT saved to TOML — they go to .env
  return obj
}

/** Save the full config to TOML file */
export async function saveConfig(configPath: string, config: AppConfig): Promise<void> {
  // Build a clean object for serialization
  const tomlObj: Record<string, any> = {
    general: config.general,
    display: config.display,
    sidepanel: config.sidepanel,
    statusbar: {} as Record<string, any>,
    servers: {} as Record<string, any>,
  }

  // Statusbar: only non-empty values
  const sb = config.statusbar
  tomlObj.statusbar.enabled = sb.enabled
  tomlObj.statusbar.items = sb.items
  if (sb.separator) tomlObj.statusbar.separator = sb.separator
  if (sb.background) tomlObj.statusbar.background = sb.background
  if (sb.text_color) tomlObj.statusbar.text_color = sb.text_color
  if (sb.accent_color) tomlObj.statusbar.accent_color = sb.accent_color
  if (sb.muted_color) tomlObj.statusbar.muted_color = sb.muted_color
  if (sb.dim_color) tomlObj.statusbar.dim_color = sb.dim_color
  if (sb.prompt) tomlObj.statusbar.prompt = sb.prompt
  if (sb.prompt_color) tomlObj.statusbar.prompt_color = sb.prompt_color
  if (sb.input_color) tomlObj.statusbar.input_color = sb.input_color
  if (sb.cursor_color) tomlObj.statusbar.cursor_color = sb.cursor_color
  if (sb.item_formats && Object.keys(sb.item_formats).length > 0) {
    tomlObj.statusbar.item_formats = sb.item_formats
  }

  if (Object.keys(config.aliases).length > 0) {
    tomlObj.aliases = config.aliases
  }

  for (const [id, server] of Object.entries(config.servers)) {
    tomlObj.servers[id] = cleanServerForTOML(server)
  }

  if (config.ignores.length > 0) {
    tomlObj.ignores = config.ignores.map((e) => {
      const obj: Record<string, any> = { mask: e.mask, levels: e.levels }
      if (e.channels?.length) obj.channels = e.channels
      return obj
    })
  }

  // Scripts config — only write if non-default
  if (config.scripts) {
    const sc: Record<string, any> = {}
    if (config.scripts.autoload.length > 0) sc.autoload = config.scripts.autoload
    if (config.scripts.debug) sc.debug = true
    // Per-script configs: [scripts.my-script]
    for (const [key, val] of Object.entries(config.scripts)) {
      if (key === "autoload" || key === "debug") continue
      if (typeof val === "object" && val !== null) sc[key] = val
    }
    if (Object.keys(sc).length > 0) tomlObj.scripts = sc
  }

  // Logging config — only write non-default values
  if (config.logging) {
    const lg: Record<string, any> = {}
    if (!config.logging.enabled) lg.enabled = false  // only write if disabled (default is true)
    if (config.logging.encrypt) lg.encrypt = true
    if (config.logging.retention_days > 0) lg.retention_days = config.logging.retention_days
    if (config.logging.exclude_types.length > 0) lg.exclude_types = config.logging.exclude_types
    if (Object.keys(lg).length > 0) tomlObj.logging = lg
  }

  const toml = stringifyTOML(tomlObj)
  await Bun.write(configPath, toml)
}

/** Append or update credentials in .env file */
export async function saveCredentialsToEnv(
  serverId: string,
  credentials: { sasl_user?: string; sasl_pass?: string; password?: string },
): Promise<void> {
  const file = Bun.file(ENV_PATH)
  let content = (await file.exists()) ? await file.text() : ""

  const prefix = serverId.toUpperCase()
  const updates: [string, string][] = []
  if (credentials.sasl_user) updates.push([`${prefix}_SASL_USER`, credentials.sasl_user])
  if (credentials.sasl_pass) updates.push([`${prefix}_SASL_PASS`, credentials.sasl_pass])
  if (credentials.password) updates.push([`${prefix}_PASSWORD`, credentials.password])

  for (const [key, value] of updates) {
    const regex = new RegExp(`^${key}=.*$`, "m")
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`)
    } else {
      content = content.trimEnd() + (content.length > 0 ? "\n" : "") + `${key}=${value}\n`
    }
  }

  await Bun.write(ENV_PATH, content)
}
