# Logging & Search

kokoIRC stores chat messages in a local SQLite database for persistent history and full-text search. Messages survive restarts and are available across sessions — no external service needed.

## Overview

When logging is enabled, every message that reaches the UI is written to a SQLite database at `~/.kokoirc/logs.db`. Messages filtered by `/ignore`, antiflood, or script `stop()` propagation are never stored.

The storage system is designed for speed and reliability:

- **WAL mode** — SQLite Write-Ahead Logging allows concurrent reads while writing
- **Batched writes** — messages are buffered and flushed every **50 messages** or every **1 second** (whichever comes first), in a single transaction
- **FTS5 index** — full-text search index for instant search across all channels and queries
- **Read markers** — per-client unread tracking, ready for future web frontend sync

## Configuration

Add a `[logging]` section to `~/.kokoirc/config.toml`:

```toml
[logging]
enabled = true
encrypt = false       # AES-256-GCM (key auto-generated in ~/.kokoirc/.env)
retention_days = 0    # 0 = keep forever
exclude_types = []    # filter: "message", "action", "event", "notice", "ctcp"
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | bool | `true` | Enable or disable chat logging entirely |
| `encrypt` | bool | `false` | Encrypt message content with AES-256-GCM |
| `retention_days` | int | `0` | Auto-delete messages older than N days. `0` = keep forever |
| `exclude_types` | array | `[]` | Message types to exclude from logging |

### Exclude types

The `exclude_types` array accepts any combination of these message types:

- `"message"` — regular channel and private messages
- `"action"` — `/me` actions
- `"event"` — join, part, quit, kick, mode changes, topic changes
- `"notice"` — server and user notices
- `"ctcp"` — CTCP requests and replies

A common setup to skip noisy join/part/quit events:

```toml
[logging]
exclude_types = ["event"]
```

## Database

### Location

All logs are stored in a single file:

```
~/.kokoirc/logs.db
```

The database uses SQLite with WAL (Write-Ahead Logging) mode and `PRAGMA synchronous=NORMAL` for a good balance between performance and durability.

### Schema

Messages are stored in a `messages` table with these columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-incrementing primary key |
| `msg_id` | TEXT | UUID shared across TUI and web clients |
| `network` | TEXT | Server/network identifier |
| `buffer` | TEXT | Channel or query name |
| `timestamp` | INTEGER | Unix milliseconds |
| `type` | TEXT | Message type (message, action, event, notice, ctcp) |
| `nick` | TEXT | Sender nick (null for system events) |
| `text` | TEXT | Message content (or ciphertext when encrypted) |
| `highlight` | INTEGER | 1 if the message triggered a highlight |
| `iv` | BLOB | Initialization vector (only when encrypted) |

Indexes cover `(network, buffer, timestamp)`, `(timestamp)`, and `(msg_id)` for fast lookups.

### Batched writes

Messages are not written to disk immediately. Instead, they are buffered in memory and flushed to the database when either condition is met:

1. The buffer reaches **50 messages**
2. **1 second** has elapsed since the first buffered message

Each flush writes all buffered messages in a **single transaction**, minimizing disk I/O and SQLite lock contention. On shutdown, any remaining buffered messages are flushed before the database closes.

## Full-text search

When encryption is disabled, kokoIRC creates an FTS5 (Full-Text Search 5) virtual table that indexes the `nick` and `text` columns. This enables instant full-text search across all logged messages.

### Using search

```
/log search <query>
```

Search runs against the current buffer's network and channel context. Results show the 20 most recent matches with timestamps.

Examples:

```
/log search ssl certificate
/log search meeting tomorrow
/log search "exact phrase"
```

The query uses SQLite FTS5 syntax under the hood, wrapped in a phrase match by default. This means your search terms are matched as an exact phrase.

### Limitations

- Search is **not available** in encrypted mode — ciphertext cannot be indexed
- Results are limited to 50 matches (showing the 20 most recent in the UI)

## Encryption

When `encrypt = true`, message content is encrypted with **AES-256-GCM** before being written to the database.

### How it works

1. On first use, a random 256-bit key is generated and saved to `~/.kokoirc/.env` as `KOKO_LOG_KEY`
2. The `.env` file permissions are set to `0600` (owner read/write only)
3. Each message gets a unique 12-byte random IV (initialization vector)
4. Only the `text` column is encrypted — metadata (network, buffer, nick, timestamp, type) remains in **plaintext** for indexing and querying

No password prompt is needed. The key lives alongside the database, following the same trust model as irssi log files or SSH keys — if someone has access to your home directory, they have access to your data.

### Trade-offs

Enabling encryption means:

- FTS5 search is disabled (you cannot search encrypted content)
- Writes are slightly slower due to per-message async encryption
- The key must be present in `.env` to read old messages

### Encryption config

```toml
[logging]
encrypt = true
```

The key is auto-generated on first write. You'll find it in `~/.kokoirc/.env`:

```
KOKO_LOG_KEY=<64-character hex string>
```

Back up this key if you want to preserve access to encrypted logs.

## Read markers

The database tracks per-client read positions using a `read_markers` table. Each marker stores:

- **network** and **buffer** — which conversation
- **client** — identifier (`tui` for the terminal client, or a web session ID)
- **last_read** — timestamp of the last read message

This enables unread count tracking per buffer per client. When multiple clients (TUI + future web frontend) access the same logs, each maintains its own read position.

## Retention

Set `retention_days` to automatically purge old messages:

```toml
[logging]
retention_days = 90    # delete messages older than 90 days
```

- `0` (default) = keep messages forever
- Purging runs on startup — messages older than the configured period are deleted in a single transaction
- When FTS5 is active, the search index is cleaned up before rows are deleted to maintain consistency

## Commands

### `/log status`

Show logging status including message count, database size, encryption mode, and database path.

```
/log status
```

This is the default when you run `/log` with no subcommand.

Output example:

```
───── Log Status ─────────────────────────
  Messages: 12,847
  Database: 4.2 MB
  Mode:     plain text
  Path:     /home/user/.kokoirc/logs.db
─────────────────────────────────────────────
```

### `/log search <query>`

Full-text search across all logged messages in the current buffer context.

```
/log search <query>
```

Results show the 20 most recent matches with timestamps and nicks.
