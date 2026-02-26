# OpenTUI IRC Client — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a modern terminal IRC client with OpenTUI React, irc-framework, multi-server support, irssi-inspired theming, and full mouse navigation.

**Architecture:** Three-layer separation: `types/` (data model), `core/` (business logic: IRC, state, config, theme, commands), `ui/` (pure React TUI components). State managed via zustand store. UI never imports irc-framework directly.

**Tech Stack:** Bun, TypeScript, OpenTUI React (`@opentui/react`, `@opentui/core`, `react@19+`), irc-framework, zustand, smol-toml

**Design doc:** `docs/plans/2026-02-26-irc-client-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/index.tsx`
- Create: `src/app/App.tsx`

**Step 1: Initialize project**

```bash
cd /Users/k/dev/opentui_irc
bun init -y
```

**Step 2: Install dependencies**

```bash
bun add @opentui/react @opentui/core react irc-framework zustand smol-toml
bun add -d @types/react @types/bun typescript
```

**Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "@opentui/react",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["bun-types"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

**Step 4: Write .gitignore**

```
node_modules/
dist/
.env
*.db
.DS_Store
```

**Step 5: Write .env.example**

```
# IRC Server Credentials
# Format: SERVERID_SASL_USER and SERVERID_SASL_PASS
# SERVERID must match [servers.SERVERID] key in config.toml (UPPERCASED)
# IRCNET_SASL_USER=myuser
# IRCNET_SASL_PASS=mypassword
# LIBERA_SASL_USER=myuser
# LIBERA_SASL_PASS=mypassword
```

**Step 6: Create directory structure**

```bash
mkdir -p src/{app,ui/{layout,chat,sidebar,input,common},core/{irc,state,config,theme,commands},types}
mkdir -p config themes tests
```

**Step 7: Write entry point `src/index.tsx`**

```tsx
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./app/App"

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  autoFocus: true,
  useMouse: true,
})

createRoot(renderer).render(<App />)
```

**Step 8: Write minimal App `src/app/App.tsx`**

```tsx
import { useRenderer, useKeyboard } from "@opentui/react"

export function App() {
  const renderer = useRenderer()

  useKeyboard((key) => {
    if (key.name === "q" && key.ctrl) {
      renderer.destroy()
    }
  })

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      border
      borderStyle="rounded"
      title="OpenTUI IRC"
      titleAlignment="center"
    >
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text>
          <span fg="#7aa2f7">OpenTUI IRC</span> — press <strong>Ctrl+Q</strong> to exit
        </text>
      </box>
    </box>
  )
}
```

**Step 9: Add scripts to package.json**

Add to package.json `scripts`:
```json
{
  "scripts": {
    "start": "bun run src/index.tsx",
    "dev": "bun --watch run src/index.tsx",
    "test": "bun test"
  }
}
```

**Step 10: Verify it runs**

Run: `bun run start`
Expected: Terminal shows bordered box with "OpenTUI IRC" centered, Ctrl+Q exits cleanly.

**Step 11: Commit**

```bash
git init
git add -A
git commit -m "feat: project scaffolding with OpenTUI React + Bun"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`
- Create: `src/types/config.ts`
- Create: `src/types/theme.ts`

**Step 1: Write core data types `src/types/index.ts`**

```typescript
// === Connection ===

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface Connection {
  id: string
  label: string
  status: ConnectionStatus
  nick: string
  userModes: string
  isupport: Record<string, string>
  error?: string
}

// === Buffer ===

export enum BufferType {
  Server = 'server',
  Channel = 'channel',
  Query = 'query',
  Special = 'special',
}

export enum SortGroup {
  Server = 1,
  Channel = 2,
  Query = 3,
  Special = 4,
}

export enum ActivityLevel {
  None = 0,
  Events = 1,
  Highlight = 2,
  Activity = 3,
  Mention = 4,
}

export interface Buffer {
  id: string                           // "ircnet/#polska"
  connectionId: string                 // "ircnet"
  type: BufferType
  name: string                         // "#polska", "Status", "nick"
  messages: Message[]
  activity: ActivityLevel
  unreadCount: number
  lastRead: Date
  // Channel-only:
  topic?: string
  topicSetBy?: string
  users: Map<string, NickEntry>
  modes?: string
}

// === Message ===

export type MessageType = 'message' | 'action' | 'event' | 'notice' | 'ctcp'

export interface Message {
  id: string
  timestamp: Date
  type: MessageType
  nick?: string
  nickMode?: string                    // @, +, etc.
  text: string
  highlight: boolean
  tags?: Record<string, string>
}

// === NickList ===

export interface NickEntry {
  nick: string
  prefix: string                       // ~, &, @, %, +, ''
  away: boolean
  account?: string
}

// === Sort helpers ===

export function getSortGroup(type: BufferType): SortGroup {
  switch (type) {
    case BufferType.Server: return SortGroup.Server
    case BufferType.Channel: return SortGroup.Channel
    case BufferType.Query: return SortGroup.Query
    case BufferType.Special: return SortGroup.Special
  }
}

export function makeBufferId(connectionId: string, name: string): string {
  return `${connectionId}/${name.toLowerCase()}`
}
```

**Step 2: Write config types `src/types/config.ts`**

```typescript
export type NickAlignment = 'left' | 'right' | 'center'

export interface AppConfig {
  general: GeneralConfig
  display: DisplayConfig
  sidepanel: SidepanelConfig
  servers: Record<string, ServerConfig>
}

export interface GeneralConfig {
  nick: string
  username: string
  realname: string
  theme: string
  timestamp_format: string
}

export interface DisplayConfig {
  nick_column_width: number
  nick_max_length: number
  nick_alignment: NickAlignment
  nick_truncation: boolean
  show_timestamps: boolean
  scrollback_lines: number
}

export interface SidepanelConfig {
  left: PanelConfig
  right: PanelConfig
}

export interface PanelConfig {
  width: number
  visible: boolean
}

export interface ServerConfig {
  label: string
  address: string
  port: number
  tls: boolean
  autoconnect: boolean
  channels: string[]
  // Loaded from .env at runtime:
  sasl_user?: string
  sasl_pass?: string
}
```

**Step 3: Write theme types `src/types/theme.ts`**

```typescript
export interface ThemeFile {
  meta: ThemeMeta
  abstracts: Record<string, string>
  formats: {
    messages: Record<string, string>
    events: Record<string, string>
    sidepanel: Record<string, string>
    nicklist: Record<string, string>
  }
}

export interface ThemeMeta {
  name: string
  description: string
}

// Output of theme format parser
export interface StyledSpan {
  text: string
  fg?: string          // hex color
  bg?: string          // hex color
  bold: boolean
  italic: boolean
  underline: boolean
  dim: boolean
}
```

**Step 4: Commit**

```bash
git add src/types/
git commit -m "feat: TypeScript type definitions for core data model"
```

---

## Task 3: Config System

**Files:**
- Create: `src/core/config/defaults.ts`
- Create: `src/core/config/loader.ts`
- Create: `config/config.toml`
- Create: `tests/core/config/loader.test.ts`

**Step 1: Write test `tests/core/config/loader.test.ts`**

```typescript
import { test, expect, describe } from "bun:test"
import { loadConfig, mergeWithDefaults, loadCredentials } from "@/core/config/loader"
import { DEFAULT_CONFIG } from "@/core/config/defaults"

describe("config defaults", () => {
  test("DEFAULT_CONFIG has all required fields", () => {
    expect(DEFAULT_CONFIG.general.nick).toBe("opentui")
    expect(DEFAULT_CONFIG.display.nick_column_width).toBe(8)
    expect(DEFAULT_CONFIG.display.nick_alignment).toBe("right")
    expect(DEFAULT_CONFIG.sidepanel.left.width).toBe(20)
    expect(DEFAULT_CONFIG.sidepanel.right.width).toBe(18)
  })
})

describe("mergeWithDefaults", () => {
  test("partial config merges with defaults", () => {
    const partial = {
      general: { nick: "kofany" },
      servers: {
        ircnet: {
          label: "IRCnet",
          address: "irc.example.com",
          port: 6697,
          tls: true,
          autoconnect: true,
          channels: ["#test"],
        },
      },
    }
    const result = mergeWithDefaults(partial)
    expect(result.general.nick).toBe("kofany")
    expect(result.general.username).toBe("opentui") // default
    expect(result.display.nick_column_width).toBe(8) // default
    expect(result.servers.ircnet.label).toBe("IRCnet")
  })
})

describe("loadCredentials", () => {
  test("maps ENV vars to server configs", () => {
    const env = {
      IRCNET_SASL_USER: "kofany",
      IRCNET_SASL_PASS: "secret123",
    }
    const servers = {
      ircnet: {
        label: "IRCnet",
        address: "irc.example.com",
        port: 6697,
        tls: true,
        autoconnect: true,
        channels: [],
      },
    }
    const result = loadCredentials(servers, env)
    expect(result.ircnet.sasl_user).toBe("kofany")
    expect(result.ircnet.sasl_pass).toBe("secret123")
  })

  test("ignores servers without matching env vars", () => {
    const servers = {
      libera: {
        label: "Libera",
        address: "irc.libera.chat",
        port: 6697,
        tls: true,
        autoconnect: true,
        channels: [],
      },
    }
    const result = loadCredentials(servers, {})
    expect(result.libera.sasl_user).toBeUndefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/core/config/`
Expected: FAIL — modules not found

**Step 3: Write defaults `src/core/config/defaults.ts`**

```typescript
import type { AppConfig } from "@/types/config"

export const DEFAULT_CONFIG: AppConfig = {
  general: {
    nick: "opentui",
    username: "opentui",
    realname: "OpenTUI IRC Client",
    theme: "default",
    timestamp_format: "%H:%M:%S",
  },
  display: {
    nick_column_width: 8,
    nick_max_length: 8,
    nick_alignment: "right",
    nick_truncation: true,
    show_timestamps: true,
    scrollback_lines: 2000,
  },
  sidepanel: {
    left: { width: 20, visible: true },
    right: { width: 18, visible: true },
  },
  servers: {},
}
```

**Step 4: Write loader `src/core/config/loader.ts`**

```typescript
import { parse as parseTOML } from "smol-toml"
import { DEFAULT_CONFIG } from "./defaults"
import type { AppConfig, ServerConfig } from "@/types/config"

export function mergeWithDefaults(partial: Record<string, any>): AppConfig {
  return {
    general: { ...DEFAULT_CONFIG.general, ...partial.general },
    display: { ...DEFAULT_CONFIG.display, ...partial.display },
    sidepanel: {
      left: { ...DEFAULT_CONFIG.sidepanel.left, ...partial.sidepanel?.left },
      right: { ...DEFAULT_CONFIG.sidepanel.right, ...partial.sidepanel?.right },
    },
    servers: partial.servers ?? {},
  }
}

export function loadCredentials(
  servers: Record<string, ServerConfig>,
  env: Record<string, string | undefined>,
): Record<string, ServerConfig> {
  const result: Record<string, ServerConfig> = {}
  for (const [id, server] of Object.entries(servers)) {
    const prefix = id.toUpperCase()
    result[id] = {
      ...server,
      sasl_user: env[`${prefix}_SASL_USER`] ?? server.sasl_user,
      sasl_pass: env[`${prefix}_SASL_PASS`] ?? server.sasl_pass,
    }
  }
  return result
}

export async function loadConfig(configPath: string): Promise<AppConfig> {
  const file = Bun.file(configPath)
  if (!(await file.exists())) {
    return { ...DEFAULT_CONFIG }
  }
  const text = await file.text()
  const parsed = parseTOML(text)
  const config = mergeWithDefaults(parsed)
  config.servers = loadCredentials(config.servers, process.env)
  return config
}
```

**Step 5: Write example config `config/config.toml`**

```toml
[general]
nick = "opentui-user"
username = "opentui"
realname = "OpenTUI IRC Client"
theme = "default"
timestamp_format = "%H:%M:%S"

[display]
nick_column_width = 8
nick_max_length = 8
nick_alignment = "right"
nick_truncation = true
show_timestamps = true
scrollback_lines = 2000

[sidepanel.left]
width = 20
visible = true

[sidepanel.right]
width = 18
visible = true

# [servers.libera]
# label = "Libera"
# address = "irc.libera.chat"
# port = 6697
# tls = true
# autoconnect = true
# channels = ["#opentui"]
```

**Step 6: Run tests**

Run: `bun test tests/core/config/`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add src/core/config/ src/types/ config/ tests/core/config/
git commit -m "feat: config system with TOML loading, defaults, and .env credentials"
```

---

## Task 4: Theme Engine — Parser

**Files:**
- Create: `src/core/theme/parser.ts`
- Create: `tests/core/theme/parser.test.ts`

**Step 1: Write tests `tests/core/theme/parser.test.ts`**

```typescript
import { test, expect, describe } from "bun:test"
import { parseFormatString, resolveAbstractions } from "@/core/theme/parser"
import type { StyledSpan } from "@/types/theme"

describe("parseFormatString", () => {
  test("plain text returns single span", () => {
    const result = parseFormatString("hello world")
    expect(result).toEqual([{ text: "hello world", bold: false, italic: false, underline: false, dim: false }])
  })

  test("%B sets bright blue foreground", () => {
    const result = parseFormatString("%Bhello%N")
    expect(result[0].fg).toBe("#5555ff")
    expect(result[0].text).toBe("hello")
  })

  test("%ZRRGGBB sets exact hex color", () => {
    const result = parseFormatString("%ZFF9500text%N")
    expect(result[0].fg).toBe("#FF9500")
    expect(result[0].text).toBe("text")
  })

  test("%_ toggles bold", () => {
    const result = parseFormatString("%_bold%_ notbold")
    expect(result[0].bold).toBe(true)
    expect(result[0].text).toBe("bold")
    expect(result[1].bold).toBe(false)
  })

  test("%N resets all styles", () => {
    const result = parseFormatString("%R%_red bold%N plain")
    expect(result[0].fg).toBe("#ff5555")
    expect(result[0].bold).toBe(true)
    expect(result[1].fg).toBeUndefined()
    expect(result[1].bold).toBe(false)
  })

  test("positional vars $0 $1 are substituted", () => {
    const result = parseFormatString("$0 said $1", ["kofany", "hello"])
    expect(result[0].text).toBe("kofany said hello")
  })

  test("padding $[8]0 right-pads to width", () => {
    const result = parseFormatString("$[8]0", ["hi"])
    expect(result[0].text).toBe("hi      ")
  })

  test("padding $[-8]0 left-pads to width", () => {
    const result = parseFormatString("$[-8]0", ["hi"])
    expect(result[0].text).toBe("      hi")
  })

  test("$* expands all params", () => {
    const result = parseFormatString("$*", ["a", "b", "c"])
    expect(result[0].text).toBe("a b c")
  })
})

describe("resolveAbstractions", () => {
  test("resolves {name $args} references", () => {
    const abstracts = {
      nick: "%B%_$*%_%N",
      msgnick: "$0{nick $1}❯ ",
    }
    const resolved = resolveAbstractions("{msgnick @ kofany}", abstracts)
    expect(resolved).toBe("@%B%_kofany%_%N❯ ")
  })

  test("handles nested abstractions", () => {
    const abstracts = {
      inner: "%R$*%N",
      outer: "before {inner $0} after",
    }
    const resolved = resolveAbstractions("{outer hello}", abstracts)
    expect(resolved).toBe("before %Rhello%N after")
  })

  test("returns original if abstraction not found", () => {
    const resolved = resolveAbstractions("{unknown test}", {})
    expect(resolved).toBe("{unknown test}")
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/core/theme/parser.test.ts`
Expected: FAIL

**Step 3: Implement parser `src/core/theme/parser.ts`**

The parser must:
1. Resolve `{abstraction $args}` references recursively (max depth 10)
2. Substitute `$0`, `$1`, `$*`, `$[N]0`, `$[-N]0` variables
3. Parse `%X` color codes into hex colors
4. Track style state (bold, italic, underline, dim) across the string
5. Split into `StyledSpan[]` whenever style changes

Color map (irssi-compatible):
```
%k=#000000  %K=#555555  (black)
%r=#aa0000  %R=#ff5555  (red)
%g=#00aa00  %G=#55ff55  (green)
%y=#aa5500  %Y=#ffff55  (yellow)
%b=#0000aa  %B=#5555ff  (blue)
%m=#aa00aa  %M=#ff55ff  (magenta)
%c=#00aaaa  %C=#55ffff  (cyan)
%w=#aaaaaa  %W=#ffffff  (white)
```

Implementation notes:
- Walk the format string char by char
- When `%` encountered, read next char(s) to determine action
- When `$` encountered, read variable spec
- When style changes, flush current span and start new one
- `%|` sets the indent column (store as metadata, don't emit text)

**Step 4: Run tests**

Run: `bun test tests/core/theme/parser.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/core/theme/parser.ts tests/core/theme/
git commit -m "feat: theme format string parser with irssi-compatible color codes"
```

---

## Task 5: Theme Engine — Loader & Renderer

**Files:**
- Create: `src/core/theme/loader.ts`
- Create: `src/core/theme/renderer.tsx`
- Create: `src/core/theme/index.ts`
- Create: `themes/default.theme`
- Create: `tests/core/theme/loader.test.ts`

**Step 1: Write test `tests/core/theme/loader.test.ts`**

```typescript
import { test, expect, describe } from "bun:test"
import { loadTheme } from "@/core/theme/loader"

describe("loadTheme", () => {
  test("loads and parses default theme", async () => {
    const theme = await loadTheme("themes/default.theme")
    expect(theme.meta.name).toBe("Default")
    expect(theme.abstracts.timestamp).toBeDefined()
    expect(theme.formats.messages.own_msg).toBeDefined()
    expect(theme.formats.events.join).toBeDefined()
    expect(theme.formats.sidepanel.item_selected).toBeDefined()
    expect(theme.formats.nicklist.op).toBeDefined()
  })
})
```

**Step 2: Write default theme file `themes/default.theme`**

Full TOML theme as specified in design doc (see Task 2 of design doc for complete theme content).

**Step 3: Write loader `src/core/theme/loader.ts`**

```typescript
import { parse as parseTOML } from "smol-toml"
import type { ThemeFile } from "@/types/theme"

export async function loadTheme(path: string): Promise<ThemeFile> {
  const file = Bun.file(path)
  const text = await file.text()
  const parsed = parseTOML(text) as unknown as ThemeFile
  return parsed
}
```

**Step 4: Write renderer `src/core/theme/renderer.tsx`**

This is the React component that converts `StyledSpan[]` into OpenTUI `<text>` elements:

```tsx
import type { StyledSpan } from "@/types/theme"

interface Props {
  spans: StyledSpan[]
}

export function StyledText({ spans }: Props) {
  return (
    <text>
      {spans.map((span, i) => {
        // Build nested modifier elements
        let content: any = span.text
        if (span.bold) content = <strong>{content}</strong>
        if (span.italic) content = <em>{content}</em>
        if (span.underline) content = <u>{content}</u>
        return (
          <span key={i} fg={span.fg} bg={span.bg}>
            {content}
          </span>
        )
      })}
    </text>
  )
}
```

**Step 5: Write barrel `src/core/theme/index.ts`**

```typescript
export { parseFormatString, resolveAbstractions } from "./parser"
export { loadTheme } from "./loader"
export { StyledText } from "./renderer"
```

**Step 6: Run tests**

Run: `bun test tests/core/theme/`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add src/core/theme/ themes/ tests/core/theme/
git commit -m "feat: theme loader, renderer, and default theme"
```

---

## Task 6: State Store

**Files:**
- Create: `src/core/state/store.ts`
- Create: `src/core/state/selectors.ts`
- Create: `src/core/state/sorting.ts`
- Create: `tests/core/state/sorting.test.ts`

**Step 1: Write sorting tests `tests/core/state/sorting.test.ts`**

```typescript
import { test, expect, describe } from "bun:test"
import { sortBuffers, sortNicks } from "@/core/state/sorting"
import { BufferType, ActivityLevel } from "@/types"

describe("sortBuffers", () => {
  test("sorts by connection label, then sort group, then name", () => {
    const buffers = [
      { connectionId: "libera", connectionLabel: "Libera", type: BufferType.Channel, name: "#opentui" },
      { connectionId: "ircnet", connectionLabel: "IRCnet", type: BufferType.Query, name: "kofany" },
      { connectionId: "ircnet", connectionLabel: "IRCnet", type: BufferType.Channel, name: "#polska" },
      { connectionId: "ircnet", connectionLabel: "IRCnet", type: BufferType.Channel, name: "#erssi" },
      { connectionId: "ircnet", connectionLabel: "IRCnet", type: BufferType.Server, name: "Status" },
    ]
    const sorted = sortBuffers(buffers as any)
    expect(sorted.map(b => b.name)).toEqual([
      "Status", "#erssi", "#polska", "kofany", "#opentui"
    ])
  })
})

describe("sortNicks", () => {
  test("sorts by prefix priority then alphabetically", () => {
    const nicks = [
      { nick: "zebra", prefix: "", away: false },
      { nick: "alpha", prefix: "@", away: false },
      { nick: "beta", prefix: "+", away: false },
      { nick: "omega", prefix: "@", away: false },
      { nick: "gamma", prefix: "", away: false },
    ]
    const prefixOrder = "~&@%+"
    const sorted = sortNicks(nicks, prefixOrder)
    expect(sorted.map(n => n.nick)).toEqual([
      "alpha", "omega", "beta", "gamma", "zebra"
    ])
  })
})
```

**Step 2: Implement sorting `src/core/state/sorting.ts`**

```typescript
import type { Buffer, NickEntry } from "@/types"
import { getSortGroup } from "@/types"

interface SortableBuffer {
  connectionLabel: string
  type: Buffer["type"]
  name: string
}

export function sortBuffers<T extends SortableBuffer>(buffers: T[]): T[] {
  return [...buffers].sort((a, b) => {
    // 1. Connection label (A-Z)
    const labelCmp = a.connectionLabel.localeCompare(b.connectionLabel, undefined, { sensitivity: "base" })
    if (labelCmp !== 0) return labelCmp

    // 2. Sort group
    const groupA = getSortGroup(a.type)
    const groupB = getSortGroup(b.type)
    if (groupA !== groupB) return groupA - groupB

    // 3. Name (A-Z)
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })
}

export function sortNicks(nicks: NickEntry[], prefixOrder: string): NickEntry[] {
  return [...nicks].sort((a, b) => {
    const prefixA = a.prefix ? prefixOrder.indexOf(a.prefix) : prefixOrder.length
    const prefixB = b.prefix ? prefixOrder.indexOf(b.prefix) : prefixOrder.length
    // Unknown prefixes go after known ones
    const pA = prefixA === -1 ? prefixOrder.length : prefixA
    const pB = prefixB === -1 ? prefixOrder.length : prefixB
    if (pA !== pB) return pA - pB
    return a.nick.localeCompare(b.nick, undefined, { sensitivity: "base" })
  })
}
```

**Step 3: Implement store `src/core/state/store.ts`**

Zustand store with these slices:

```typescript
import { create } from "zustand"
import type { Connection, Buffer, Message, NickEntry, ActivityLevel, BufferType } from "@/types"
import type { AppConfig } from "@/types/config"
import type { ThemeFile } from "@/types/theme"
import { makeBufferId } from "@/types"

interface AppState {
  // Data
  connections: Map<string, Connection>
  buffers: Map<string, Buffer>
  activeBufferId: string | null
  config: AppConfig | null
  theme: ThemeFile | null

  // Actions — connections
  addConnection: (conn: Connection) => void
  updateConnection: (id: string, updates: Partial<Connection>) => void
  removeConnection: (id: string) => void

  // Actions — buffers
  addBuffer: (buffer: Buffer) => void
  removeBuffer: (id: string) => void
  setActiveBuffer: (id: string) => void
  updateBufferActivity: (id: string, level: ActivityLevel) => void

  // Actions — messages
  addMessage: (bufferId: string, message: Message) => void

  // Actions — nicklist
  addNick: (bufferId: string, entry: NickEntry) => void
  removeNick: (bufferId: string, nick: string) => void
  updateNick: (bufferId: string, oldNick: string, newNick: string, prefix?: string) => void

  // Actions — config/theme
  setConfig: (config: AppConfig) => void
  setTheme: (theme: ThemeFile) => void
}
```

Implementation uses `Map` for O(1) lookups. Messages are appended with `scrollback_lines` limit.

**Step 4: Implement selectors `src/core/state/selectors.ts`**

```typescript
import { useStore } from "./store"
import { sortBuffers, sortNicks } from "./sorting"
import type { Buffer, NickEntry } from "@/types"

export function useActiveBuffer(): Buffer | null {
  return useStore((s) => {
    if (!s.activeBufferId) return null
    return s.buffers.get(s.activeBufferId) ?? null
  })
}

export function useSortedBuffers(): Array<Buffer & { connectionLabel: string }> {
  return useStore((s) => {
    const list = Array.from(s.buffers.values()).map((buf) => ({
      ...buf,
      connectionLabel: s.connections.get(buf.connectionId)?.label ?? buf.connectionId,
    }))
    return sortBuffers(list)
  })
}

export function useSortedNicks(bufferId: string, prefixOrder: string): NickEntry[] {
  return useStore((s) => {
    const buf = s.buffers.get(bufferId)
    if (!buf) return []
    return sortNicks(Array.from(buf.users.values()), prefixOrder)
  })
}

export function useConnection(id: string) {
  return useStore((s) => s.connections.get(id))
}
```

**Step 5: Run tests**

Run: `bun test tests/core/state/`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/core/state/ tests/core/state/
git commit -m "feat: zustand state store with buffer/nick sorting"
```

---

## Task 7: IRC Client Wrapper

**Files:**
- Create: `src/core/irc/client.ts`
- Create: `src/core/irc/events.ts`
- Create: `src/core/irc/index.ts`

**Step 1: Write event mapper `src/core/irc/events.ts`**

Maps irc-framework events to store actions. Key events to handle:

| irc-framework event | Store action |
|---------------------|-------------|
| `registered` | `updateConnection(status: 'connected')`, `addBuffer(server)` |
| `close` | `updateConnection(status: 'disconnected')` |
| `join` | `addBuffer(channel)` or `addNick()` |
| `part` | `removeNick()` or `removeBuffer()` |
| `quit` | `removeNick()` from all buffers |
| `kick` | `removeNick()` or `removeBuffer()` |
| `privmsg` | `addMessage()`, update activity |
| `notice` | `addMessage()` to appropriate buffer |
| `action` | `addMessage(type: 'action')` |
| `nick` | `updateNick()` across all buffers |
| `topic` | Update buffer topic |
| `userlist` | Populate buffer users |
| `mode` | Update nick prefixes |

```typescript
import type { useStore } from "@/core/state/store"
import { makeBufferId, BufferType, ActivityLevel } from "@/types"
import type { Message } from "@/types"

type Store = ReturnType<typeof useStore.getState>

export function bindEvents(client: any, connectionId: string, store: Store) {
  const getStore = () => useStore.getState()

  client.on("registered", (event: any) => {
    const s = getStore()
    s.updateConnection(connectionId, { status: "connected", nick: event.nick })
    s.addBuffer({
      id: makeBufferId(connectionId, "Status"),
      connectionId,
      type: BufferType.Server,
      name: "Status",
      messages: [],
      activity: ActivityLevel.None,
      unreadCount: 0,
      lastRead: new Date(),
      users: new Map(),
    })
    // Set active buffer if none set
    if (!s.activeBufferId) {
      s.setActiveBuffer(makeBufferId(connectionId, "Status"))
    }
  })

  client.on("join", (event: any) => {
    const s = getStore()
    const bufferId = makeBufferId(connectionId, event.channel)
    const conn = s.connections.get(connectionId)

    if (event.nick === conn?.nick) {
      // We joined — create buffer
      s.addBuffer({
        id: bufferId,
        connectionId,
        type: BufferType.Channel,
        name: event.channel,
        messages: [],
        activity: ActivityLevel.None,
        unreadCount: 0,
        lastRead: new Date(),
        users: new Map(),
      })
      s.setActiveBuffer(bufferId)
    } else {
      // Someone else joined
      s.addNick(bufferId, { nick: event.nick, prefix: "", away: false })
      s.addMessage(bufferId, makeEventMessage(
        `${event.nick} (${event.ident}@${event.hostname}) has joined ${event.channel}`
      ))
    }
  })

  // ... similar handlers for: part, quit, kick, privmsg, action, notice,
  //     nick, topic, userlist, mode

  client.on("privmsg", (event: any) => {
    const s = getStore()
    const isChannel = event.target.startsWith("#") || event.target.startsWith("&")
    const bufferName = isChannel ? event.target : event.nick
    const bufferId = makeBufferId(connectionId, bufferName)

    // Create query buffer if it doesn't exist
    if (!isChannel && !s.buffers.has(bufferId)) {
      s.addBuffer({
        id: bufferId,
        connectionId,
        type: BufferType.Query,
        name: event.nick,
        messages: [],
        activity: ActivityLevel.None,
        unreadCount: 0,
        lastRead: new Date(),
        users: new Map(),
      })
    }

    const conn = s.connections.get(connectionId)
    const isOwnMsg = event.nick === conn?.nick
    const isMention = !isOwnMsg && event.message.toLowerCase().includes(conn?.nick.toLowerCase() ?? "")

    s.addMessage(bufferId, {
      id: crypto.randomUUID(),
      timestamp: new Date(event.time || Date.now()),
      type: "message",
      nick: event.nick,
      nickMode: getNickMode(s, bufferId, event.nick),
      text: event.message,
      highlight: isMention,
      tags: event.tags,
    })

    // Update activity if not active buffer
    if (s.activeBufferId !== bufferId && !isOwnMsg) {
      const level = !isChannel ? ActivityLevel.Mention
        : isMention ? ActivityLevel.Mention
        : ActivityLevel.Activity
      s.updateBufferActivity(bufferId, level)
    }
  })

  client.on("close", () => {
    getStore().updateConnection(connectionId, { status: "disconnected" })
  })
}

function makeEventMessage(text: string): Message {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type: "event",
    text,
    highlight: false,
  }
}

function getNickMode(store: Store, bufferId: string, nick: string): string {
  const buf = store.buffers.get(bufferId)
  return buf?.users.get(nick)?.prefix ?? ""
}
```

**Step 2: Write client wrapper `src/core/irc/client.ts`**

```typescript
import { Client } from "irc-framework"
import type { ServerConfig } from "@/types/config"
import { useStore } from "@/core/state/store"
import { bindEvents } from "./events"

const clients = new Map<string, Client>()

export function connectServer(id: string, config: ServerConfig): Client {
  const client = new Client()
  clients.set(id, client)

  const store = useStore.getState()
  store.addConnection({
    id,
    label: config.label,
    status: "connecting",
    nick: store.config?.general.nick ?? "opentui",
    userModes: "",
    isupport: {},
  })

  bindEvents(client, id, store)

  client.connect({
    host: config.address,
    port: config.port,
    tls: config.tls,
    nick: store.config?.general.nick ?? "opentui",
    username: store.config?.general.username ?? "opentui",
    gecos: store.config?.general.realname ?? "OpenTUI IRC",
    account: config.sasl_user
      ? { account: config.sasl_user, password: config.sasl_pass ?? "" }
      : undefined,
  })

  return client
}

export function disconnectServer(id: string, message?: string) {
  const client = clients.get(id)
  if (client) {
    client.quit(message ?? "OpenTUI IRC")
    clients.delete(id)
  }
}

export function getClient(id: string): Client | undefined {
  return clients.get(id)
}

export function connectAllAutoconnect() {
  const config = useStore.getState().config
  if (!config) return
  for (const [id, server] of Object.entries(config.servers)) {
    if (server.autoconnect) {
      connectServer(id, server)
    }
  }
}
```

**Step 3: Write barrel `src/core/irc/index.ts`**

```typescript
export { connectServer, disconnectServer, getClient, connectAllAutoconnect } from "./client"
```

**Step 4: Commit**

```bash
git add src/core/irc/
git commit -m "feat: IRC client wrapper with event-to-store mapping"
```

---

## Task 8: Command Parser & Handlers

**Files:**
- Create: `src/core/commands/parser.ts`
- Create: `src/core/commands/handlers.ts`
- Create: `src/core/commands/index.ts`
- Create: `tests/core/commands/parser.test.ts`

**Step 1: Write test `tests/core/commands/parser.test.ts`**

```typescript
import { test, expect, describe } from "bun:test"
import { parseCommand } from "@/core/commands/parser"

describe("parseCommand", () => {
  test("/join #channel", () => {
    const result = parseCommand("/join #polska")
    expect(result).toEqual({ command: "join", args: ["#polska"] })
  })

  test("/msg nick message text", () => {
    const result = parseCommand("/msg kofany hello there friend")
    expect(result).toEqual({ command: "msg", args: ["kofany", "hello there friend"] })
  })

  test("/me does something", () => {
    const result = parseCommand("/me does something")
    expect(result).toEqual({ command: "me", args: ["does something"] })
  })

  test("plain text is not a command", () => {
    const result = parseCommand("just regular text")
    expect(result).toBeNull()
  })

  test("/quit with optional message", () => {
    expect(parseCommand("/quit")).toEqual({ command: "quit", args: [] })
    expect(parseCommand("/quit bye all")).toEqual({ command: "quit", args: ["bye all"] })
  })

  test("/nick newnick", () => {
    const result = parseCommand("/nick kofany2")
    expect(result).toEqual({ command: "nick", args: ["kofany2"] })
  })

  test("/part with optional message", () => {
    expect(parseCommand("/part")).toEqual({ command: "part", args: [] })
    expect(parseCommand("/part #channel goodbye")).toEqual({ command: "part", args: ["#channel", "goodbye"] })
  })
})
```

**Step 2: Implement parser `src/core/commands/parser.ts`**

```typescript
export interface ParsedCommand {
  command: string
  args: string[]
}

// Commands where everything after first arg is one string
const GREEDY_COMMANDS = new Set(["msg", "notice", "me", "quit", "topic", "kick"])

export function parseCommand(input: string): ParsedCommand | null {
  if (!input.startsWith("/")) return null

  const trimmed = input.slice(1)
  const spaceIndex = trimmed.indexOf(" ")

  if (spaceIndex === -1) {
    return { command: trimmed.toLowerCase(), args: [] }
  }

  const command = trimmed.slice(0, spaceIndex).toLowerCase()
  const rest = trimmed.slice(spaceIndex + 1).trim()

  if (GREEDY_COMMANDS.has(command)) {
    // For greedy commands, split only the first arg
    if (command === "me" || command === "quit") {
      return { command, args: [rest] }
    }
    const firstSpace = rest.indexOf(" ")
    if (firstSpace === -1) {
      return { command, args: [rest] }
    }
    return { command, args: [rest.slice(0, firstSpace), rest.slice(firstSpace + 1)] }
  }

  return { command, args: rest.split(/\s+/) }
}
```

**Step 3: Implement handlers `src/core/commands/handlers.ts`**

```typescript
import { getClient } from "@/core/irc"
import { useStore } from "@/core/state/store"
import type { ParsedCommand } from "./parser"

type Handler = (args: string[], connectionId: string) => void

const handlers: Record<string, Handler> = {
  join(args, connId) {
    const client = getClient(connId)
    if (!client) return
    const [channel, key] = args
    if (!channel) return
    client.join(channel, key)
  },

  part(args, connId) {
    const client = getClient(connId)
    if (!client) return
    const store = useStore.getState()
    const buf = store.activeBufferId ? store.buffers.get(store.activeBufferId) : null
    const channel = args[0] ?? buf?.name
    const message = args[1] ?? args[0] !== channel ? args.slice(0).join(" ") : undefined
    if (channel) client.part(channel, message)
  },

  msg(args, connId) {
    const client = getClient(connId)
    if (!client || args.length < 2) return
    client.say(args[0], args[1])
  },

  me(args, connId) {
    const client = getClient(connId)
    if (!client) return
    const store = useStore.getState()
    const buf = store.activeBufferId ? store.buffers.get(store.activeBufferId) : null
    if (buf && args[0]) {
      client.action(buf.name, args[0])
    }
  },

  nick(args, connId) {
    const client = getClient(connId)
    if (!client || !args[0]) return
    client.changeNick(args[0])
  },

  quit(args, connId) {
    const client = getClient(connId)
    if (!client) return
    client.quit(args[0] ?? "OpenTUI IRC")
  },

  topic(args, connId) {
    const client = getClient(connId)
    if (!client) return
    const store = useStore.getState()
    const buf = store.activeBufferId ? store.buffers.get(store.activeBufferId) : null
    if (buf && args.length >= 2) {
      client.setTopic(args[0], args[1])
    } else if (buf && args[0]) {
      client.setTopic(buf.name, args[0])
    }
  },

  notice(args, connId) {
    const client = getClient(connId)
    if (!client || args.length < 2) return
    client.notice(args[0], args[1])
  },
}

export function executeCommand(parsed: ParsedCommand, connectionId: string): boolean {
  const handler = handlers[parsed.command]
  if (!handler) return false
  handler(parsed.args, connectionId)
  return true
}
```

**Step 4: Write barrel `src/core/commands/index.ts`**

```typescript
export { parseCommand } from "./parser"
export { executeCommand } from "./handlers"
```

**Step 5: Run tests**

Run: `bun test tests/core/commands/`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/core/commands/ tests/core/commands/
git commit -m "feat: command parser and handlers (/join, /part, /msg, /nick, /quit, /me)"
```

---

## Task 9: UI Layout Shell

**Files:**
- Create: `src/ui/layout/AppLayout.tsx`
- Create: `src/ui/layout/TopicBar.tsx`

**Step 1: Implement AppLayout `src/ui/layout/AppLayout.tsx`**

```tsx
import { useStore } from "@/core/state/store"

interface Props {
  sidebar: React.ReactNode
  chat: React.ReactNode
  nicklist: React.ReactNode
  input: React.ReactNode
  topicbar: React.ReactNode
}

export function AppLayout({ sidebar, chat, nicklist, input, topicbar }: Props) {
  const config = useStore((s) => s.config)
  const leftWidth = config?.sidepanel.left.width ?? 20
  const rightWidth = config?.sidepanel.right.width ?? 18
  const leftVisible = config?.sidepanel.left.visible ?? true
  const rightVisible = config?.sidepanel.right.visible ?? true

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Topic bar */}
      <box height={1}>{topicbar}</box>

      {/* Main area: sidebar | chat | nicklist */}
      <box flexDirection="row" flexGrow={1}>
        {leftVisible && (
          <box width={leftWidth} flexDirection="column" borderRight borderStyle="single" borderColor="#444444">
            {sidebar}
          </box>
        )}
        <box flexGrow={1} flexDirection="column">
          {chat}
        </box>
        {rightVisible && (
          <box width={rightWidth} flexDirection="column" borderLeft borderStyle="single" borderColor="#444444">
            {nicklist}
          </box>
        )}
      </box>

      {/* Input */}
      <box height={1} borderTop borderStyle="single" borderColor="#444444">
        {input}
      </box>
    </box>
  )
}
```

**Step 2: Implement TopicBar `src/ui/layout/TopicBar.tsx`**

```tsx
import { useActiveBuffer } from "@/core/state/selectors"

export function TopicBar() {
  const buffer = useActiveBuffer()
  const topic = buffer?.topic ?? ""
  const name = buffer?.name ?? ""

  return (
    <box width="100%" backgroundColor="#1a1a2e">
      <text>
        <span fg="#5555ff">{name}</span>
        {topic ? <span fg="#aaaaaa"> — {topic}</span> : null}
      </text>
    </box>
  )
}
```

**Step 3: Commit**

```bash
git add src/ui/layout/
git commit -m "feat: AppLayout shell with 3-column layout and topic bar"
```

---

## Task 10: UI Buffer List (Left Sidebar)

**Files:**
- Create: `src/ui/sidebar/BufferList.tsx`

**Step 1: Implement BufferList**

```tsx
import { useSortedBuffers } from "@/core/state/selectors"
import { useStore } from "@/core/state/store"
import { resolveAbstractions, parseFormatString } from "@/core/theme"
import { StyledText } from "@/core/theme"
import type { Buffer } from "@/types"
import { ActivityLevel } from "@/types"

export function BufferList() {
  const sortedBuffers = useSortedBuffers()
  const activeBufferId = useStore((s) => s.activeBufferId)
  const theme = useStore((s) => s.theme)
  const setActiveBuffer = useStore((s) => s.setActiveBuffer)

  // Group by connection
  let lastConnectionId = ""
  const items: Array<{ type: "header" | "buffer"; label: string; buffer?: Buffer & { connectionLabel: string } }> = []

  for (const buf of sortedBuffers) {
    if (buf.connectionId !== lastConnectionId) {
      lastConnectionId = buf.connectionId
      items.push({ type: "header", label: buf.connectionLabel })
    }
    items.push({ type: "buffer", label: buf.name, buffer: buf })
  }

  return (
    <scrollbox height="100%">
      {items.map((item, idx) => {
        if (item.type === "header") {
          const format = theme?.formats.sidepanel.header ?? "%B$0%N"
          const resolved = resolveAbstractions(format, theme?.abstracts ?? {})
          const spans = parseFormatString(resolved, [item.label])
          return (
            <box key={`h-${idx}`} width="100%">
              <StyledText spans={spans} />
            </box>
          )
        }

        const buf = item.buffer!
        const isActive = buf.id === activeBufferId
        const formatKey = isActive
          ? "item_selected"
          : `item_activity_${buf.activity}`
        const format = theme?.formats.sidepanel[formatKey] ?? "$0. $1"
        const resolved = resolveAbstractions(format, theme?.abstracts ?? {})
        const displayName = truncate(buf.name, 15)
        const refNum = String(idx)
        const spans = parseFormatString(resolved, [refNum, displayName])

        return (
          <box
            key={buf.id}
            width="100%"
            onMouseDown={() => setActiveBuffer(buf.id)}
          >
            <StyledText spans={spans} />
          </box>
        )
      })}
    </scrollbox>
  )
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str
}
```

**Step 2: Commit**

```bash
git add src/ui/sidebar/BufferList.tsx
git commit -m "feat: BufferList sidebar with themed sorting and mouse click"
```

---

## Task 11: UI Chat Area

**Files:**
- Create: `src/ui/chat/ChatView.tsx`
- Create: `src/ui/chat/MessageLine.tsx`

**Step 1: Implement MessageLine `src/ui/chat/MessageLine.tsx`**

Renders a single message using the theme format system:

```tsx
import { useStore } from "@/core/state/store"
import { resolveAbstractions, parseFormatString, StyledText } from "@/core/theme"
import type { Message } from "@/types"

interface Props {
  message: Message
  isOwnNick: boolean
}

export function MessageLine({ message, isOwnNick }: Props) {
  const theme = useStore((s) => s.theme)
  const config = useStore((s) => s.config)
  const abstracts = theme?.abstracts ?? {}
  const formats = theme?.formats ?? { messages: {}, events: {} }

  // Timestamp
  const ts = formatTimestamp(message.timestamp, config?.general.timestamp_format ?? "%H:%M:%S")
  const tsFormat = abstracts.timestamp ?? "$*"
  const tsResolved = resolveAbstractions(tsFormat, abstracts)
  const tsSpans = parseFormatString(tsResolved, [ts])

  if (message.type === "event") {
    // Event line: timestamp + event text
    const eventFormat = formats.events[getEventFormatKey(message.text)] ?? "$0"
    // For events, just show the raw text with timestamp
    const textSpans = parseFormatString("%w" + message.text + "%N", [])
    return (
      <box flexDirection="row" width="100%">
        <StyledText spans={tsSpans} />
        <text> </text>
        <StyledText spans={textSpans} />
      </box>
    )
  }

  // Message line: timestamp | nick | text
  const nickWidth = config?.display.nick_column_width ?? 8
  const alignment = config?.display.nick_alignment ?? "right"
  const nickMode = message.nickMode ?? ""
  const nick = message.nick ?? ""
  const displayNick = formatNick(nick, nickWidth, alignment, config?.display.nick_truncation ?? true)

  // Choose message format
  let msgFormatKey: string
  if (isOwnNick) {
    msgFormatKey = "own_msg"
  } else if (message.highlight) {
    msgFormatKey = "pubmsg_mention"
  } else {
    msgFormatKey = "pubmsg"
  }

  const msgFormat = formats.messages[msgFormatKey] ?? "{msgnick $2 $0}$1"
  const resolved = resolveAbstractions(msgFormat, abstracts)
  const spans = parseFormatString(resolved, [displayNick, message.text, nickMode])

  return (
    <box flexDirection="row" width="100%">
      <StyledText spans={tsSpans} />
      <text> </text>
      <StyledText spans={spans} />
    </box>
  )
}

function formatTimestamp(date: Date, format: string): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return format.replace("%H", h).replace("%M", m).replace("%S", s)
}

function formatNick(nick: string, width: number, align: string, truncate: boolean): string {
  let display = truncate && nick.length > width ? nick.slice(0, width) : nick
  if (align === "right") return display.padStart(width)
  if (align === "center") {
    const pad = Math.max(0, width - display.length)
    const left = Math.floor(pad / 2)
    return " ".repeat(left) + display + " ".repeat(pad - left)
  }
  return display.padEnd(width)
}

function getEventFormatKey(text: string): string {
  if (text.includes("has joined")) return "join"
  if (text.includes("has left")) return "part"
  if (text.includes("has quit")) return "quit"
  if (text.includes("→")) return "nick_change"
  return "default"
}
```

**Step 2: Implement ChatView `src/ui/chat/ChatView.tsx`**

```tsx
import { useActiveBuffer } from "@/core/state/selectors"
import { useStore } from "@/core/state/store"
import { MessageLine } from "./MessageLine"

export function ChatView() {
  const buffer = useActiveBuffer()
  const currentNick = useStore((s) => {
    if (!buffer) return ""
    return s.connections.get(buffer.connectionId)?.nick ?? ""
  })

  if (!buffer) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text><span fg="#555555">No active buffer</span></text>
      </box>
    )
  }

  return (
    <scrollbox height="100%">
      {buffer.messages.map((msg) => (
        <MessageLine
          key={msg.id}
          message={msg}
          isOwnNick={msg.nick === currentNick}
        />
      ))}
    </scrollbox>
  )
}
```

**Step 3: Commit**

```bash
git add src/ui/chat/
git commit -m "feat: ChatView with themed message line rendering and nick alignment"
```

---

## Task 12: UI Nick List (Right Sidebar)

**Files:**
- Create: `src/ui/sidebar/NickList.tsx`

**Step 1: Implement NickList**

```tsx
import { useActiveBuffer } from "@/core/state/selectors"
import { useSortedNicks } from "@/core/state/selectors"
import { useStore } from "@/core/state/store"
import { resolveAbstractions, parseFormatString, StyledText } from "@/core/theme"
import { BufferType } from "@/types"

const DEFAULT_PREFIX_ORDER = "~&@%+"

export function NickList() {
  const buffer = useActiveBuffer()
  const theme = useStore((s) => s.theme)
  const conn = useStore((s) => buffer ? s.connections.get(buffer.connectionId) : undefined)
  const prefixOrder = conn?.isupport.PREFIX
    ? extractPrefixChars(conn.isupport.PREFIX)
    : DEFAULT_PREFIX_ORDER

  const sortedNicks = useSortedNicks(buffer?.id ?? "", prefixOrder)

  if (!buffer || buffer.type !== BufferType.Channel) {
    return (
      <box flexGrow={1}>
        <text><span fg="#555555">No nicklist</span></text>
      </box>
    )
  }

  const formats = theme?.formats.nicklist ?? {}

  return (
    <scrollbox height="100%">
      {/* Nick count header */}
      <box width="100%">
        <text><span fg="#5555ff">{sortedNicks.length} users</span></text>
      </box>

      {sortedNicks.map((entry) => {
        const formatKey = getFormatKey(entry.prefix)
        const format = formats[formatKey] ?? " $0"
        const resolved = resolveAbstractions(format, theme?.abstracts ?? {})
        const spans = parseFormatString(resolved, [entry.nick])

        return (
          <box
            key={entry.nick}
            width="100%"
            onMouseDown={() => {
              // TODO: nick context menu or /query
            }}
          >
            <StyledText spans={spans} />
          </box>
        )
      })}
    </scrollbox>
  )
}

function getFormatKey(prefix: string): string {
  switch (prefix) {
    case "~": return "owner"
    case "&": return "admin"
    case "@": return "op"
    case "%": return "halfop"
    case "+": return "voice"
    default: return "normal"
  }
}

function extractPrefixChars(isupportPrefix: string): string {
  // PREFIX=(ohv)@%+ → @%+
  const match = isupportPrefix.match(/\)(.+)$/)
  return match ? match[1] : DEFAULT_PREFIX_ORDER
}
```

**Step 2: Commit**

```bash
git add src/ui/sidebar/NickList.tsx
git commit -m "feat: NickList sidebar with prefix-sorted themed nicks"
```

---

## Task 13: UI Command Input

**Files:**
- Create: `src/ui/input/CommandInput.tsx`

**Step 1: Implement CommandInput**

```tsx
import { useState } from "react"
import { useActiveBuffer } from "@/core/state/selectors"
import { useStore } from "@/core/state/store"
import { parseCommand, executeCommand } from "@/core/commands"
import { getClient } from "@/core/irc"
import { makeBufferId } from "@/types"
import { useKeyboard } from "@opentui/react"

export function CommandInput() {
  const [value, setValue] = useState("")
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const buffer = useActiveBuffer()
  const addMessage = useStore((s) => s.addMessage)

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return

    // Add to history
    setHistory((h) => [trimmed, ...h].slice(0, 100))
    setHistoryIndex(-1)
    setValue("")

    // Parse command
    const parsed = parseCommand(trimmed)

    if (parsed && buffer) {
      executeCommand(parsed, buffer.connectionId)
    } else if (buffer && !parsed) {
      // Plain text — send as message to active buffer
      const client = getClient(buffer.connectionId)
      if (client) {
        client.say(buffer.name, trimmed)
        // irc-framework with echo-message will echo back, otherwise we add manually
        addMessage(buffer.id, {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: "message",
          nick: useStore.getState().connections.get(buffer.connectionId)?.nick ?? "",
          nickMode: "",
          text: trimmed,
          highlight: false,
        })
      }
    }
  }

  useKeyboard((key) => {
    if (key.name === "up" && key.eventType === "press") {
      if (history.length > 0) {
        const newIdx = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(newIdx)
        setValue(history[newIdx])
      }
    }
    if (key.name === "down" && key.eventType === "press") {
      if (historyIndex > 0) {
        const newIdx = historyIndex - 1
        setHistoryIndex(newIdx)
        setValue(history[newIdx])
      } else {
        setHistoryIndex(-1)
        setValue("")
      }
    }
  })

  const prompt = buffer ? `[${buffer.name}] ❯ ` : "❯ "

  return (
    <box flexDirection="row" width="100%">
      <text><span fg="#5555ff">{prompt}</span></text>
      <input
        value={value}
        onChange={setValue}
        focused
        flexGrow={1}
        backgroundColor="transparent"
        textColor="#ffffff"
        cursorColor="#55ffff"
      />
    </box>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/input/CommandInput.tsx
git commit -m "feat: CommandInput with history, /command execution, and plain text send"
```

---

## Task 14: App Integration — Wire Everything

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/index.tsx`

**Step 1: Update App.tsx to compose all UI components**

```tsx
import { useEffect } from "react"
import { useRenderer, useKeyboard } from "@opentui/react"
import { useStore } from "@/core/state/store"
import { loadConfig } from "@/core/config/loader"
import { loadTheme } from "@/core/theme/loader"
import { connectAllAutoconnect } from "@/core/irc"
import { AppLayout } from "@/ui/layout/AppLayout"
import { TopicBar } from "@/ui/layout/TopicBar"
import { BufferList } from "@/ui/sidebar/BufferList"
import { NickList } from "@/ui/sidebar/NickList"
import { ChatView } from "@/ui/chat/ChatView"
import { CommandInput } from "@/ui/input/CommandInput"

export function App() {
  const renderer = useRenderer()
  const setConfig = useStore((s) => s.setConfig)
  const setTheme = useStore((s) => s.setTheme)

  useKeyboard((key) => {
    if (key.name === "q" && key.ctrl) {
      renderer.destroy()
    }
  })

  useEffect(() => {
    async function init() {
      // Load config
      const config = await loadConfig("config/config.toml")
      setConfig(config)

      // Load theme
      const themePath = `themes/${config.general.theme}.theme`
      const theme = await loadTheme(themePath)
      setTheme(theme)

      // Auto-connect servers
      connectAllAutoconnect()
    }
    init()
  }, [])

  return (
    <AppLayout
      topicbar={<TopicBar />}
      sidebar={<BufferList />}
      chat={<ChatView />}
      nicklist={<NickList />}
      input={<CommandInput />}
    />
  )
}
```

**Step 2: Verify entry point `src/index.tsx` is correct** (from Task 1)

**Step 3: Manual integration test**

Run: `bun run start`
Expected: Three-column layout renders. If config has autoconnect servers with valid credentials in `.env`, it connects and shows channels.

**Step 4: Commit**

```bash
git add src/app/App.tsx src/index.tsx
git commit -m "feat: wire all components into main App with init sequence"
```

---

## Task 15: Mouse Click Actions

**Files:**
- Modify: `src/ui/sidebar/BufferList.tsx` — already has `onMouseDown` for buffer switching
- Modify: `src/ui/sidebar/NickList.tsx` — add query-on-click

**Step 1: Add nick click → open query**

In `NickList.tsx`, update the `onMouseDown` handler:

```tsx
onMouseDown={() => {
  if (!buffer) return
  const client = getClient(buffer.connectionId)
  if (!client) return
  // Create/switch to query buffer
  const queryId = makeBufferId(buffer.connectionId, entry.nick)
  const store = useStore.getState()
  if (!store.buffers.has(queryId)) {
    store.addBuffer({
      id: queryId,
      connectionId: buffer.connectionId,
      type: BufferType.Query,
      name: entry.nick,
      messages: [],
      activity: ActivityLevel.None,
      unreadCount: 0,
      lastRead: new Date(),
      users: new Map(),
    })
  }
  store.setActiveBuffer(queryId)
}}
```

**Step 2: Commit**

```bash
git add src/ui/sidebar/NickList.tsx
git commit -m "feat: click nick to open query buffer"
```

---

## Task 16: Default Theme File & Final Polish

**Files:**
- Modify: `themes/default.theme` — ensure complete
- Create: `src/core/theme/format-helpers.ts` — timestamp formatting utility

**Step 1: Verify `themes/default.theme` has all required sections**

Ensure it contains: `[meta]`, `[abstracts]`, `[formats.messages]`, `[formats.events]`, `[formats.sidepanel]`, `[formats.nicklist]` — all entries from the design doc.

**Step 2: Test end-to-end manually**

1. Copy `config/config.toml`, edit with real server
2. Create `.env` with SASL credentials
3. Run `bun run start`
4. Verify:
   - [ ] Connects to server
   - [ ] Left sidebar shows server + channels after join
   - [ ] Channels sorted alphabetically under server header
   - [ ] Chat area shows messages with timestamp|nick|text formatting
   - [ ] Nick alignment matches config (right-align, 8 chars)
   - [ ] Right sidebar shows nicklist sorted by prefix
   - [ ] Clicking a buffer in left sidebar switches view
   - [ ] Clicking a nick opens query
   - [ ] Typing text and pressing Enter sends message
   - [ ] `/join #channel` works
   - [ ] `/part` leaves current channel
   - [ ] `/nick newnick` changes nick
   - [ ] Ctrl+Q exits cleanly

**Step 3: Fix any issues found in manual testing**

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: OpenTUI IRC v0.1 — complete MVP with multi-server, themes, mouse"
```

---

## Dependency Graph

```
Task 1 (scaffold)
  └─→ Task 2 (types)
        ├─→ Task 3 (config)
        ├─→ Task 4 (theme parser)
        │     └─→ Task 5 (theme loader/renderer)
        ├─→ Task 6 (state store)
        │     └─→ Task 7 (IRC wrapper)
        │           └─→ Task 8 (commands)
        └─→ Task 9 (layout shell)
              ├─→ Task 10 (buffer list)
              ├─→ Task 11 (chat area)
              ├─→ Task 12 (nicklist)
              └─→ Task 13 (input)
                    └─→ Task 14 (integration)
                          ├─→ Task 15 (mouse actions)
                          └─→ Task 16 (polish)
```

**Parallelizable after Task 2:** Tasks 3, 4, 6 can be done in parallel.
**Parallelizable after Task 6:** Tasks 9-13 can be done in parallel (UI components).
