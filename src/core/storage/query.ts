import { getDatabase } from "./db"
import { LOG_DB_PATH } from "@/core/constants"
import { decrypt, loadOrCreateKey } from "./crypto"
import type { StoredMessage, LoggingConfig, ReadMarker } from "./types"

let config: LoggingConfig | null = null

export function setQueryConfig(cfg: LoggingConfig): void {
  config = cfg
}

interface RawRow {
  id: number
  msg_id: string | null
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
    msg_id: row.msg_id ?? "",
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
    msg_id: row.msg_id ?? "",
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

// ─── Read Markers ──────────────────────────────────────────────

/** Update (upsert) a read marker for a client viewing a buffer. */
export function updateReadMarker(network: string, buffer: string, client: string, timestamp: number): void {
  const db = getDatabase()
  if (!db) return

  db.run(
    `INSERT INTO read_markers (network, buffer, client, last_read)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (network, buffer, client)
     DO UPDATE SET last_read = excluded.last_read`,
    [network, buffer, client, timestamp],
  )
}

/** Get the read marker for a specific client on a buffer. */
export function getReadMarker(network: string, buffer: string, client: string): number | null {
  const db = getDatabase()
  if (!db) return null

  const row = db.prepare(
    "SELECT last_read FROM read_markers WHERE network = ? AND buffer = ? AND client = ?"
  ).get(network, buffer, client) as { last_read: number } | null

  return row?.last_read ?? null
}

/** Get all read markers for a buffer (all clients). */
export function getReadMarkers(network: string, buffer: string): ReadMarker[] {
  const db = getDatabase()
  if (!db) return []

  return db.prepare(
    "SELECT * FROM read_markers WHERE network = ? AND buffer = ?"
  ).all(network, buffer) as ReadMarker[]
}

/** Count unread messages for a client on a buffer (messages after their last_read). */
export function getUnreadCount(network: string, buffer: string, client: string): number {
  const db = getDatabase()
  if (!db) return 0

  const marker = getReadMarker(network, buffer, client)
  if (marker === null) {
    // Never read — all messages are unread
    const row = db.prepare(
      "SELECT COUNT(*) as count FROM messages WHERE network = ? AND buffer = ?"
    ).get(network, buffer) as { count: number }
    return row.count
  }

  const row = db.prepare(
    "SELECT COUNT(*) as count FROM messages WHERE network = ? AND buffer = ? AND timestamp > ?"
  ).get(network, buffer, marker) as { count: number }
  return row.count
}
