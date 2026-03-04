import type { Database } from "bun:sqlite"
import type { LogRow, LoggingConfig, MessageListener } from "./types"
import { encrypt, loadOrCreateKey } from "./crypto"

const BATCH_SIZE = 50
const FLUSH_INTERVAL_MS = 1000

export class LogWriter {
  private queue: LogRow[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private flushing = false
  private db: Database
  private config: LoggingConfig
  private cryptoKey: CryptoKey | null = null
  private hasFts: boolean
  private listeners: MessageListener[] = []
  private insertStmt: ReturnType<Database["prepare"]> | null = null
  private insertFtsStmt: ReturnType<Database["prepare"]> | null = null

  constructor(db: Database, config: LoggingConfig) {
    this.db = db
    this.config = config
    this.hasFts = !config.encrypt
  }

  async init(): Promise<void> {
    if (this.config.encrypt) {
      this.cryptoKey = await loadOrCreateKey()
    }
    this.insertStmt = this.db.prepare(
      "INSERT INTO messages (msg_id, network, buffer, timestamp, type, nick, text, highlight, iv) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    if (this.hasFts) {
      this.insertFtsStmt = this.db.prepare(
        "INSERT INTO messages_fts (rowid, nick, text) VALUES (?, ?, ?)"
      )
    }
  }

  /** Subscribe to new messages (for WebSocket real-time push). */
  onMessage(listener: MessageListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  enqueue(row: LogRow): void {
    // Filter excluded message types
    if (this.config.exclude_types.includes(row.type)) return

    // Notify listeners immediately (before batching delay)
    for (const listener of this.listeners) {
      try { listener(row) } catch {}
    }

    this.queue.push(row)

    // Start timer on first buffered message
    if (this.queue.length === 1) {
      this.timer = setTimeout(() => {
        this.flush().catch((err) => console.error("[storage] flush error:", err))
      }, FLUSH_INTERVAL_MS)
    }

    // Flush immediately at batch size
    if (this.queue.length >= BATCH_SIZE) {
      this.flush().catch((err) => console.error("[storage] flush error:", err))
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (this.queue.length === 0 || this.flushing) return

    this.flushing = true
    const batch = this.queue.splice(0)

    const insert = this.insertStmt!
    const insertFts = this.insertFtsStmt

    try {
      // bun:sqlite transactions are sync, but encrypt is async — handle both modes
      if (this.cryptoKey) {
        // Encrypted mode: can't use bun:sqlite transaction wrapper (it's sync)
        this.db.run("BEGIN")
        try {
          for (const row of batch) {
            const encrypted = await encrypt(row.text, this.cryptoKey)
            insert.run(
              row.msg_id, row.network, row.buffer, row.timestamp, row.type,
              row.nick, encrypted.ciphertext, row.highlight, encrypted.iv,
            )
          }
          this.db.run("COMMIT")
        } catch (err) {
          this.db.run("ROLLBACK")
          throw err
        }
      } else {
        // Plain mode: synchronous transaction with FTS5
        const syncTransaction = this.db.transaction((rows: LogRow[]) => {
          for (const row of rows) {
            const result = insert.run(
              row.msg_id, row.network, row.buffer, row.timestamp, row.type,
              row.nick, row.text, row.highlight, null,
            )
            if (insertFts && result.lastInsertRowid) {
              insertFts.run(result.lastInsertRowid, row.nick ?? "", row.text)
            }
          }
        })
        syncTransaction(batch)
      }
    } finally {
      this.flushing = false
    }

    // If more messages accumulated during flush, flush again
    if (this.queue.length > 0) {
      await this.flush()
    }
  }

  async shutdown(): Promise<void> {
    await this.flush()
  }
}
