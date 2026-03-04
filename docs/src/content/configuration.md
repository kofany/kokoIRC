# Configuration

## Config location

kokoIRC stores its configuration in `~/.kokoirc/config.toml`. This file is created automatically on first run with sensible defaults. Edit it with any text editor — it's plain TOML.

The full directory layout:

```
~/.kokoirc/
  config.toml          # main configuration
  .env                 # credentials (passwords, SASL)
  themes/              # custom themes
  scripts/             # user scripts
  logs.db              # chat logs (SQLite)
```

## Full annotated example

Here is a comprehensive config showing all available sections and options:

```toml
[general]
nick = "mynick"
username = "mynick"
realname = "kokoIRC user"
theme = "default"
timestamp_format = "%H:%M:%S"
flood_protection = true
ctcp_version = "kokoIRC"

[display]
nick_column_width = 8
nick_max_length = 8
nick_alignment = "right"       # "left", "right", or "center"
nick_truncation = true
show_timestamps = true
scrollback_lines = 2000

[sidepanel.left]
width = 20
visible = true

[sidepanel.right]
width = 18
visible = true

[servers.libera]
label = "Libera"
address = "irc.libera.chat"
port = 6697
tls = true
tls_verify = true
autoconnect = true
channels = ["#kokoirc", "#secret mykey"]
autosendcmd = "MSG NickServ identify pass; WAIT 2000; MODE $N +i"
# nick = "othernick"           # per-server nick override
# sasl_user = "mynick"
# sasl_pass = "hunter2"
# bind_ip = "my.vhost.example.com"
# encoding = "utf8"
# auto_reconnect = true
# reconnect_delay = 30
# reconnect_max_retries = 10

[image_preview]
enabled = true
protocol = "auto"              # "auto", "kitty", "iterm2", "sixel", "symbols"
max_width = 0                  # 0 = auto (~75% of terminal)
max_height = 0                 # 0 = auto (~75% of terminal)
cache_max_mb = 100
cache_max_days = 7
fetch_timeout = 30
max_file_size = 10485760       # 10MB
# kitty_format = "rgba"        # "rgba" or "png"

[logging]
enabled = true
encrypt = false
retention_days = 0             # 0 = keep forever
exclude_types = []             # e.g. ["join", "part", "quit"]

[aliases]
wc = "/close"
j = "/join"

[scripts]
autoload = ["slap"]
# debug = true                 # enable script debug logging
```

## Sections explained

### `[general]`

Global identity and behavior. The `nick`, `username`, and `realname` are used as defaults for all servers unless overridden per-server. Set `theme` to the name of a theme file in `~/.kokoirc/themes/` (without the `.theme` extension). `flood_protection` enables automatic throttling when your client sends too many messages.

### `[display]`

Controls how messages are rendered. `nick_column_width` sets the fixed-width column for nicks in chat view — nicks longer than this are truncated (if `nick_truncation = true`) or overflow. `scrollback_lines` is the number of messages kept in memory per buffer.

### `[sidepanel]`

Left panel shows buffer list, right panel shows nick list. Set `visible = false` to hide a panel. Widths are in terminal columns and can also be adjusted at runtime by dragging panel edges with the mouse.

### `[servers.*]`

Each server gets a unique identifier (the key after `servers.`). The `channels` array lists channels to auto-join on connect. Channels with keys use the format `"#channel key"`. See the SASL and autosendcmd sections below for authentication options.

### `[image_preview]`

Inline image preview in the terminal. When enabled, clicking an image URL or using `/preview <url>` displays a popup overlay. The `protocol` setting controls which graphics protocol to use — `auto` detects your terminal automatically. Set `max_width` and `max_height` to limit popup size (0 = auto-scale to ~75% of terminal). See the [Image Preview](image-preview.html) page for full documentation.

### `[logging]`

Chat logging to SQLite. When `encrypt = true`, messages are encrypted with AES-256-GCM (you'll be prompted for a passphrase). `retention_days = 0` keeps logs forever; set a positive number to auto-delete old entries.

### `[aliases]`

Custom command shortcuts. The key is the alias name, the value is the command it expands to. For example, `wc = "/close"` lets you type `/wc` to close a buffer.

### `[scripts]`

The `autoload` array lists script names to load on startup. Scripts live in `~/.kokoirc/scripts/` as `.ts` or `.js` files. See the [Scripting guide](scripting-getting-started.html) for details.

## Credentials

Passwords and SASL credentials should **not** go in `config.toml` — store them in `~/.kokoirc/.env` instead. Bun loads this file automatically.

The naming convention uses the server identifier (the key in `[servers.*]`) uppercased:

```bash
# ~/.kokoirc/.env
LIBERA_SASL_USER=mynick
LIBERA_SASL_PASS=hunter2
LIBERA_PASSWORD=serverpassword
```

For a server configured as `[servers.ircnet]`, the variables would be `IRCNET_SASL_USER`, `IRCNET_SASL_PASS`, and `IRCNET_PASSWORD`.

## SASL authentication

SASL PLAIN is the recommended way to authenticate with networks that support it (Libera Chat, OFTC, etc.).

**Option 1 — config only** (simpler but less secure):

```toml
[servers.libera]
address = "irc.libera.chat"
port = 6697
tls = true
sasl_user = "mynick"
sasl_pass = "hunter2"
```

**Option 2 — credentials in .env** (recommended):

```toml
[servers.libera]
address = "irc.libera.chat"
port = 6697
tls = true
sasl_user = "mynick"
# sasl_pass loaded from .env
```

```bash
# ~/.kokoirc/.env
LIBERA_SASL_PASS=hunter2
```

The `.env` values override anything set in `config.toml`, so you can safely keep `sasl_user` in the config for convenience while keeping the password out of it.

## Autosendcmd

The `autosendcmd` field runs raw IRC commands after connecting to a server, before auto-joining channels. This is useful for NickServ identification on networks without SASL, setting user modes, or any other post-connect setup.

**Syntax:**

- Commands are separated by semicolons (`;`)
- `WAIT <ms>` inserts a delay in milliseconds
- `$N` is substituted with your current nick

**Examples:**

```toml
# Identify with NickServ, wait 2 seconds, then set mode +i
autosendcmd = "MSG NickServ identify mypassword; WAIT 2000; MODE $N +i"

# Request a vhost after identifying
autosendcmd = "MSG NickServ identify pass; WAIT 3000; MSG HostServ ON"

# Just set a user mode
autosendcmd = "MODE $N +ix"
```

The channel auto-join happens after all autosendcmd commands (including WAITs) complete, so NickServ identification finishes before you join any channels.

## Runtime changes

You don't need to restart kokoIRC to change most settings:

- **`/set section.field value`** — change a config value at runtime. For example:

  ```
  /set general.nick newnick
  /set display.scrollback_lines 5000
  /set aliases.wc /close
  ```

  Changes made with `/set` are saved to `config.toml` immediately.

- **`/reload`** — reload theme and config from disk. Use this after editing `config.toml` or theme files in an external editor.
