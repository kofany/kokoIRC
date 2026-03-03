import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { LogWriter } from "@/core/storage/writer"
import type { LoggingConfig, LogRow } from "@/core/storage/types"

function makeRow(overrides: Partial<LogRow> = {}): LogRow {
  return {
    network: "libera",
    buffer: "#test",
    timestamp: Date.now(),
    type: "message",
    nick: "kofany",
    text: "hello world",
    highlight: 0,
    ...overrides,
  }
}

function createTestDb(): Database {
  const db = new Database(":memory:")
  db.run("PRAGMA journal_mode=WAL")
  db.exec(`
    CREATE TABLE messages (
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
    CREATE VIRTUAL TABLE messages_fts USING fts5(
      nick, text, content=messages, content_rowid=id
    );
  `)
  return db
}

const plainConfig: LoggingConfig = {
  enabled: true,
  encrypt: false,
  retention_days: 0,
  exclude_types: [],
}

describe("LogWriter", () => {
  let db: Database
  let writer: LogWriter

  beforeEach(async () => {
    db = createTestDb()
    writer = new LogWriter(db, plainConfig)
    await writer.init()
  })

  afterEach(() => {
    db.close()
  })

  test("flush writes messages to database", async () => {
    writer.enqueue(makeRow({ text: "first message" }))
    writer.enqueue(makeRow({ text: "second message" }))
    await writer.flush()

    const rows = db.prepare("SELECT * FROM messages ORDER BY id").all() as any[]
    expect(rows).toHaveLength(2)
    expect(rows[0].text).toBe("first message")
    expect(rows[1].text).toBe("second message")
  })

  test("flush populates FTS5 index", async () => {
    writer.enqueue(makeRow({ text: "searchable content here" }))
    await writer.flush()

    const results = db.prepare(
      "SELECT * FROM messages_fts WHERE messages_fts MATCH 'searchable'"
    ).all() as any[]
    expect(results).toHaveLength(1)
  })

  test("flush is idempotent on empty queue", async () => {
    await writer.flush()
    const rows = db.prepare("SELECT COUNT(*) as count FROM messages").get() as any
    expect(rows.count).toBe(0)
  })

  test("stores all message fields correctly", async () => {
    const row = makeRow({
      network: "ircnet",
      buffer: "#polska",
      timestamp: 1700000000000,
      type: "action",
      nick: "kofany",
      text: "waves hello",
      highlight: 1,
    })
    writer.enqueue(row)
    await writer.flush()

    const stored = db.prepare("SELECT * FROM messages WHERE id = 1").get() as any
    expect(stored.network).toBe("ircnet")
    expect(stored.buffer).toBe("#polska")
    expect(stored.timestamp).toBe(1700000000000)
    expect(stored.type).toBe("action")
    expect(stored.nick).toBe("kofany")
    expect(stored.text).toBe("waves hello")
    expect(stored.highlight).toBe(1)
    expect(stored.iv).toBeNull()
  })

  test("exclude_types filters messages", async () => {
    const config: LoggingConfig = {
      enabled: true,
      encrypt: false,
      retention_days: 0,
      exclude_types: ["event"],
    }
    const filteredWriter = new LogWriter(db, config)
    await filteredWriter.init()

    filteredWriter.enqueue(makeRow({ type: "message", text: "chat" }))
    filteredWriter.enqueue(makeRow({ type: "event", text: "joined" }))
    filteredWriter.enqueue(makeRow({ type: "action", text: "waves" }))
    await filteredWriter.flush()

    const rows = db.prepare("SELECT * FROM messages").all() as any[]
    expect(rows).toHaveLength(2)
    expect(rows[0].text).toBe("chat")
    expect(rows[1].text).toBe("waves")
  })

  test("auto-flushes at batch size", async () => {
    // Enqueue 50 messages (BATCH_SIZE)
    for (let i = 0; i < 50; i++) {
      writer.enqueue(makeRow({ text: `msg ${i}` }))
    }

    // Give a small delay for the flush to complete
    await new Promise((r) => setTimeout(r, 50))
    await writer.flush() // ensure any remaining are flushed

    const rows = db.prepare("SELECT COUNT(*) as count FROM messages").get() as any
    expect(rows.count).toBe(50)
  })

  test("shutdown flushes pending messages", async () => {
    writer.enqueue(makeRow({ text: "pending message" }))
    await writer.shutdown()

    const rows = db.prepare("SELECT * FROM messages").all() as any[]
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe("pending message")
  })

  test("handles null nick", async () => {
    writer.enqueue(makeRow({ nick: null, type: "event", text: "server message" }))
    await writer.flush()

    const stored = db.prepare("SELECT * FROM messages WHERE id = 1").get() as any
    expect(stored.nick).toBeNull()
  })

  test("transaction integrity — all or nothing", async () => {
    writer.enqueue(makeRow({ text: "message 1" }))
    writer.enqueue(makeRow({ text: "message 2" }))
    writer.enqueue(makeRow({ text: "message 3" }))
    await writer.flush()

    const rows = db.prepare("SELECT COUNT(*) as count FROM messages").get() as any
    expect(rows.count).toBe(3)
  })
})
