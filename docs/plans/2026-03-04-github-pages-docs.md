# kokoIRC GitHub Pages Documentation Site — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete documentation website for kokoIRC at `https://kofany.github.io/kokoIRC/` with dark terminal aesthetics, covering all features, commands, scripting API, theming, and roadmap.

**Architecture:** Markdown source files in `docs/src/content/` are converted to static HTML by a Bun build script (`docs/build.ts`). The script reads each .md file, applies a shared HTML template with sidebar navigation, and outputs to `docs/site/`. GitHub Pages serves from `docs/site/` on `main` branch.

**Tech Stack:** Bun (build script), pure HTML/CSS (output), vanilla JS (command search filter), GitHub Pages (hosting)

---

### Task 1: Create directory structure and CSS theme

**Files:**
- Create: `docs/site/.nojekyll` (empty file — tells GitHub Pages not to process with Jekyll)
- Create: `docs/src/css/style.css`

**Step 1: Create directory structure**

```bash
mkdir -p docs/src/content docs/src/css docs/src/templates docs/site
touch docs/site/.nojekyll
```

**Step 2: Write the CSS theme**

Create `docs/src/css/style.css` with Nightfall-inspired dark terminal design:
- Background: `#1a1b26` (body), `#24283b` (sidebar/cards)
- Text: `#a9b1d6`, headings: `#c0caf5`
- Accent blue: `#7aa2f7` (links, highlights)
- Accent green: `#9ece6a` (code, commands)
- Font: `'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace`
- Responsive: sidebar collapses to hamburger on mobile (<768px)
- Code blocks: `#1a1b26` bg with subtle border
- Tables: striped rows with `#24283b` alternating
- Sticky sidebar with scrollable nav, hamburger toggle for mobile
- Smooth scroll, selection color matching accent

**Step 3: Commit**

```bash
git add docs/src/ docs/site/.nojekyll
git commit -m "docs: add directory structure and dark terminal CSS theme"
```

---

### Task 2: Create HTML template and build script

**Files:**
- Create: `docs/src/templates/page.html` (HTML template with `{{title}}`, `{{content}}`, `{{nav}}` placeholders)
- Create: `docs/build.ts`

**Step 1: Write the HTML template**

`docs/src/templates/page.html` — a complete HTML page with:
- `<head>`: meta charset, viewport, title from `{{title}} — kokoIRC`, link to style.css
- `<body>`: sidebar nav (`{{nav}}`), main content area (`{{content}}`), prev/next links (`{{prev}}`, `{{next}}`)
- Mobile hamburger button (vanilla JS toggle)
- Footer with "Built with Bun" and GitHub link

**Step 2: Write the build script**

`docs/build.ts` — Bun script that:
1. Defines site map as an ordered array of `{ slug, title, source }` entries
2. Reads each markdown source from `docs/src/content/<slug>.md`
3. Converts markdown to HTML (use a simple regex-based converter or `marked` — check if already in deps via opentui)
4. Injects into template: replaces `{{title}}`, `{{content}}`, `{{nav}}` (generate sidebar from site map), `{{prev}}`/`{{next}}`
5. Copies `style.css` to `docs/site/css/`
6. Copies screenshots from `docs/screenshots/` to `docs/site/images/`
7. Writes output to `docs/site/<slug>.html` (and `docs/site/index.html` for home)

Add script to package.json:
```json
"docs:build": "bun run docs/build.ts"
```

**Step 3: Test the build script with a dummy page**

Create a minimal `docs/src/content/index.md` with just `# kokoIRC` and run:
```bash
bun run docs:build
```
Verify `docs/site/index.html` is generated with correct template.

**Step 4: Commit**

```bash
git add docs/build.ts docs/src/templates/ package.json
git commit -m "docs: add HTML template and Bun build script"
```

---

### Task 3: Write Home page

**Files:**
- Create: `docs/src/content/index.md`

**Content:**
- Hero section: kokoIRC name, tagline ("A modern terminal IRC client"), screenshot (splash.png)
- Feature highlights (from README — IRC protocol, navigation, scripting, theming, logging, single binary)
- Quick install: `bun install -g kokoirc`
- Link to Getting Started
- Screenshots gallery (chat.png, help.png, config.png)

**Step 1: Write the markdown**
**Step 2: Build and verify:** `bun run docs:build` then open `docs/site/index.html` in browser
**Step 3: Commit**

```bash
git add docs/src/content/index.md
git commit -m "docs: add home page content"
```

---

### Task 4: Write Getting Started pages

**Files:**
- Create: `docs/src/content/installation.md`
- Create: `docs/src/content/first-connection.md`
- Create: `docs/src/content/configuration.md`

**installation.md:**
- Requirements (Bun v1.2+, terminal with truecolor)
- Install from npm (`bun install -g kokoirc`)
- Install from source (git clone, bun install, bun run start)
- Build standalone binary (`bun run build` → `./openirc`)

**first-connection.md:**
- First launch (splash screen, config auto-created)
- Connect to a server (`/connect irc.libera.chat`)
- Join a channel (`/join #kokoirc`)
- Basic navigation (Esc+1-9, Page Up/Down, Tab completion)
- Keyboard shortcuts table

**configuration.md:**
- Config file location (`~/.kokoirc/config.toml`)
- Full annotated example config (from README)
- Sections: general, display, sidepanel, servers, aliases, logging, scripts
- Credentials/secrets in `~/.kokoirc/.env`
- SASL authentication setup
- Autosendcmd syntax (semicolon-separated, WAIT support)
- `/set` command for runtime changes, `/reload` to reload config

**Step 1: Write all three markdown files**
**Step 2: Build and verify**
**Step 3: Commit**

```bash
git add docs/src/content/installation.md docs/src/content/first-connection.md docs/src/content/configuration.md
git commit -m "docs: add getting started pages (install, first connection, config)"
```

---

### Task 5: Write Commands page

**Files:**
- Create: `docs/src/content/commands.md`

**Content:**
- Introduction paragraph
- Commands organized by category (same as README table but expanded)
- Each command: name, syntax, description, examples
- Source: use existing `docs/commands/*.md` files — the build script should read all 38 .md files from `docs/commands/` and merge them into the commands page, grouped by their `category` frontmatter
- Add client-side JS filter: text input that filters commands by name/description
- The filter JS should be a small inline script or separate `docs/src/js/search.js`

**Step 1: Write commands.md with category structure**

The build script needs special handling for this page — it should:
1. Read all `docs/commands/*.md` files
2. Parse frontmatter (category, description)
3. Group by category
4. Generate HTML with id anchors per command
5. Include filter input at top

**Step 2: Write search.js for client-side filtering**

Create `docs/src/js/search.js`:
- Listen on input event of filter field
- Show/hide command sections based on text match
- Show match count

**Step 3: Build and verify all 38 commands appear, filter works**
**Step 4: Commit**

```bash
git add docs/src/content/commands.md docs/src/js/
git commit -m "docs: add commands page with all 38 commands and search filter"
```

---

### Task 6: Write Scripting API pages

**Files:**
- Create: `docs/src/content/scripting-getting-started.md`
- Create: `docs/src/content/scripting-api.md`
- Create: `docs/src/content/scripting-examples.md`

**scripting-getting-started.md:**
- Overview: TypeScript scripts in `~/.kokoirc/scripts/`
- Script structure: `export default function`, `export const meta`, `export const config`
- Import rules: `import type` for `@/` paths, `api.EventPriority` for values
- Loading: `/script load`, autoload in config.toml
- Cleanup: return function from init

**scripting-api.md:**
- Full API reference for KokoAPI object:
  - `api.on(event, handler, priority?)` — event list with types
  - `api.command(name, handler | options)` — command registration
  - `api.irc.*` — say, action, notice, join, part, raw, whois
  - `api.ui.*` — addLocalEvent, switchBuffer
  - `api.store` — read-only access to connections/buffers
  - `api.config.get(key, default)` — per-script config
  - `api.EventPriority` — HIGHEST, HIGH, NORMAL, LOW, LOWEST
- All IRC events with their event object shapes
- App events: command_input, connected, disconnected

**scripting-examples.md:**
- slap.ts (custom command)
- auto-away.ts (event listener + timer)
- highlight-notify.ts (message filtering)
- spam-filter.ts (event priority + ctx.stop())

Source: `docs/commands/script.md` has most of this content already.

**Step 1: Write all three markdown files**
**Step 2: Build and verify**
**Step 3: Commit**

```bash
git add docs/src/content/scripting-*.md
git commit -m "docs: add scripting API documentation (guide, reference, examples)"
```

---

### Task 7: Write Theming pages

**Files:**
- Create: `docs/src/content/theming.md`
- Create: `docs/src/content/theming-format-strings.md`

**theming.md:**
- Overview: TOML theme files in `~/.kokoirc/themes/`
- Built-in theme: Nightfall
- Theme file structure: [meta], [colors], [abstracts], [formats.*]
- How to create a custom theme
- Setting active theme: `theme = "mytheme"` in config or `/set theme mytheme`

**theming-format-strings.md:**
- Color codes: `%k-%w` (named), `%K-%W` (bright), `%ZRRGGBB` (hex 24-bit)
- Style codes: `%_` bold, `%u` underline, `%i` italic, `%d` blink, `%N` reset
- Variables: `$0-$9` positional, `$*` all args
- Abstractions: `{name $args}` — template references
- Format sections: messages, events, nicks, channels
- Full reference table of all format codes

Source: README theming section + `src/core/theme/` code.

**Step 1: Write both markdown files**
**Step 2: Build and verify**
**Step 3: Commit**

```bash
git add docs/src/content/theming*.md
git commit -m "docs: add theming documentation (guide and format string reference)"
```

---

### Task 8: Write Logging & Search page

**Files:**
- Create: `docs/src/content/logging.md`

**Content:**
- Database location: `~/.kokoirc/logs.db`
- SQLite WAL mode — batched writes (50 messages or 1s)
- FTS5 full-text search: `/log search <query>`
- Optional AES-256-GCM encryption (key in `.env`)
- Read markers for per-client unread tracking
- Retention policy: `retention_days` in config
- Exclude types: filter out events, notices, etc.
- Log status: `/log status`
- Config example

**Step 1: Write markdown**
**Step 2: Build and verify**
**Step 3: Commit**

```bash
git add docs/src/content/logging.md
git commit -m "docs: add logging and search documentation"
```

---

### Task 9: Write Roadmap page

**Files:**
- Create: `docs/src/content/roadmap.md`

**Content:**
- **Now — Terminal Client (Stable)**: Feature-complete terminal IRC client with scripting, theming, encrypted logging, 38 commands, flood protection, netsplit detection
- **Next — Web UI**: Same smooth terminal aesthetics rendered in the browser. Real-time 1:1 state sync with terminal client via the UI-agnostic Zustand store. Connect from anywhere — your terminal session stays in sync.
- **Future — Mobile Web UI**: Responsive version of the web frontend optimized for phones and tablets. Same terminal-inspired design language, touch-friendly.
- **Vision**: One unified IRC experience across terminal, browser, and mobile browser. All web-based, no native apps. Switch devices without missing a message.
- Visual timeline or roadmap graphic (CSS-styled, no images needed)

**Step 1: Write markdown**
**Step 2: Build and verify**
**Step 3: Commit**

```bash
git add docs/src/content/roadmap.md
git commit -m "docs: add roadmap page (terminal → web → mobile web)"
```

---

### Task 10: Write FAQ / Migration page

**Files:**
- Create: `docs/src/content/faq.md`

**Content:**
- **Coming from irssi**: Familiar Esc+1-9, /commands, format strings — what's different
- **Coming from weechat**: Similar plugin/script model — comparison
- **Coming from The Lounge**: Web UI coming soon with 1:1 sync — why try terminal
- **Coming from mIRC**: Modern equivalent for power users
- General FAQ: requirements, where's config, how to report bugs, contributing

**Step 1: Write markdown**
**Step 2: Build and verify**
**Step 3: Commit**

```bash
git add docs/src/content/faq.md
git commit -m "docs: add FAQ and migration guide"
```

---

### Task 11: Final build, test all pages, and deploy commit

**Step 1: Run full build**

```bash
bun run docs:build
```

**Step 2: Verify all pages**

Open each page in browser and check:
- Navigation works (sidebar links, prev/next)
- Mobile responsive (hamburger menu)
- Screenshots display correctly
- Command search filter works
- All internal links resolve
- Code blocks render with syntax highlighting colors

**Step 3: Add docs/site/ to git and commit**

```bash
git add docs/site/ docs/src/
git commit -m "docs: complete GitHub Pages documentation site"
```

**Step 4: Push and configure GitHub Pages**

```bash
git push
```

Then configure GitHub Pages in repo settings:
- Source: Deploy from branch
- Branch: `main`
- Folder: `/docs/site`

**Step 5: Verify live site at https://kofany.github.io/kokoIRC/**
