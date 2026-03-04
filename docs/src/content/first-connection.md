# First Connection

## First launch

When you run kokoIRC for the first time, it creates `~/.kokoirc/config.toml` with sensible defaults. You'll see the splash screen with version info and a quick-start hint.

No configuration is required before connecting — you can start chatting immediately.

## Connect to a server

Use the `/connect` command to connect to an IRC network:

```
/connect irc.libera.chat
```

This connects with TLS on port 6697 by default. To connect without TLS or on a different port, use `/server add` to set up a persistent server entry.

To auto-connect on startup, add a server block to your config:

```toml
[servers.libera]
label = "Libera"
address = "irc.libera.chat"
port = 6697
tls = true
autoconnect = true
channels = ["#kokoirc"]
```

## Join a channel

```
/join #kokoirc
```

The `#` prefix is auto-added if you omit it, so `/join kokoirc` works too. To join a channel with a key:

```
/join #secret mykey
```

## Basic navigation

kokoIRC uses a **window/buffer** model similar to irssi:

- **Window 1** is always the status window — it shows server messages, errors, and system notices.
- Each channel and private query opens in its own numbered window.
- The **left sidebar** shows all open buffers with activity indicators.
- The **right sidebar** shows the nick list for the current channel.

Switch between windows using keyboard shortcuts or by clicking buffer names in the sidebar.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Esc+1–9 | Switch to window 1–9 |
| Esc+0 | Switch to window 10 |
| Esc+Left/Right | Previous/next window |
| Page Up/Down | Scroll chat history |
| Tab | Nick completion |
| Ctrl+Q | Quit |

> **Tip:** Esc-number works the same as irssi's Alt-number. If your terminal passes Alt through, Alt+1–9 works too.

## Mouse support

kokoIRC has full mouse support in terminals that report mouse events:

- **Click** buffer names in the left sidebar to switch windows
- **Click** nicks in the right sidebar to open a private query
- **Drag** panel edges to resize the sidebars
- **Scroll** the chat area with your mouse wheel

Mouse support is enabled automatically. No configuration needed.

## Getting help

The built-in help system covers every command:

```
/help              — list all available commands
/help <command>    — detailed help for a specific command
```

For example, `/help server` shows the full syntax for adding and managing server connections. `/help set` explains how to change configuration at runtime.
