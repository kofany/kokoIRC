# Format Strings Reference

This is a comprehensive reference for the kokoIRC format string language used in theme files. The format engine is irssi-compatible with extensions for 24-bit color and mIRC control codes.

## Color codes

### Named colors (irssi-compatible)

Single-character codes following `%`. Lowercase = normal, uppercase = bright.

| Code | Color | Hex | Code | Color | Hex |
|------|-------|-----|------|-------|-----|
| `%k` | Black | `#000000` | `%K` | Bright black (gray) | `#555555` |
| `%r` | Red | `#aa0000` | `%R` | Bright red | `#ff5555` |
| `%g` | Green | `#00aa00` | `%G` | Bright green | `#55ff55` |
| `%y` | Yellow (brown) | `#aa5500` | `%Y` | Bright yellow | `#ffff55` |
| `%b` | Blue | `#0000aa` | `%B` | Bright blue | `#5555ff` |
| `%m` | Magenta | `#aa00aa` | `%M` | Bright magenta | `#ff55ff` |
| `%c` | Cyan | `#00aaaa` | `%C` | Bright cyan | `#55ffff` |
| `%w` | White (light gray) | `#aaaaaa` | `%W` | Bright white | `#ffffff` |

These set the **foreground** color. They map to fixed hex values, so they look identical regardless of terminal color scheme.

### 24-bit hex colors

```
%ZRRGGBB
```

Sets the foreground color to an arbitrary 24-bit hex value. The six hex digits follow `%Z` immediately with no separator.

**Examples:**

```
%Z7aa2f7         # Tokyo Night blue
%Ze0af68         # Warm orange
%Zf7768e         # Soft red/pink
%Z9ece6a         # Green
%Zbb9af7         # Purple
%Zc0caf5         # Light foreground
%Z565f89         # Muted gray
%Z6e738d         # Dim gray
```

This is the recommended way to specify colors in themes — it gives you exact control independent of the terminal palette.

### Reset

```
%N    (or %n)
```

Resets **all** formatting — foreground color, background color, bold, italic, underline, and dim are all cleared.

### Literal percent

```
%%
```

Produces a literal `%` character in the output.

## Style codes

Style codes are toggles — the first use enables the style, the second disables it.

| Code | Style | Description |
|------|-------|-------------|
| `%_` | **Bold** | Toggle bold text |
| `%u` | <u>Underline</u> | Toggle underline |
| `%i` | *Italic* | Toggle italic/reverse |
| `%d` | Dim | Toggle dim (faded) text |

**Example:**

```
%_bold text%_ normal again
%Z7aa2f7%_blue bold%_%N plain
```

## Variables

### Positional variables

| Variable | Description |
|----------|-------------|
| `$0` | First argument |
| `$1` | Second argument |
| `$2` | Third argument |
| ... | Up to any index (multi-digit supported) |
| `$*` | All arguments joined with spaces |

Variables are substituted from the parameters passed to the format string. What each `$N` means depends on the format section — see [Format sections](#format-sections) below.

### Padded variables

```
$[N]0       Right-pad $0 to N characters
$[-N]0      Left-pad $0 to N characters
```

The number in brackets sets the padding width. Positive = right-pad (left-align), negative = left-pad (right-align). Any positional variable index can follow the brackets.

**Examples:**

```
$[12]0      # Right-pad $0 to 12 chars: "nick        "
$[-12]0     # Left-pad $0 to 12 chars:  "        nick"
$[8]1       # Right-pad $1 to 8 chars
```

## Abstractions

```
{name $args}
```

References a definition from the `[abstracts]` section of the theme file, passing arguments. Abstractions work like macros — the name is looked up, arguments are substituted into the template, and the result is expanded in place.

### How they resolve

Given these abstracts:

```toml
[abstracts]
ownnick = "%Z9ece6a%_$*%_%N"
msgnick = "%Z565f89$0$1%Z7aa2f7❯%N%| "
```

And this format:

```toml
own_msg = "{msgnick $2 {ownnick $0}}%Zc0caf5$1%N"
```

The resolution for a message from nick "koko" with mode "@" and text "hello":

1. `$0` = "koko", `$1` = "hello", `$2` = "@"
2. Inner `{ownnick $0}` resolves first: `{ownnick koko}` becomes `%Z9ece6a%_koko%_%N`
3. `{msgnick $2 <resolved_ownnick>}` becomes `{msgnick @ %Z9ece6a%_koko%_%N}`
4. The `msgnick` template receives `$0` = "@" and `$1` = "%Z9ece6a%_koko%_%N"
5. Final: `%Z565f89@%Z9ece6a%_koko%_%N%Z7aa2f7❯%N%| %Zc0caf5hello%N`

### Nesting

Abstractions can nest to any depth (up to 10 levels to prevent infinite recursion). Arguments to an abstraction can themselves contain abstraction references.

```toml
[abstracts]
channel = "%Z7aa2f7%_$*%_%N"

[formats.events]
join = "%Z9ece6a-->%N $0 has joined {channel $3}"
```

Here `{channel $3}` passes the channel name to the `channel` abstract, which renders it in bold blue.

## Alignment marker

```
%|
```

Marks the indent point for wrapped lines. When a message is too long to fit on one line, continuation lines are indented to this position. Typically placed after the nick column so message text wraps neatly without overlapping the nick area.

**Example:**

```toml
msgnick = "%Z565f89$0$1%Z7aa2f7❯%N%| "
#                                  ^^  indent point is after the separator
```

## mIRC control codes

The parser also handles standard mIRC control characters found in incoming IRC messages. These are processed transparently — you don't use them in theme files, but they render correctly when other clients send formatted text.

| Code | Hex | Description |
|------|-----|-------------|
| `\x02` | `0x02` | Bold toggle |
| `\x03` | `0x03` | mIRC color: `\x03FG` or `\x03FG,BG` (0-98 palette) |
| `\x04` | `0x04` | Hex color: `\x04RRGGBB` or `\x04RRGGBB,RRGGBB` |
| `\x0F` | `0x0F` | Reset all formatting |
| `\x11` | `0x11` | Monospace (ignored in terminal) |
| `\x16` | `0x16` | Reverse (swap foreground/background) |
| `\x1D` | `0x1D` | Italic toggle |
| `\x1E` | `0x1E` | Strikethrough (mapped to dim) |
| `\x1F` | `0x1F` | Underline toggle |

The mIRC color palette supports indices 0-98: the classic 16 colors (0-15) plus an extended palette (16-98) with gradients and grayscale values.

## Format sections

Each format section defines templates for a specific part of the UI. The variables available (`$0`, `$1`, etc.) depend on the section.

### `[formats.messages]`

Chat message formatting. Called with these parameters:

| Variable | Content |
|----------|---------|
| `$0` | Nick (display name, truncated to `nick_max_length` setting) |
| `$1` | Message text body |
| `$2` | Nick mode prefix with padding (e.g., `"  @"` for right-aligned op) |

| Format key | Description |
|------------|-------------|
| `own_msg` | Messages you send |
| `pubmsg` | Messages from other users |
| `pubmsg_mention` | Messages that mention your nick |
| `pubmsg_highlight` | Highlighted messages |
| `action` | `/me` action messages (`$0` = nick, `$1` = action text) |
| `notice` | NOTICE messages (`$0` = sender nick, `$1` = notice text) |

**Default theme examples:**

```toml
own_msg = "{msgnick $2 {ownnick $0}}%Zc0caf5$1%N"
pubmsg = "{msgnick $2 {pubnick $0}}%Za9b1d6$1%N"
action = "{action $0} %Ze0af68$1%N"
notice = "%Z7dcfff-%Z7aa2f7$0%Z7dcfff-%N $1"
```

### `[formats.events]`

IRC event formatting. Each event type has its own set of variables:

| Format key | `$0` | `$1` | `$2` | `$3` | `$4` |
|------------|------|------|------|------|------|
| `join` | nick | ident | hostname | channel | — |
| `part` | nick | ident | hostname | channel | reason |
| `quit` | nick | ident | hostname | reason | — |
| `nick_change` | old nick | new nick | — | — | — |
| `topic` | setter nick | topic text | — | — | — |
| `mode` | setter nick | mode string | channel | — | — |

**Default theme examples:**

```toml
join = "%Z9ece6a-->%N %Za9b1d6$0%N %Z565f89($1@$2)%N has joined {channel $3}"
part = "%Ze0af68<--%N %Za9b1d6$0%N %Z565f89($1@$2)%N has left {channel $3} %Z565f89($4)%N"
quit = "%Zf7768e<--%N %Za9b1d6$0%N %Z565f89($1@$2)%N has quit %Z565f89($3)%N"
nick_change = "%Zbb9af7---%N %Za9b1d6$0%N is now known as %Za9b1d6$1%N"
topic = "%Z7aa2f7---%N Topic set by %Z565f89$0%N: $1"
mode = "%Z7aa2f7---%N %Za9b1d6$0%N sets mode %Ze0af68$1%N on {channel $2}"
```

### `[formats.sidepanel]`

Buffer list (left panel) formatting.

**For `header`:** `$0` = server/connection label.

**For all item formats:** `$0` = buffer number, `$1` = buffer name.

| Format key | Description |
|------------|-------------|
| `header` | Server/connection group header |
| `item` | Default buffer item |
| `item_selected` | Currently focused buffer |
| `item_activity_0` | No new activity |
| `item_activity_1` | Normal activity (new messages) |
| `item_activity_2` | Mention/highlight activity |
| `item_activity_3` | High activity |
| `item_activity_4` | Special activity |

**Default theme examples:**

```toml
header = "%Z7aa2f7%_$0%_%N"
item_selected = "%Ze0af68$0.%N %Zc0caf5%_$1%_%N"
item_activity_0 = "%Z565f89$0.%N %Z6e738d$1%N"
item_activity_2 = "%Z565f89$0.%N %Zf7768e$1%N"
```

### `[formats.nicklist]`

Nick list (right panel) formatting. Variable: `$0` = nick.

Each format key corresponds to the highest channel privilege prefix the user holds:

| Format key | Prefix | Description |
|------------|--------|-------------|
| `owner` | `~` | Channel owner (+q) |
| `admin` | `&` | Channel admin (+a) |
| `op` | `@` | Channel operator (+o) |
| `halfop` | `%` | Half-operator (+h) |
| `voice` | `+` | Voiced user (+v) |
| `normal` | (none) | Regular user |

**Default theme examples:**

```toml
owner = "%Ze0af68~%Zc0caf5$0%N"
op = "%Z9ece6a@%Za9b1d6$0%N"
voice = "%Z7dcfff+%Z6e738d$0%N"
normal = " %Z565f89$0%N"
```

Note the leading space in `normal` — this aligns unprefixed nicks with prefixed ones.

## Quick reference table

All `%`-codes at a glance:

| Code | Effect |
|------|--------|
| `%k` `%K` | Black / bright black |
| `%r` `%R` | Red / bright red |
| `%g` `%G` | Green / bright green |
| `%y` `%Y` | Yellow / bright yellow |
| `%b` `%B` | Blue / bright blue |
| `%m` `%M` | Magenta / bright magenta |
| `%c` `%C` | Cyan / bright cyan |
| `%w` `%W` | White / bright white |
| `%ZRRGGBB` | 24-bit hex foreground color |
| `%N` `%n` | Reset all formatting |
| `%_` | Toggle bold |
| `%u` | Toggle underline |
| `%i` | Toggle italic |
| `%d` | Toggle dim |
| `%\|` | Indent/alignment marker |
| `%%` | Literal `%` character |

All variable codes:

| Code | Effect |
|------|--------|
| `$0`-`$9`+ | Positional argument (multi-digit supported) |
| `$*` | All arguments joined with spaces |
| `$[N]0` | Right-pad argument to N characters |
| `$[-N]0` | Left-pad argument to N characters |
| `{name args}` | Abstraction reference |
