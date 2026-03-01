---
description: KokoIRC terminal client — Bun, OpenTUI React, kofany-irc-framework
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json, *.toml"
alwaysApply: true
---

# KokoIRC — Terminal IRC Client

Terminal IRC client built with **OpenTUI** (React reconciler for TUI) and **Bun**.
Binary name: `kokoirc` / `openirc` (compiled). Version 0.1.2.

## Available Skills

- **`opentui`** — OpenTUI core, React reconciler, and Solid reconciler. Use for any TUI component, layout, keyboard, or rendering questions.
- **`kofany-irc-framework`** — Our own fork of irc-framework (`kofany-irc-framework` on npm). Use for IRC protocol, events, client API, middleware.

Always invoke these skills when working on UI components or IRC logic.

## Architecture

```
src/
├── index.tsx              # Entry point — OpenTUI renderer + React mount
├── app/App.tsx            # Root React component, orchestrates connections
├── core/                  # UI-agnostic logic
│   ├── commands/          # Command system (parser, registry, execution, docs, help-formatter)
│   ├── config/            # TOML config loader + defaults (~/.kokoirc/)
│   ├── image-preview/     # Image preview pipeline (fetch, encode, render, cache, detect)
│   ├── irc/               # IRC client wrapper (client.ts) + event binding (events.ts)
│   ├── state/             # Zustand store + selectors (UI-agnostic state)
│   ├── theme/             # TOML theme loader + parser
│   └── constants.ts       # Directory paths, config locations
├── ui/                    # React components (OpenTUI)
│   ├── chat/              # ChatView.tsx, MessageLine.tsx
│   ├── layout/            # AppLayout.tsx (main layout), TopicBar.tsx
│   ├── sidebar/           # BufferList.tsx, NickList.tsx
│   ├── input/             # CommandInput.tsx
│   ├── statusbar/         # StatusLine.tsx
│   ├── overlay/           # ImagePreview.tsx
│   ├── splash/            # SplashScreen.tsx
│   ├── hooks/             # useStatusbarColors.ts
│   └── ErrorBoundary.tsx
├── types/                 # TypeScript types
│   ├── index.ts           # Connection, Buffer, Message, NickEntry
│   ├── config.ts          # AppConfig, ServerConfig, ImagePreviewConfig
│   ├── theme.ts           # ThemeFile, ThemeColors
│   └── irc-framework.d.ts # Type declarations for kofany-irc-framework
config/                    # Default TOML config
themes/                    # Default .theme TOML files
docs/commands/             # Command help markdown files (30+)
tests/                     # bun:test test files
```

### Key Design Decisions

- **Zustand store** (`src/core/state/store.ts`) is UI-agnostic — designed for potential future web frontend
- **IRC events** processed through `src/core/irc/events.ts` (30+ events) → Zustand store updates → React re-renders
- **TOML config** at `~/.kokoirc/config.toml` — general, display, servers, image preview, ignore rules
- **Themes** are TOML files with color palettes + format templates, support IRC `%Zrrggbb` color codes
- **Commands** follow irssi-like patterns: `/join`, `/msg`, `/whois`, `/set`, `/image`, `/preview`, etc.
- **Path alias**: `@/*` maps to `src/*`

## Dependencies

| Package | Purpose |
|---------|---------|
| `@opentui/core` + `@opentui/react` | Terminal UI framework with React reconciler |
| `kofany-irc-framework` | **Our fork** of irc-framework — IRC protocol client |
| `react` 19 | UI component library (rendered to terminal via OpenTUI) |
| `zustand` | State management (connections, buffers, messages, UI state) |
| `sharp` | Image processing for terminal preview encoding |
| `sixel` | Sixel graphics format encoder |
| `smol-toml` | TOML parser for config and themes |

## Image Preview (WIP — not working as of 2025-03-01 17:50 CET)

The image preview system in `src/core/image-preview/` supports multiple terminal protocols:
- Kitty Graphics Protocol (RGBA chunks)
- iTerm2 Inline Images
- Sixel format
- ASCII art symbols fallback
- tmux DCS passthrough wrapping

Pipeline: URL detection → fetch (with imgur/imgbb scraping) → sharp resize → encode → LRU disk cache (100MB, 7-day TTL) → render in overlay.

**Status**: Implementation exists but is not functioning correctly. The `/Users/k/dev/subterm` and `/Users/k/dev/erssi` repos are available as references for fixing.

## Running & Building

```bash
bun run src/index.tsx          # Run directly
bun --watch run src/index.tsx  # Watch mode (dev)
bun run dev                    # Same as watch mode
bun test                       # Run tests
bun run build                  # Compile → ./openirc (68MB binary)
```

## Bun Defaults

Use Bun instead of Node.js for everything:

- `bun <file>` not `node <file>` or `ts-node <file>`
- `bun test` not `jest` or `vitest`
- `bun install` not `npm/yarn/pnpm install`
- `bun run <script>` not `npm/yarn/pnpm run`
- `bunx <pkg>` not `npx <pkg>`
- Bun loads `.env` automatically — no dotenv needed

### Bun APIs to prefer

- `Bun.file()` over `node:fs` readFile/writeFile
- `Bun.$\`cmd\`` over execa
- `bun:sqlite` over better-sqlite3
- Built-in `WebSocket` over ws

## Testing

Tests in `tests/` use `bun:test`:

```ts
import { test, expect } from "bun:test";
```

Current test coverage: command parser, config loader, theme parser/loader, buffer sorting.

## English Corrections

If the user has made spelling or grammar mistakes in their message, include a correction section at the end of each response. The correct word should be **bold** and in magenta color:

```
---
User wrote "something", should be **`something`**
```

This helps the user improve their English writing skills.
