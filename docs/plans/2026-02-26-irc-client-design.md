# OpenTUI IRC Client — Design Document

**Date:** 2026-02-26
**Status:** Approved
**Stack:** OpenTUI (React reconciler) + irc-framework + Bun + TypeScript

## Overview

Modern terminal IRC client built on OpenTUI with full mouse support, irssi-inspired theming, multi-server architecture, and weechat-like sidepanels with erssi sorting logic.

## Architecture

### Layer Separation

```
src/
├── index.tsx                 # Entry point
├── app/
│   └── App.tsx               # Top-level layout, providers
├── ui/                       # Pure UI — no IRC logic
│   ├── layout/               # Shell: sidebars + main + statusbar + topic
│   ├── chat/                 # Message rendering, line formatting
│   ├── sidebar/              # BufferList (left), NickList (right)
│   ├── input/                # CommandInput at bottom
│   └── common/               # Shared UI primitives
├── core/                     # Business logic
│   ├── irc/                  # Wrapper on irc-framework, typed events
│   ├── state/                # Store: connections, buffers, messages
│   ├── config/               # TOML parser, runtime /set
│   ├── theme/                # Format string engine (parser + renderer)
│   └── commands/             # /join, /part, /msg, /nick, /quit handlers
└── types/                    # TypeScript type definitions
```

**Key rule:** `ui/` NEVER imports from `irc-framework`. `core/irc/` translates IRC events into store updates. UI subscribes to the store.

### Data Model

```typescript
interface Connection {
  id: string;              // "ircnet", "libera"
  config: ServerConfig;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  nick: string;
  userModes: string;
  isupport: Record<string, string>;
}

interface Buffer {
  id: string;              // "ircnet/#polska", "libera/query/nick"
  connectionId: string;
  type: 'server' | 'channel' | 'query' | 'special';
  name: string;
  messages: Message[];
  activity: ActivityLevel;
  unreadCount: number;
  lastRead: Date;
  topic?: string;
  users?: Map<string, NickEntry>;
  modes?: string;
}

enum SortGroup {
  Server  = 1,
  Channel = 2,
  Query   = 3,
  Special = 4,
}

enum ActivityLevel {
  None      = 0,
  Events    = 1,  // join/part/quit
  Highlight = 2,  // keyword match
  Activity  = 3,  // channel messages
  Mention   = 4,  // nick mention / query msg
}

interface Message {
  id: string;
  timestamp: Date;
  type: 'message' | 'action' | 'event' | 'notice' | 'ctcp';
  nick?: string;
  nickMode?: string;
  text: string;
  highlight: boolean;
  tags?: Record<string, string>;
}

interface NickEntry {
  nick: string;
  prefix: string;  // ~, &, @, %, +, ''
  away: boolean;
}
```

### Sorting

**Left panel (buffer list) — erssi logic:**
1. Connection label (A-Z, case-insensitive)
2. SortGroup (Server → Channel → Query → Special)
3. Buffer name (A-Z, case-insensitive)

**Right panel (nicklist):**
1. Prefix position in PREFIX from ISUPPORT (~&@%+ → 0,1,2,3,4)
2. Nick (A-Z, case-insensitive)

## Theme Engine

### Format String Syntax

Inspired by irssi, compatible with erssi hex colors:

```
Colors:        %k %r %g %y %b %m %c %w  (dark)
               %K %R %G %Y %B %M %C %W  (bright)
Hex:           %ZRRGGBB                  (24-bit)
Reset:         %N or %n
Styles:        %_ (bold)  %u (underline)  %i (italic)  %d (dim)
Indent:        %|  (wrap point)

Variables:     $0 $1 $2...  (positional)
               $*           (all params)
Padding:       $[8]0        (right-pad to 8)
               $[-8]0       (left-pad to 8)

Abstractions:  {name $arg1 $arg2}  (reference another abstraction)
```

### Theme File (TOML)

```toml
[meta]
name = "Default"
description = "Clean default theme for OpenTUI IRC"

[abstracts]
timestamp = "%b$*%C❱%N"
msgnick = "%w$0$1%B❯%N%| "
ownnick = "%g%_$*%_%N"
pubnick = "%B%_$*%_%N"
menick = "%M%_$*%_%N"
channel = "%B%_$*%_%N"
action = "%m⚬%N $*"
error = "%R⚠ $*%N"

[formats.messages]
own_msg = "{msgnick $2 {ownnick $0}}$1"
pubmsg = "{msgnick $2 {pubnick $0}}$1"
pubmsg_mention = "{msgnick %M$2 {menick $0}}%M$1%N"
pubmsg_highlight = "{msgnick %R$2 %R%_$0%_%N}%R$1%N"
action = "{action $0} $1"
notice = "%C⬢%N %m$0%N❯ $1"

[formats.events]
join = "%G⥤%N $0 ($1@$2) has joined {channel $3}"
part = "%Y⥢%N $0 has left {channel $1} ($2)"
quit = "%R⏻%N $0 has quit ($1)"
nick_change = "%M⬢%N $0 → $1"
topic = "%B⚙%N Topic set by $0: $1"
mode = "%M⛈%N $0 sets mode $1 on {channel $2}"

[formats.sidepanel]
header = "%B$0%N"
item = "%w$0. %w$1%N"
item_selected = "%Y$0. %W$1%N"
item_activity_0 = "%w$0. %w$1%N"
item_activity_1 = "%G$0. %G$1%N"
item_activity_2 = "%R$0. %R$1%N"
item_activity_3 = "%Y$0. %Y$1%N"
item_activity_4 = "%M$0. %M$1%N"

[formats.nicklist]
owner = "%M~%m$0%N"
admin = "%R&%r$0%N"
op = "%Y@%B$0%N"
halfop = "%C%%%c$0%N"
voice = "%C+%c$0%N"
normal = " %w$0%N"
```

## Configuration

### config.toml

```toml
[general]
nick = "kofany"
username = "kofany"
realname = "OpenTUI IRC"
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

[servers.ircnet]
label = "IRCnet"
address = "sasl.irc.atw.hu"
port = 6697
tls = true
autoconnect = true
channels = ["#polska", "#erssi", "#tahio"]

[servers.libera]
label = "Libera"
address = "irc.libera.chat"
port = 6697
tls = true
autoconnect = true
channels = ["#opentui"]
```

### .env (credentials)

```
IRCNET_SASL_USER=kofany
IRCNET_SASL_PASS=secret
LIBERA_SASL_USER=kofany
LIBERA_SASL_PASS=secret
```

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Topic: Witaj na #polska — oficjalny kanal                       │
├──────────┬────────────────────────────────────────┬──────────────┤
│ IRCnet   │ 18:10:14❱   @kofany❯ cześć!           │ @ChanServ    │
│  1.Status│ 18:10:15❱   user01❯ siema              │ @kofany      │
│  2.#erssi│ 18:10:16❱ ⚬ user01 siada wygodnie     │ +someuser    │
│  3.#polsk│ 18:10:20❱ ⥤ newuser joined #polska     │  nick1       │
│  4.#tahio│                                        │  nick2       │
│  5.kofany│                                        │              │
│          │                                        │              │
│ Libera   │                                        │              │
│  6.Status│                                        │              │
│  7.#opent│                                        │              │
├──────────┴────────────────────────────────────────┴──────────────┤
│ [#polska] ❯                                                      │
└─────────────────────────────────────────────────────────────────┘
```

## MVP v0.1 Scope

### In scope
- Multi-server connect/disconnect
- Left sidepanel with erssi sorting
- Right sidepanel with nicklist (prefix-sorted)
- Chat with line formatting (timestamp|nick|text)
- Theme engine (parser + renderer)
- One built-in default theme
- Input with /commands (join, part, msg, quit, nick, me)
- Mouse: click buffer, click nick
- Config TOML + .env credentials
- SASL auth (PLAIN)
- Nick alignment/width/truncation
- Activity levels in sidepanel

### Out of scope (future)
- Clickable links
- Encrypted credentials
- Additional themes (dracula, catppuccin, etc.)
- Highlight rules
- DCC
- /set runtime changes
- Mouse-resizable sidepanels
- Scroll search (/lastlog)
