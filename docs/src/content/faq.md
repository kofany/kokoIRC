# FAQ & Migration Guide

Answers to common questions, plus practical tips for users coming from other IRC clients.

<style>
/* Migration cards */
.migration-section {
  margin: 32px 0;
  background: #24283b;
  border: 1px solid #3b4261;
  border-radius: 8px;
  overflow: hidden;
}

.migration-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: rgba(122, 162, 247, 0.06);
  border-bottom: 1px solid #3b4261;
  cursor: pointer;
  user-select: none;
}

.migration-header:hover {
  background: rgba(122, 162, 247, 0.1);
}

.migration-icon {
  font-size: 1.4rem;
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.migration-title {
  font-size: 1.15rem;
  font-weight: 600;
  color: #c0caf5;
  margin: 0;
}

.migration-subtitle {
  font-size: 0.85rem;
  color: #565f89;
  margin: 0;
}

.migration-body {
  padding: 20px 24px;
}

.migration-body h4 {
  color: #7aa2f7;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 10px 0;
}

.migration-body h4:not(:first-child) {
  margin-top: 20px;
}

.migration-body ul {
  margin: 0 0 8px 0;
  padding-left: 20px;
}

.migration-body li {
  color: #a9b1d6;
  font-size: 14px;
  margin-bottom: 6px;
  line-height: 1.6;
}

.migration-body li::marker {
  color: #565f89;
}

.migration-body strong {
  color: #c0caf5;
}

.migration-body code {
  background: #1a1b26;
  color: #9ece6a;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  border: 1px solid #292e42;
}

.migration-tip {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(158, 206, 106, 0.06);
  border-left: 3px solid #9ece6a;
  border-radius: 0 6px 6px 0;
  font-size: 13px;
  color: #9ece6a;
  line-height: 1.6;
}

.migration-tip strong {
  color: #9ece6a;
}

/* FAQ section */
.faq-item {
  margin: 16px 0;
  background: #24283b;
  border: 1px solid #3b4261;
  border-radius: 6px;
  overflow: hidden;
}

.faq-question {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  font-weight: 600;
  color: #c0caf5;
  font-size: 0.95rem;
  cursor: pointer;
  user-select: none;
}

.faq-question:hover {
  background: rgba(122, 162, 247, 0.04);
}

.faq-chevron {
  color: #565f89;
  font-size: 0.8rem;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.faq-item.open .faq-chevron {
  transform: rotate(90deg);
}

.faq-answer {
  display: none;
  padding: 0 20px 16px 20px;
  color: #a9b1d6;
  font-size: 14px;
  line-height: 1.7;
}

.faq-item.open .faq-answer {
  display: block;
}

.faq-answer code {
  background: #1a1b26;
  color: #9ece6a;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  border: 1px solid #292e42;
}

.faq-answer a {
  color: #7aa2f7;
  text-decoration: none;
}

.faq-answer a:hover {
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 768px) {
  .migration-body {
    padding: 16px;
  }

  .migration-header {
    padding: 12px 16px;
  }

  .faq-question {
    padding: 12px 16px;
  }

  .faq-answer {
    padding: 0 16px 12px 16px;
  }
}
</style>

## Migration Guides

Whether you're coming from irssi, weechat, The Lounge, or mIRC, you'll find familiar concepts in kokoIRC. Here's what to expect.

<div class="migration-section">
  <div class="migration-header" onclick="this.parentElement.classList.toggle('open')">
    <span class="migration-icon">></span>
    <div>
      <div class="migration-title">Coming from irssi</div>
      <div class="migration-subtitle">The spiritual ancestor — most muscle memory transfers directly</div>
    </div>
  </div>
  <div class="migration-body">
    <h4>What's familiar</h4>
    <ul>
      <li><strong>Esc+1-9</strong> window switching works identically</li>
      <li>The same <strong>/commands</strong> you already know — <code>/join</code>, <code>/part</code>, <code>/msg</code>, <code>/query</code>, <code>/nick</code>, <code>/topic</code>, etc.</li>
      <li><strong>Format string theming</strong> with familiar <code>%C</code>, <code>%B</code>, <code>%U</code> tokens — kokoIRC extends these with 24-bit color and hex support</li>
      <li><strong>Scripting model</strong> — irssi has Perl, kokoIRC has TypeScript. The concept is the same: hook events, define commands, automate workflows</li>
      <li><strong>Status window</strong> and per-channel buffer layout</li>
    </ul>

    <h4>What's different</h4>
    <ul>
      <li><strong>TOML config</strong> instead of <code>/set</code> — one file at <code>~/.kokoirc/config.toml</code>, not scattered runtime settings</li>
      <li><strong>TypeScript scripts</strong> instead of Perl — modern async/await, type safety, npm ecosystem</li>
      <li><strong>Built-in mouse support</strong> — click buffers, click nicks, drag to resize panels</li>
      <li><strong>SQLite logging</strong> with FTS5 full-text search instead of plain text files</li>
      <li><strong>Single binary</strong> — <code>bun build</code> produces one executable, no system packages or cpan modules</li>
      <li><strong>TOML themes</strong> instead of <code>/format</code> commands — structured, version-controllable theme files</li>
    </ul>

    <div class="migration-tip">
      <strong>Tip:</strong> Your irssi aliases map directly. Add <code>wc = "/close"</code> and <code>j = "/join"</code> to the <code>[aliases]</code> section in config.toml. The <code>autosendcmd</code> option replaces irssi's autosendcmd with the same semicolon-separated syntax: <code>"MSG NickServ identify pass; WAIT 2000; MODE $N +i"</code>
    </div>
  </div>
</div>

<div class="migration-section">
  <div class="migration-header" onclick="this.parentElement.classList.toggle('open')">
    <span class="migration-icon">></span>
    <div>
      <div class="migration-title">Coming from weechat</div>
      <div class="migration-subtitle">Similar philosophy, simpler config, modern stack</div>
    </div>
  </div>
  <div class="migration-body">
    <h4>What's familiar</h4>
    <ul>
      <li><strong>Plugin/script model</strong> — weechat's extension system maps to kokoIRC's TypeScript scripting API</li>
      <li><strong>Buffer list</strong> in the left panel with network grouping</li>
      <li><strong>Nick list</strong> in the right panel with mode prefixes (@, +)</li>
      <li><strong>Customizable status bar</strong> showing current nick, channel, modes, and lag</li>
    </ul>

    <h4>What's different</h4>
    <ul>
      <li><strong>TypeScript only</strong> — no Python, Lua, Ruby, or Guile. One language, full type safety, modern tooling</li>
      <li><strong>One TOML file</strong> instead of weechat's many config files (<code>weechat.conf</code>, <code>irc.conf</code>, <code>buflist.conf</code>, etc.)</li>
      <li><strong>TOML themes</strong> instead of <code>/set weechat.color.*</code> — structured color definitions with 24-bit support</li>
      <li><strong>No relay protocol</strong> (yet) — web UI is on the roadmap, sharing the same Zustand state store</li>
    </ul>

    <h4>Why switch</h4>
    <ul>
      <li><strong>Built-in encrypted logging</strong> with AES-256-GCM per-message encryption</li>
      <li><strong>FTS5 full-text search</strong> across all channels and queries — <code>/log search</code> finds anything instantly</li>
      <li><strong>Single binary deployment</strong> — no compilation from source, no dependency management</li>
      <li><strong>Modern React UI engine</strong> under the hood — smooth rendering, proper Unicode, truecolor everywhere</li>
    </ul>
  </div>
</div>

<div class="migration-section">
  <div class="migration-header" onclick="this.parentElement.classList.toggle('open')">
    <span class="migration-icon">></span>
    <div>
      <div class="migration-title">Coming from The Lounge</div>
      <div class="migration-subtitle">Terminal-first, with web UI coming next</div>
    </div>
  </div>
  <div class="migration-body">
    <h4>What's familiar</h4>
    <ul>
      <li><strong>Multi-network support</strong> — connect to as many servers as you need simultaneously</li>
      <li><strong>Persistent history</strong> — messages survive restarts, stored in SQLite</li>
      <li><strong>Modern feel</strong> — a client designed in the 2020s, not the 1990s</li>
    </ul>

    <h4>What's different</h4>
    <ul>
      <li><strong>Terminal-first</strong> — kokoIRC is a terminal application (web UI coming in the next phase, same aesthetics)</li>
      <li><strong>TypeScript scripting</strong> — The Lounge has no scripting API; kokoIRC lets you automate anything</li>
      <li><strong>Format string theming</strong> — deep control over every line of output, not just CSS variables</li>
      <li><strong>Encrypted logs</strong> — optional AES-256-GCM encryption for your message history</li>
    </ul>

    <h4>Why switch</h4>
    <ul>
      <li><strong>Web UI is on the roadmap</strong> — the Zustand store is already UI-agnostic, built for 1:1 terminal/web sync</li>
      <li><strong>Scripting</strong> — automate flood protection, custom commands, integrations, anything you can write in TypeScript</li>
      <li><strong>Better logging</strong> — SQLite WAL with FTS5 search, optional encryption, configurable retention</li>
      <li><strong>Single binary</strong> — deploy by copying one file, no Node.js server to maintain</li>
    </ul>
  </div>
</div>

<div class="migration-section">
  <div class="migration-header" onclick="this.parentElement.classList.toggle('open')">
    <span class="migration-icon">></span>
    <div>
      <div class="migration-title">Coming from mIRC</div>
      <div class="migration-subtitle">Modern, open source, cross-platform replacement</div>
    </div>
  </div>
  <div class="migration-body">
    <h4>What's familiar</h4>
    <ul>
      <li><strong>Channel windows</strong> — each channel gets its own buffer, just like mIRC's MDI windows</li>
      <li><strong>Nick list</strong> — right-side panel showing channel members with mode prefixes</li>
      <li>The same <strong>/commands</strong> — <code>/join</code>, <code>/part</code>, <code>/msg</code>, <code>/nick</code>, <code>/kick</code>, <code>/ban</code>, etc.</li>
      <li><strong>Aliases</strong> — define shortcuts for common commands in the <code>[aliases]</code> config section</li>
    </ul>

    <h4>What's different</h4>
    <ul>
      <li><strong>Cross-platform</strong> — runs on macOS, Linux, and Windows (anywhere Bun runs). Not Windows-only</li>
      <li><strong>Terminal-based</strong> — no GUI dialogs or toolbars. The interface is a terminal with keyboard and mouse</li>
      <li><strong>TOML config</strong> instead of dialog boxes — edit <code>~/.kokoirc/config.toml</code> in any text editor</li>
      <li><strong>TypeScript scripting</strong> instead of mIRC scripting language — modern, well-documented, vast ecosystem</li>
    </ul>

    <h4>Why switch</h4>
    <ul>
      <li><strong>Open source</strong> and MIT licensed — free forever, no shareware nag screens</li>
      <li><strong>Modern scripting</strong> — TypeScript with full npm ecosystem vs. mIRC's proprietary scripting language</li>
      <li><strong>Encrypted logging</strong> — AES-256-GCM per-message encryption, not plaintext log files</li>
      <li><strong>Cross-platform</strong> — use the same client and config on all your machines</li>
      <li><strong>Active development</strong> — web UI, mobile support, and more on the roadmap</li>
    </ul>
  </div>
</div>

---

## Frequently Asked Questions

<div id="faq-list">

<div class="faq-item open">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    What are the system requirements?
  </div>
  <div class="faq-answer">
    <strong>Bun v1.2+</strong> and a terminal with <strong>256-color or truecolor support</strong>. That's it. kokoIRC runs on macOS, Linux, and Windows. For the best experience, use a modern terminal emulator like iTerm2, Alacritty, kitty, WezTerm, or Windows Terminal.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    Where is the config file?
  </div>
  <div class="faq-answer">
    <code>~/.kokoirc/config.toml</code> — created automatically on first run with sensible defaults. Edit it with any text editor. See the <a href="configuration.html">Configuration</a> page for full documentation.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    Where are logs stored?
  </div>
  <div class="faq-answer">
    <code>~/.kokoirc/logs.db</code> — a SQLite database with WAL mode and FTS5 full-text search. Use <code>/log search &lt;query&gt;</code> to search across all channels and queries. See the <a href="logging.html">Logging & Search</a> page for details.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    Can I use kokoIRC on Windows?
  </div>
  <div class="faq-answer">
    Yes. Bun runs on Windows, and kokoIRC works in any terminal that supports 256 colors. Use <strong>Windows Terminal</strong> for the best color and Unicode support. The classic <code>cmd.exe</code> will work but with limited color rendering.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    Can I run multiple connections?
  </div>
  <div class="faq-answer">
    Yes. Add multiple <code>[servers.*]</code> sections in your config.toml. Each server gets its own set of channels and settings. For example, you might have <code>[servers.libera]</code> and <code>[servers.oftc]</code> running simultaneously, each with their own channels, nick, and SASL credentials.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    Does it support SASL?
  </div>
  <div class="faq-answer">
    Yes. Set <code>sasl_user</code> and <code>sasl_pass</code> in your server configuration block. SASL PLAIN authentication is performed automatically during connection. Keep credentials in <code>~/.kokoirc/.env</code> and reference them with environment variable syntax for better security.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    Does it support TLS?
  </div>
  <div class="faq-answer">
    Yes. Set <code>tls = true</code> in your server config. TLS is <strong>enabled by default</strong> for port 6697. Certificate verification is controlled with <code>tls_verify = true</code> (also the default). You can use any standard IRC server with TLS support.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    How do I search chat history?
  </div>
  <div class="faq-answer">
    Use <code>/log search &lt;query&gt;</code> from any buffer. The FTS5 full-text search index covers all logged messages across all channels and queries. You can search by keywords, nick, or phrases. Results are displayed inline with timestamps and context.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    Can I encrypt my logs?
  </div>
  <div class="faq-answer">
    Yes. Set <code>encrypt = true</code> in the <code>[logging]</code> section of your config. Messages are encrypted with <strong>AES-256-GCM</strong> on a per-message basis. The encryption key is derived from your configuration. Even with encryption enabled, FTS5 search continues to work over the plaintext index columns.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    How do I write scripts?
  </div>
  <div class="faq-answer">
    Create <code>.ts</code> files in <code>~/.kokoirc/scripts/</code>. Scripts are TypeScript modules that import from the kokoIRC API. You can hook IRC events, define custom commands, and interact with the full IRC protocol. See the <a href="scripting-getting-started.html">Scripting guide</a> for a complete walkthrough.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    How do I report bugs?
  </div>
  <div class="faq-answer">
    Open an issue on GitHub: <a href="https://github.com/kofany/kokoIRC/issues">github.com/kofany/kokoIRC/issues</a>. Include your kokoIRC version, OS, terminal emulator, and steps to reproduce the issue.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    How do I contribute?
  </div>
  <div class="faq-answer">
    Fork the repository, make your changes, and submit a pull request. The codebase is TypeScript with a clean separation between <code>src/core/</code> (IRC logic) and <code>src/ui/</code> (React terminal components). See the architecture section in the README for an overview.
  </div>
</div>

<div class="faq-item">
  <div class="faq-question" onclick="this.parentElement.classList.toggle('open')">
    <span class="faq-chevron">&#9654;</span>
    Is kokoIRC free?
  </div>
  <div class="faq-answer">
    Yes. kokoIRC is open source and released under the <strong>MIT license</strong>. Free to use, modify, and distribute.
  </div>
</div>

</div>

<script>
// Open first FAQ item by default (already handled via class="open")
// Toggle is handled by onclick on each .faq-question
</script>
