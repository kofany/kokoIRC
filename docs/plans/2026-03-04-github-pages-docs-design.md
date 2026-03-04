# kokoIRC Documentation Website — Design

**Date**: 2026-03-04
**Status**: Approved

## Overview

Full documentation site for kokoIRC hosted on GitHub Pages at `https://kofany.github.io/kokoIRC/`.

## Technical Approach

- Markdown source files in `docs/src/content/`
- Bun build script (`docs/build.ts`) converts .md → .html using a shared HTML template
- Output to `docs/site/` — GitHub Pages serves from this directory
- Single CSS file, dark terminal aesthetic (Nightfall theme palette)
- Zero external dependencies — pure HTML/CSS/minimal JS
- Command page gets client-side filter/search (vanilla JS)

## Design Tokens

- Background: `#1a1b26` / `#24283b`
- Text: `#a9b1d6`
- Accent blue: `#7aa2f7`
- Accent green: `#9ece6a`
- Font: system monospace stack

## Navigation

- Sticky sidebar on desktop
- Hamburger menu on mobile
- Prev/Next links at bottom of each page

## Site Map

```
Home (hero, feature highlights, screenshots)
├── Getting Started
│   ├── Installation
│   ├── First Connection
│   └── Configuration
├── Commands (all 38, organized by category, filterable)
├── Scripting API
│   ├── Getting Started
│   ├── API Reference
│   └── Examples
├── Theming
│   ├── Format Strings
│   └── Creating Themes
├── Logging & Search
├── Roadmap
└── FAQ / Migrating from irssi/weechat
```

## Roadmap Page Content

- **Now**: Terminal client — feature-complete with scripting, theming, encrypted logs
- **Next**: Web UI — same smooth terminal aesthetics, real-time 1:1 state sync with terminal via Zustand store (already UI-agnostic)
- **Future**: Mobile web UI — responsive version of the web frontend for phones/tablets
- **Vision**: One unified IRC experience across terminal, browser, and mobile browser — all web-based

## Audience

All three: IRC power users (migrating from irssi/weechat/mIRC/The Lounge), general users, and developers extending with scripts/themes.
