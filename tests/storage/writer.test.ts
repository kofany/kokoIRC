import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { LogWriter } from "@/core/storage/writer"
import type { LoggingConfig, LogRow } from "@/core/storage/types"

let msgCounter = 0
function makeRow(overrides: Partial<LogRow> = {}): LogRow {
  return {
    msg_id: `test-${++msgCounter}`,
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
      msg_id    TEXT,
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
    CREATE TABLE read_markers (
      network    TEXT NOT NULL,
      buffer     TEXT NOT NULL,
      client     TEXT NOT NULL,
      last_read  INTEGER NOT NULL,
      PRIMARY KEY (network, buffer, client)
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
    msgCounter = 0
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

  test("stores msg_id (UUID)", async () => {
    writer.enqueue(makeRow({ msg_id: "abc-123-def" }))
    await writer.flush()

    const stored = db.prepare("SELECT msg_id FROM messages WHERE id = 1").get() as any
    expect(stored.msg_id).toBe("abc-123-def")
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
      msg_id: "uuid-test-1",
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
    expect(stored.msg_id).toBe("uuid-test-1")
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
    for (let i = 0; i < 50; i++) {
      writer.enqueue(makeRow({ text: `msg ${i}` }))
    }

    await new Promise((r) => setTimeout(r, 50))
    await writer.flush()

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

  test("onMessage listener fires on enqueue", async () => {
    const received: LogRow[] = []
    writer.onMessage((row) => received.push(row))

    writer.enqueue(makeRow({ text: "live message" }))
    expect(received).toHaveLength(1)
    expect(received[0].text).toBe("live message")
  })

  test("onMessage unsubscribe works", async () => {
    const received: LogRow[] = []
    const unsub = writer.onMessage((row) => received.push(row))

    writer.enqueue(makeRow({ text: "before unsub" }))
    unsub()
    writer.enqueue(makeRow({ text: "after unsub" }))

    expect(received).toHaveLength(1)
    expect(received[0].text).toBe("before unsub")
  })

  test("onMessage does not fire for excluded types", async () => {
    const config: LoggingConfig = {
      enabled: true,
      encrypt: false,
      retention_days: 0,
      exclude_types: ["event"],
    }
    const filteredWriter = new LogWriter(db, config)
    await filteredWriter.init()

    const received: LogRow[] = []
    filteredWriter.onMessage((row) => received.push(row))

    filteredWriter.enqueue(makeRow({ type: "message", text: "chat" }))
    filteredWriter.enqueue(makeRow({ type: "event", text: "joined" }))

    expect(received).toHaveLength(1)
    expect(received[0].text).toBe("chat")
  })
})

describe("read_markers", () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  test("upsert read marker", () => {
    db.run(
      "INSERT INTO read_markers (network, buffer, client, last_read) VALUES (?, ?, ?, ?)",
      ["libera", "#test", "tui", 1000],
    )
    // Update
    db.run(
      `INSERT INTO read_markers (network, buffer, client, last_read) VALUES (?, ?, ?, ?)
       ON CONFLICT (network, buffer, client) DO UPDATE SET last_read = excluded.last_read`,
      ["libera", "#test", "tui", 2000],
    )

    const row = db.prepare(
      "SELECT last_read FROM read_markers WHERE network = ? AND buffer = ? AND client = ?"
    ).get("libera", "#test", "tui") as any
    expect(row.last_read).toBe(2000)
  })

  test("multiple clients per buffer", () => {
    db.run(
      "INSERT INTO read_markers (network, buffer, client, last_read) VALUES (?, ?, ?, ?)",
      ["libera", "#test", "tui", 1000],
    )
    db.run(
      "INSERT INTO read_markers (network, buffer, client, last_read) VALUES (?, ?, ?, ?)",
      ["libera", "#test", "web-abc", 500],
    )

    const rows = db.prepare(
      "SELECT * FROM read_markers WHERE network = ? AND buffer = ?"
    ).all("libera", "#test") as any[]
    expect(rows).toHaveLength(2)
  })

  test("unread count based on read marker", () => {
    // Insert messages
    for (let i = 0; i < 10; i++) {
      db.run(
        "INSERT INTO messages (msg_id, network, buffer, timestamp, type, nick, text, highlight) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [`msg-${i}`, "libera", "#test", 1000 + i * 100, "message", "kofany", `msg ${i}`, 0],
      )
    }

    // Set read marker at timestamp 1500 (after msg 0-5, before msg 6-9)
    db.run(
      "INSERT INTO read_markers (network, buffer, client, last_read) VALUES (?, ?, ?, ?)",
      ["libera", "#test", "tui", 1500],
    )

    // timestamps: 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900
    // after 1500: 1600, 1700, 1800, 1900 = 4 unread
    const row = db.prepare(
      "SELECT COUNT(*) as count FROM messages WHERE network = ? AND buffer = ? AND timestamp > ?"
    ).get("libera", "#test", 1500) as any
    expect(row.count).toBe(4)
  })
})
