# Theming

## Overview

kokoIRC uses TOML-based theme files with an irssi-inspired format string language. Themes control colors, message formatting, nick styles, sidebar appearance, and UI elements. The format string system supports named colors, 24-bit hex colors, style toggles, variable substitution, and reusable abstractions — giving you full control over how every piece of the interface is rendered.

## Theme location

Custom themes live in `~/.kokoirc/themes/` as `.theme` files (TOML format). To set the active theme:

**In config.toml:**

```toml
[general]
theme = "default"        # loads ~/.kokoirc/themes/default.theme
```

**At runtime:**

```
/set general.theme mytheme
/reload                          # or reload to pick up file changes
```

The theme name is the filename without the `.theme` extension. When a theme file is not found, kokoIRC falls back to a minimal built-in theme with basic formatting.

## Built-in theme: Nightfall

kokoIRC ships with **Nightfall** — a modern dark theme inspired by the Tokyo Night color palette. It uses muted blues and grays for the base UI, with carefully chosen accent colors:

- **Blue accents** (`#7aa2f7`) for nicks, channels, and interactive elements
- **Green** (`#9ece6a`) for your own nick and join events
- **Orange** (`#e0af68`) for actions and the selected buffer indicator
- **Red/pink** (`#f7768e`) for errors, quits, and highlighted messages
- **Purple** (`#bb9af7`) for nick mentions and nick changes
- **Muted gray** (`#565f89`) for timestamps, hostmasks, and secondary info

Messages display with a right-aligned nick column, a colored `❯` separator, and subtle timestamp coloring — creating a clean, readable layout even in busy channels.

## Theme file structure

A theme file has four sections: `[meta]`, `[colors]`, `[abstracts]`, and `[formats.*]`.

Here is the complete built-in `default.theme`:

```toml
[meta]
name = "Nightfall"
description = "Modern dark theme with subtle accents"

[colors]
bg = "#1a1b26"
bg_alt = "#16161e"
border = "#292e42"
fg = "#a9b1d6"
fg_muted = "#565f89"
fg_dim = "#292e42"
accent = "#7aa2f7"
cursor = "#7aa2f7"

[abstracts]
timestamp = "%Z6e738d$*%Z7aa2f7%N"
msgnick = "%Z565f89$0$1%Z7aa2f7❯%N%| "
ownnick = "%Z9ece6a%_$*%_%N"
pubnick = "%Z7aa2f7%_$*%_%N"
menick = "%Zbb9af7%_$*%_%N"
channel = "%Z7aa2f7%_$*%_%N"
action = "%Ze0af68* $*%N"
error = "%Zf7768e! $*%N"

[formats.messages]
own_msg = "{msgnick $2 {ownnick $0}}%Zc0caf5$1%N"
pubmsg = "{msgnick $2 {pubnick $0}}%Za9b1d6$1%N"
pubmsg_mention = "{msgnick %Zbb9af7$2 {menick $0}}%Zbb9af7$1%N"
pubmsg_highlight = "{msgnick %Zf7768e$2 %Zf7768e%_$0%_%N}%Zf7768e$1%N"
action = "{action $0} %Ze0af68$1%N"
notice = "%Z7dcfff-%Z7aa2f7$0%Z7dcfff-%N $1"

[formats.events]
join = "%Z9ece6a-->%N %Za9b1d6$0%N %Z565f89($1@$2)%N has joined {channel $3}"
part = "%Ze0af68<--%N %Za9b1d6$0%N %Z565f89($1@$2)%N has left {channel $3} %Z565f89($4)%N"
quit = "%Zf7768e<--%N %Za9b1d6$0%N %Z565f89($1@$2)%N has quit %Z565f89($3)%N"
nick_change = "%Zbb9af7---%N %Za9b1d6$0%N is now known as %Za9b1d6$1%N"
topic = "%Z7aa2f7---%N Topic set by %Z565f89$0%N: $1"
mode = "%Z7aa2f7---%N %Za9b1d6$0%N sets mode %Ze0af68$1%N on {channel $2}"

[formats.sidepanel]
header = "%Z7aa2f7%_$0%_%N"
item = "%Z565f89$0.%N %Z6e738d$1%N"
item_selected = "%Ze0af68$0.%N %Zc0caf5%_$1%_%N"
item_activity_0 = "%Z565f89$0.%N %Z6e738d$1%N"
item_activity_1 = "%Z565f89$0.%N %Z9ece6a$1%N"
item_activity_2 = "%Z565f89$0.%N %Zf7768e$1%N"
item_activity_3 = "%Z565f89$0.%N %Ze0af68$1%N"
item_activity_4 = "%Z565f89$0.%N %Zbb9af7$1%N"

[formats.nicklist]
owner = "%Ze0af68~%Zc0caf5$0%N"
admin = "%Zf7768e&%Zc0caf5$0%N"
op = "%Z9ece6a@%Za9b1d6$0%N"
halfop = "%Z7aa2f7%%%Za9b1d6$0%N"
voice = "%Z7dcfff+%Z6e738d$0%N"
normal = " %Z565f89$0%N"
```

## How sections work

### `[meta]`

Name and description of the theme. Purely informational — used for theme listing and identification.

### `[colors]`

The base color palette for the UI chrome (background, borders, foreground text, cursor). These are used by the UI framework directly — not by the format string engine. All values are hex RGB strings.

| Key | Purpose |
|-----|---------|
| `bg` | Main background |
| `bg_alt` | Alternate/darker background |
| `border` | Border and separator lines |
| `fg` | Primary text color |
| `fg_muted` | Secondary/muted text |
| `fg_dim` | Very dim text (inactive elements) |
| `accent` | Accent color for highlights |
| `cursor` | Cursor color |

### `[abstracts]`

Reusable formatting macros. Define a pattern once, reference it anywhere with `{name args}`. Abstractions can nest — an abstract can reference other abstracts.

For example, the `msgnick` abstract formats the nick column:

```toml
msgnick = "%Z565f89$0$1%Z7aa2f7❯%N%| "
```

- `$0` = nick mode prefix (padding/alignment)
- `$1` = the nick itself
- `%Z565f89` = muted gray color
- `%Z7aa2f7❯` = blue separator character
- `%N` = reset colors
- `%|` = indent marker for wrapped lines

Then in `[formats.messages]`, it's used like:

```toml
pubmsg = "{msgnick $2 {pubnick $0}}%Za9b1d6$1%N"
```

This nests `{pubnick $0}` inside `{msgnick ...}`, so the nick gets styled by `pubnick` first, then the result is placed into the `msgnick` layout. See the [Format Strings Reference](theming-format-strings.html) for complete syntax.

### `[formats.messages]`

Controls how chat messages are displayed. Variables available:

| Variable | Content |
|----------|---------|
| `$0` | Nick (display name, possibly truncated) |
| `$1` | Message text |
| `$2` | Nick mode prefix with alignment padding |

Format keys:

| Key | When used |
|-----|-----------|
| `own_msg` | Messages you send |
| `pubmsg` | Messages from other users |
| `pubmsg_mention` | Messages mentioning your nick |
| `pubmsg_highlight` | Highlighted messages |
| `action` | `/me` actions (`$0` = nick, `$1` = action text) |
| `notice` | NOTICE messages (`$0` = sender, `$1` = text) |

### `[formats.events]`

Controls how IRC events (join, part, quit, etc.) are displayed.

| Key | Variables |
|-----|-----------|
| `join` | `$0` nick, `$1` ident, `$2` hostname, `$3` channel |
| `part` | `$0` nick, `$1` ident, `$2` hostname, `$3` channel, `$4` reason |
| `quit` | `$0` nick, `$1` ident, `$2` hostname, `$3` reason |
| `nick_change` | `$0` old nick, `$1` new nick |
| `topic` | `$0` nick who set it, `$1` new topic text |
| `mode` | `$0` nick who set it, `$1` mode string, `$2` channel |

### `[formats.sidepanel]`

Controls the buffer list in the left panel. Variables: `$0` = buffer number, `$1` = buffer name.

| Key | When used |
|-----|-----------|
| `header` | Connection/server header (`$0` = server label) |
| `item` | Default buffer item |
| `item_selected` | Currently active buffer |
| `item_activity_0` | No activity |
| `item_activity_1` | Normal activity (messages) |
| `item_activity_2` | Mention/highlight activity |
| `item_activity_3` | High activity |
| `item_activity_4` | Special activity |

### `[formats.nicklist]`

Controls how nicks are displayed in the right panel nick list. Variable: `$0` = nick.

| Key | Prefix | When used |
|-----|--------|-----------|
| `owner` | `~` | Channel owner |
| `admin` | `&` | Channel admin |
| `op` | `@` | Channel operator |
| `halfop` | `%` | Half-operator |
| `voice` | `+` | Voiced user |
| `normal` | (none) | Regular user |

## Creating a custom theme

**Step 1 — Copy the default theme:**

```bash
cp ~/.kokoirc/themes/default.theme ~/.kokoirc/themes/mytheme.theme
```

**Step 2 — Edit the file:**

Open `~/.kokoirc/themes/mytheme.theme` in any text editor. Change colors, abstractions, and formats to your liking. The [Format Strings Reference](theming-format-strings.html) documents all available codes.

**Step 3 — Activate the theme:**

```
/set general.theme mytheme
```

Or edit `config.toml`:

```toml
[general]
theme = "mytheme"
```

**Step 4 — Iterate:**

Edit the `.theme` file in your editor, then run `/reload` in kokoIRC to see changes instantly. No restart needed.

## Tips

- Start from the default theme and make incremental changes — it's easier to see what each format does.
- Use `%Z` hex colors for precise control. The named color codes (`%r`, `%g`, etc.) map to the classic 16-color terminal palette and may look different across terminals.
- Keep abstractions for anything you use more than once. Changing `ownnick` in `[abstracts]` updates every format that references `{ownnick}`.
- The `%|` indent marker affects where wrapped lines start. Place it after the nick column so long messages wrap neatly.
- Activity levels in the sidepanel (0-4) correspond to: no activity, normal messages, mentions, high activity, and special events. Color them progressively more noticeable.
