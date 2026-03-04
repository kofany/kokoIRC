# kokoIRC

A modern terminal IRC client built with OpenTUI, React, and Bun. Inspired by irssi, designed for the future.

![kokoIRC splash screen](images/splash.png)

## Features

<div class="card-grid">
  <div class="card">
    <div class="card-title">Full IRC Protocol</div>
    <div class="card-body">Channels, queries, CTCP, SASL, TLS, channel modes, ban lists — the complete IRC experience.</div>
  </div>
  <div class="card">
    <div class="card-title">irssi-style Navigation</div>
    <div class="card-body">Esc+1–9 window switching, /commands, aliases. If you know irssi, you already know kokoIRC.</div>
  </div>
  <div class="card">
    <div class="card-title">Mouse Support</div>
    <div class="card-body">Click buffers and nicks, drag to resize side panels. Terminal client, modern interaction.</div>
  </div>
  <div class="card">
    <div class="card-title">Netsplit Detection</div>
    <div class="card-body">Batches join/part floods into single events so your scrollback stays readable.</div>
  </div>
  <div class="card">
    <div class="card-title">Flood Protection</div>
    <div class="card-body">Blocks CTCP spam and nick-change floods from botnets automatically.</div>
  </div>
  <div class="card">
    <div class="card-title">Persistent Logging</div>
    <div class="card-body">SQLite with optional AES-256-GCM encryption and FTS5 full-text search across all logs.</div>
  </div>
  <div class="card">
    <div class="card-title">Theming</div>
    <div class="card-body">irssi-compatible format strings with 24-bit color support and custom abstracts.</div>
  </div>
  <div class="card">
    <div class="card-title">Scripting</div>
    <div class="card-body">TypeScript scripts with an event bus, custom commands, and full IRC access.</div>
  </div>
  <div class="card">
    <div class="card-title">Single Binary</div>
    <div class="card-body">Compiles to a ~68MB standalone executable. No runtime dependencies.</div>
  </div>
</div>

## Quick Install

```bash
bun install -g kokoirc
kokoirc
```

That's it. No build steps, no configuration required. Connect to a server with `/server add` and you're chatting.

New to kokoIRC? Start with the [Installation guide](installation.html).

## Screenshots

![Chat view](images/chat.png)

![Help command](images/help.png)

![Configuration](images/config.png)
