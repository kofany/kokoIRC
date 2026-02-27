import type { AppConfig } from "@/types/config"

export type Handler = (args: string[], connectionId: string) => void

export interface CommandDef {
  handler: Handler
  description: string
  usage: string
  aliases?: string[]
}

export interface ResolvedConfig {
  value: any
  field: string
  isCredential: boolean
  serverId?: string
}

export const CREDENTIAL_FIELDS = new Set(["password", "sasl_pass"])
