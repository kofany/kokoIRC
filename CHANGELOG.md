# Changelog

All notable changes to kokoIRC are documented here.

## [0.2.4] - 2026-03-04

### Changed
- Default quit message now shows "kokoIRC" with GitHub link
- Expanded npm keywords (17 tags) for better discoverability
- Added `engines` and `os` fields to package.json
- Updated README with current source tree, 44 commands, and image preview feature
- Added CHANGELOG.md for version history

## [0.2.3] - 2026-03-04

### Added
- `/invite` command — invite users to channels
- `/version` command (alias `/ver`) — query server or user client version via CTCP
- `/names` command — list users in a channel with prefix display
- `/topic` improvements — view current topic without arguments, request topic from server
- Image preview documentation page on the docs site

### Fixed
- malloc double-free crash during image preview by removing Bun stdin pause/resume (Bun issue #8695)
- Help `/help` now shows Media category in correct position

## [0.2.2] - 2026-03-03

### Added
- Inline image preview — kitty, iTerm2, sixel, and Unicode fallback protocols
- tmux support for image preview with automatic protocol detection
- `/image` and `/preview` commands for media display
- `/clear` command to clear buffer messages

### Changed
- Memory optimization: batched Zustand mutations reduce growth rate by ~80%
- Lightweight message IDs (incrementing counter replaces UUID strings)
- Fine-grained ChatView subscription prevents unnecessary re-renders
- Cached prepared statements in LogWriter for better SQLite performance

### Removed
- Unused `tags` field from Message interface

## [0.2.1] - 2026-02-28

### Added
- GitHub Pages documentation site (14 pages)
- Command docs auto-generated from markdown frontmatter
- FAQ and migration guide

## [0.2.0] - 2026-02-25

### Added
- Persistent chat logging with SQLite WAL mode
- AES-256-GCM per-message encryption (optional)
- FTS5 full-text search via `/log search`
- `/quote`, `/stats`, `/oper`, `/kill`, `/wallops` commands
- `autosendcmd` config for post-connect automation

## [0.1.0] - 2026-02-15

### Added
- Initial release — full IRC protocol support
- 30+ built-in commands (channels, queries, messaging, moderation)
- irssi-style navigation with `Esc+1-9` window switching
- Mouse support with clickable buffers, nick lists, draggable panels
- Netsplit detection with batched join/part floods
- Anti-flood protection (CTCP spam, nick-change floods)
- TOML theming with irssi-compatible format strings and 24-bit color
- TypeScript scripting with event bus and custom commands
- SASL authentication and TLS support
- Tab completion for nicks and commands
- Single binary compilation via `bun build --compile`
