import { getDatabase } from "./db"
import { LOG_DB_PATH } from "@/core/constants"
import { decrypt, loadOrCreateKey } from "./crypto"
import type { StoredMessage, LoggingConfig } from "./types"

let config: LoggingConfig | null = null

export function setQueryConfig(cfg: LoggingConfig): void {
  config = cfg
}

interface RawRow {
  id: number
  network: string
  buffer: string
  timestamp: number
  type: string
  nick: string | null
  text: string
  highlight: number
  iv: Uint8Array | null
}

async function decryptRow(row: RawRow): Promise<StoredMessage> {
  let text = row.text
  if (config?.encrypt && row.iv) {
    const key = await loadOrCreateKey()
    text = await decrypt(row.text, row.iv, key)
  }
  return {
    id: row.id,
    network: row.network,
    buffer: row.buffer,
    timestamp: row.timestamp,
    type: row.type as StoredMessage["type"],
    nick: row.nick,
    text,
    highlight: row.highlight === 1,
  }
}

/** Get messages for a buffer, paginated by timestamp (cursor-based). */
export async function getMessages(
  network: string,
  buffer: string,
  before?: number,
  limit: number = 100,
): Promise<StoredMessage[]> {
  const db = getDatabase()
  if (!db) return []

  let rows: RawRow[]
  if (before) {
    rows = db.prepare(
      "SELECT * FROM messages WHERE network = ? AND buffer = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT ?"
    ).all(network, buffer, before, limit) as RawRow[]
  } else {
    rows = db.prepare(
      "SELECT * FROM messages WHERE network = ? AND buffer = ? ORDER BY timestamp DESC LIMIT ?"
    ).all(network, buffer, limit) as RawRow[]
  }

  // Reverse to chronological order
  rows.reverse()

  const messages: StoredMessage[] = []
  for (const row of rows) {
    messages.push(await decryptRow(row))
  }
  return messages
}

/** Full-text search (plain mode only). */
export async function searchMessages(
  query: string,
  network?: string,
  buffer?: string,
  limit: number = 50,
): Promise<StoredMessage[]> {
  const db = getDatabase()
  if (!db || config?.encrypt) return []

  let sql = `
    SELECT m.* FROM messages m
    JOIN messages_fts fts ON m.id = fts.rowid
    WHERE messages_fts MATCH ?
  `
  // Wrap in double quotes for literal phrase match (escape internal quotes)
  const safeQuery = `"${query.replace(/"/g, '""')}"`
  const params: any[] = [safeQuery]

  if (network) {
    sql += " AND m.network = ?"
    params.push(network)
  }
  if (buffer) {
    sql += " AND m.buffer = ?"
    params.push(buffer)
  }

  sql += " ORDER BY m.timestamp DESC LIMIT ?"
  params.push(limit)

  const rows = db.prepare(sql).all(...params) as RawRow[]
  rows.reverse()

  return rows.map((row) => ({
    id: row.id,
    network: row.network,
    buffer: row.buffer,
    timestamp: row.timestamp,
    type: row.type as StoredMessage["type"],
    nick: row.nick,
    text: row.text,
    highlight: row.highlight === 1,
  }))
}

/** List all buffers that have logged messages for a network. */
export function getBuffers(network: string): string[] {
  const db = getDatabase()
  if (!db) return []

  const rows = db.prepare(
    "SELECT DISTINCT buffer FROM messages WHERE network = ? ORDER BY buffer"
  ).all(network) as { buffer: string }[]

  return rows.map((r) => r.buffer)
}

/** Get total message count and database file size. */
export function getStats(): { messageCount: number; dbSizeBytes: number } | null {
  const db = getDatabase()
  if (!db) return null

  const row = db.prepare("SELECT COUNT(*) as count FROM messages").get() as { count: number }
  const file = Bun.file(LOG_DB_PATH)

  return {
    messageCount: row.count,
    dbSizeBytes: file.size,
  }
}
