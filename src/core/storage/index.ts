import type { MessageType } from "@/types"
import type { LoggingConfig, LogRow } from "./types"
import { openDatabase, closeDatabase, purgeOldMessages } from "./db"
import { setQueryConfig } from "./query"
import { LogWriter } from "./writer"

export type { LoggingConfig, LogRow, StoredMessage } from "./types"
export { getMessages, searchMessages, getBuffers, getStats } from "./query"

let writer: LogWriter | null = null
let loggingConfig: LoggingConfig | null = null

/** Initialize the storage system. Call after config is loaded, before connections. */
export async function initStorage(config: LoggingConfig): Promise<void> {
  if (!config.enabled) return

  loggingConfig = config
  const db = openDatabase(config)
  setQueryConfig(config)

  // Purge old messages on startup
  if (config.retention_days > 0) {
    const purged = purgeOldMessages(config.retention_days, !config.encrypt)
    if (purged > 0) {
      console.log(`[storage] purged ${purged} messages older than ${config.retention_days} days`)
    }
  }

  writer = new LogWriter(db, config)
  await writer.init()
}

/** Log a message. Called from store.addMessage(). */
export function logMessage(
  network: string,
  buffer: string,
  type: MessageType,
  text: string,
  nick: string | null,
  highlight: boolean,
  timestamp: Date,
): void {
  if (!writer) return

  const row: LogRow = {
    network,
    buffer,
    timestamp: timestamp.getTime(),
    type,
    nick,
    text,
    highlight: highlight ? 1 : 0,
  }

  writer.enqueue(row)
}

/** Flush pending writes and close the database. Call on shutdown. */
export async function shutdownStorage(): Promise<void> {
  if (writer) {
    await writer.shutdown()
    writer = null
  }
  closeDatabase()
  loggingConfig = null
}

/** Check if storage is active. */
export function isStorageActive(): boolean {
  return writer !== null
}
