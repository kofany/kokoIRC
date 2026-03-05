---
description: KokoIRC terminal client — Bun, OpenTUI React, kofany-irc-framework
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json, *.toml"
alwaysApply: true
---

# KokoIRC — Terminal IRC Client

Terminal IRC client built with **OpenTUI** (React reconciler for TUI) and **Bun**.
Binary name: `kokoirc` (compiled). Version 0.2.5.

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
bun run build                  # Compile → ./kokoirc (68MB binary)
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

## Documentation

When making changes to commands, features, config options, scripting API, or theming:
1. Update the relevant `docs/commands/*.md` files and/or `docs/src/content/*.md` pages
2. Run `bun run docs:build` to rebuild the GitHub Pages site
3. Commit the updated docs and built HTML together with the feature changes

The docs site lives at https://kofany.github.io/kokoIRC/ and is served from the `docs/` directory on `main`.

## Releasing a New Version

Steps to release (e.g., bumping from 0.2.5 to 0.2.6):

1. **Bump version** in `package.json`, `CLAUDE.md` (this file), and add a new section in `CHANGELOG.md`
2. **Build** the binary: `bun run build`
3. **Create tarball**: `tar czf kokoirc-VERSION-darwin-arm64.tar.gz kokoirc`
4. **Get sha256**: `shasum -a 256 kokoirc-VERSION-darwin-arm64.tar.gz`
5. **Commit & tag**:
   ```bash
   git add package.json CLAUDE.md CHANGELOG.md
   git commit -m "chore: bump to VERSION — summary"
   git tag vVERSION
   git push && git push --tags
   ```
6. **GitHub Release**: `gh release create vVERSION kokoirc-VERSION-darwin-arm64.tar.gz --title "vVERSION" --notes "..."`
7. **npm publish**: `npm publish --access public` (auth token in `~/.npmrc`)
8. **Homebrew tap** — update `Formula/kokoirc.rb` in `kofany/homebrew-tap`:
   ```bash
   # Write updated formula to /tmp/kokoirc.rb with new url + sha256, then:
   FORMULA_CONTENT=$(base64 < /tmp/kokoirc.rb)
   CURRENT_SHA=$(gh api repos/kofany/homebrew-tap/contents/Formula/kokoirc.rb --jq '.sha')
   gh api repos/kofany/homebrew-tap/contents/Formula/kokoirc.rb \
     -X PUT -f message="Update kokoirc to VERSION" \
     -f content="$FORMULA_CONTENT" -f sha="$CURRENT_SHA"
   ```
9. **Clean up**: remove the tarball from the working directory

## English Corrections

If the user has made spelling or grammar mistakes in their message, include a correction section at the end of each response. The correct word should be **bold** and in magenta color:

```
---
User wrote "something", should be **`something`**
```

This helps the user improve their English writing skills.
