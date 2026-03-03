import { Database } from "bun:sqlite"
import { LOG_DB_PATH } from "@/core/constants"
import type { LoggingConfig } from "./types"

let db: Database | null = null

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS messages (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    network   TEXT NOT NULL,
    buffer    TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    type      TEXT NOT NULL,
    nick      TEXT,
    text      TEXT NOT NULL,
    highlight INTEGER DEFAULT 0,
    iv        BLOB
  );

  CREATE INDEX IF NOT EXISTS idx_messages_lookup ON messages(network, buffer, timestamp);
  CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(timestamp);
`

const FTS_SCHEMA = `
  CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    nick, text, content=messages, content_rowid=id
  );
`

export function openDatabase(config: LoggingConfig): Database {
  if (db) return db

  db = new Database(LOG_DB_PATH, { create: true })
  db.run("PRAGMA journal_mode=WAL")
  db.run("PRAGMA synchronous=NORMAL")
  db.exec(SCHEMA)

  // FTS5 only in plain text mode (can't index encrypted text)
  if (!config.encrypt) {
    db.exec(FTS_SCHEMA)
  }

  return db
}

export function getDatabase(): Database | null {
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

/** Purge messages older than retention_days. Cleans FTS5 index if it exists. */
export function purgeOldMessages(retentionDays: number, hasFts: boolean): number {
  if (!db || retentionDays <= 0) return 0
  const cutoff = Date.now() - retentionDays * 86400_000
  // Clean FTS index before deleting rows (external content mode requires manual sync)
  if (hasFts) {
    db.run(
      "DELETE FROM messages_fts WHERE rowid IN (SELECT id FROM messages WHERE timestamp < ?)",
      [cutoff],
    )
  }
  const result = db.run("DELETE FROM messages WHERE timestamp < ?", [cutoff])
  return result.changes
}
