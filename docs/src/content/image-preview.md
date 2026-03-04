# Image Preview

kokoIRC can display inline image previews directly in your terminal. When someone shares an image URL in chat, click the link or use `/preview <url>` to see it without leaving the client.

## Supported protocols

The display protocol is auto-detected based on your terminal emulator:

| Protocol | Terminals | Quality |
|----------|-----------|---------|
| **Kitty** | kitty, ghostty, WezTerm, Rio, Subterm | Best — dedicated graphics layer, clean delete |
| **iTerm2** | iTerm2 | Great — inline images via proprietary escape |
| **Sixel** | foot, contour, konsole, mintty, mlterm, xterm | Good — bitmap graphics via DEC standard |
| **Symbols** | Any terminal | Fallback — Unicode half-block characters |

All protocols work through **tmux** with DCS passthrough. Inside tmux, the outer terminal's protocol is detected automatically via `tmux display-message`.

## Usage

### Click a URL

When an image link appears in chat, click it. kokoIRC detects image URLs (`.jpg`, `.png`, `.gif`, `.webp`) and pages with `og:image` metadata (imgur, imgbb, etc.).

### `/preview` command

```
/preview https://i.imgur.com/abc123.jpg
/preview https://imgur.com/gallery/xyz
```

Fetches the image, displays it as a centered popup overlay. Press any key or click to dismiss.

### `/image` command

Manage the image cache:

```
/image              # show status
/image stats        # cache file count and disk usage
/image clear        # delete all cached images
```

## Configuration

Add an `[image_preview]` section to your `~/.kokoirc/config.toml`:

```toml
[image_preview]
enabled = true              # enable/disable image preview (default: true)
protocol = "auto"           # "auto", "kitty", "iterm2", "sixel", "symbols"
max_width = 0               # max popup width in columns (0 = auto ~75% of terminal)
max_height = 0              # max popup height in rows (0 = auto ~75% of terminal)
cache_max_mb = 100          # disk cache limit in MB
cache_max_days = 7          # delete cached images older than this
fetch_timeout = 30          # download timeout in seconds
max_file_size = 10485760    # max download size in bytes (default: 10MB)
kitty_format = "rgba"       # kitty pixel format: "rgba" or "png"
```

All settings can be changed at runtime with `/set`:

```
/set image_preview.enabled false
/set image_preview.protocol kitty
/set image_preview.max_width 60
/set image_preview.cache_max_mb 200
```

### Protocol selection

- **`auto`** (default) — detects your terminal and picks the best protocol
- **`kitty`** — force kitty graphics protocol (PNG format for reliability)
- **`iterm2`** — force iTerm2 inline images
- **`sixel`** — force sixel graphics
- **`symbols`** — force Unicode half-block fallback (works everywhere)

### Size limits

When `max_width` and `max_height` are `0` (default), the popup scales to ~75% of your terminal dimensions while preserving the image's aspect ratio. Set explicit values to cap the preview size:

```toml
max_width = 60    # never wider than 60 columns
max_height = 30   # never taller than 30 rows
```

### Cache

Downloaded images are cached in `~/.kokoirc/cache/images/`. The cache respects both size (`cache_max_mb`) and age (`cache_max_days`) limits. Use `/image clear` to wipe it manually.

## Terminal compatibility notes

- **kitty/ghostty/WezTerm**: Full support, images render on a dedicated graphics layer that doesn't interfere with text
- **iTerm2**: Full support via proprietary inline image protocol
- **tmux**: Works with DCS passthrough. kokoIRC auto-detects the outer terminal through tmux
- **Sixel terminals**: Image quality depends on the terminal's color palette and resolution support
- **Basic terminals**: The Unicode symbols fallback works in any terminal with UTF-8 support, but quality is limited to half-character resolution

## Troubleshooting

**Image doesn't display:**
Check your protocol setting with `/set image_preview.protocol`. Try forcing a specific protocol instead of `auto`.

**Image looks corrupted in tmux:**
Make sure your tmux version supports DCS passthrough (tmux 3.2+). kokoIRC handles the DCS wrapping automatically.

**Preview is too large/small:**
Adjust `max_width` and `max_height` in your config, or resize your terminal window.

**Cache using too much disk:**
Lower `cache_max_mb` or `cache_max_days`, or run `/image clear` to wipe the cache.
