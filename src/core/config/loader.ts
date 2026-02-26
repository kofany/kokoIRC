import { parse as parseTOML } from "smol-toml"
import { DEFAULT_CONFIG } from "./defaults"
import type { AppConfig, ServerConfig } from "@/types/config"

export function mergeWithDefaults(partial: Record<string, any>): AppConfig {
  return {
    general: { ...DEFAULT_CONFIG.general, ...partial.general },
    display: { ...DEFAULT_CONFIG.display, ...partial.display },
    sidepanel: {
      left: { ...DEFAULT_CONFIG.sidepanel.left, ...partial.sidepanel?.left },
      right: { ...DEFAULT_CONFIG.sidepanel.right, ...partial.sidepanel?.right },
    },
    servers: partial.servers ?? {},
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
