# Installation

## Requirements

- **Bun v1.2+** — kokoIRC is built on the [Bun](https://bun.sh) runtime. Install it with `curl -fsSL https://bun.sh/install | bash` if you don't have it yet.
- **A terminal with 256-color or truecolor support** — any modern terminal works: iTerm2, Alacritty, kitty, WezTerm, Windows Terminal, GNOME Terminal, etc. The default macOS Terminal.app works but truecolor themes will look better elsewhere.

## Install from npm

The quickest way to get started:

```bash
# Global install (adds kokoirc to PATH)
bun install -g kokoirc
kokoirc
```

Or install locally in a project:

```bash
# Local install
bun add kokoirc
bunx kokoirc
```

## Install from source

If you want to hack on kokoIRC or run the latest unreleased code:

```bash
git clone https://github.com/kofany/kokoIRC.git
cd kokoIRC
bun install
bun run start
```

## Build standalone binary

You can compile kokoIRC into a single executable that runs without Bun installed:

```bash
bun run build
./openirc
```

The binary is ~68MB (includes the Bun runtime) and runs without any dependencies. Copy it to any machine with the same OS/architecture and it just works.
