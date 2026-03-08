# Changelog

All notable changes to kokoIRC are documented here.

## [0.2.8] - 2026-03-08

### Fixed
- Image preview broken in compiled binary — `sharp` (native C addon) and `sixel` (UPNG) cannot be embedded by `bun build --compile`; replaced with `jimp` (pure JS) and a custom TypeScript sixel encoder with median-cut color quantization
- Better error reporting for image preview failures — full stack trace now shown in chat buffer instead of truncated popup

### Changed
- Removed native dependencies `sharp`, `sixel`, `@types/sharp`; added `jimp` (pure JS image processing)

## [0.2.7] - 2026-03-07

### Fixed
- Pasted content losing line breaks — OpenTUI's `<input>` component strips newlines from pasted text; now always calling `preventDefault()` in paste handler to manually insert text and preserve formatting

## [0.2.6] - 2026-03-06

### Fixed
- Channel modes not showing in statusbar — `getListModes()` crashed because kofany-irc-framework stores `CHANMODES` ISUPPORT as an array, not a comma-separated string; this silently killed the entire `channel info` (324) and `mode` event handlers, preventing modes from ever being stored

## [0.2.5] - 2026-03-05

### Added
- Multiline paste handling — detects newlines, sends lines with 500ms delay to avoid Excess Flood
- Wrap indentation — long messages indent continuation lines to align with message text start (`%|` marker)
- Nick truncation with `+` marker in chat and both sidebar panels
- Connection label truncation in left sidebar with `+` marker

### Changed
- Memory optimization — active/inactive buffer split: in-place mutation for non-visible buffers, immutable updates only for the active buffer React renders
- Dynamic sidebar truncation based on actual format overhead (handles variable-width refnums)
- AppLayout no longer subscribes to entire store (was re-rendering full tree on every IRC event)
- Stabilized ChatView/NickList/StatusLine selectors to prevent spurious re-renders
- Batched MODE/MOTD/WHOIS/ban-list handlers (single set() instead of N)
- Combined addMessageWithActivity (1 store update instead of 2 per privmsg)
- Image cache cleanup now runs on startup (was dead code)

### Fixed
- `/quit` now properly exits to command line (process.exit after renderer.destroy)
- Script store.subscribe() leak on unload
- disconnectServer not calling removeAllListeners + disposeSocket
- Auto-remove buffer on kick, clear reopCollector on close
- SplashScreen setTimeout leak on unmount
- Antiflood msgWindow splice optimization

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
