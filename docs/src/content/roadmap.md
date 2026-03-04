# Roadmap

Where kokoIRC is headed — from a feature-complete terminal client to a unified cross-device IRC experience.

<style>
/* Roadmap timeline */
.roadmap-timeline {
  position: relative;
  padding: 0 0 0 48px;
  margin: 32px 0 48px 0;
}

.roadmap-timeline::before {
  content: '';
  position: absolute;
  left: 18px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(
    180deg,
    #9ece6a 0%,
    #7aa2f7 40%,
    #bb9af7 70%,
    #3b4261 100%
  );
}

.roadmap-phase {
  position: relative;
  margin-bottom: 48px;
}

.roadmap-phase:last-child {
  margin-bottom: 0;
}

/* Timeline node */
.roadmap-phase::before {
  content: '';
  position: absolute;
  left: -38px;
  top: 6px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid;
  z-index: 1;
}

/* Phase-specific node colors */
.roadmap-phase.phase-now::before {
  background: #9ece6a;
  border-color: #9ece6a;
  box-shadow: 0 0 12px rgba(158, 206, 106, 0.5);
}

.roadmap-phase.phase-next::before {
  background: #7aa2f7;
  border-color: #7aa2f7;
  box-shadow: 0 0 12px rgba(122, 162, 247, 0.4);
}

.roadmap-phase.phase-future::before {
  background: transparent;
  border-color: #bb9af7;
}

.roadmap-phase.phase-vision::before {
  background: transparent;
  border-color: #3b4261;
}

/* Phase header */
.phase-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.phase-label {
  display: inline-block;
  padding: 2px 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-radius: 12px;
}

.label-now {
  background: rgba(158, 206, 106, 0.15);
  color: #9ece6a;
}

.label-next {
  background: rgba(122, 162, 247, 0.15);
  color: #7aa2f7;
}

.label-future {
  background: rgba(187, 154, 247, 0.15);
  color: #bb9af7;
}

.label-vision {
  background: rgba(59, 66, 97, 0.4);
  color: #565f89;
}

.phase-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #c0caf5;
  margin: 0;
  line-height: 1.3;
}

/* Phase card body */
.phase-body {
  background: #24283b;
  border: 1px solid #3b4261;
  border-radius: 6px;
  padding: 20px 24px;
}

.phase-body p {
  margin-bottom: 12px;
  color: #a9b1d6;
  font-size: 14px;
  line-height: 1.7;
}

.phase-body p:last-child {
  margin-bottom: 0;
}

.phase-body ul {
  margin: 0 0 12px 0;
  padding-left: 20px;
}

.phase-body ul:last-child {
  margin-bottom: 0;
}

.phase-body li {
  color: #a9b1d6;
  font-size: 14px;
  margin-bottom: 6px;
  line-height: 1.6;
}

.phase-body li::marker {
  color: #565f89;
}

.phase-body strong {
  color: #c0caf5;
}

.phase-body code {
  background: #1a1b26;
  color: #9ece6a;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  border: 1px solid #292e42;
}

/* Architecture callout within timeline */
.arch-note {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(122, 162, 247, 0.06);
  border-left: 3px solid #7aa2f7;
  border-radius: 0 6px 6px 0;
  font-size: 13px;
  color: #7dcfff;
  line-height: 1.6;
}

.arch-note code {
  color: #7aa2f7;
  background: rgba(122, 162, 247, 0.1);
  border-color: rgba(122, 162, 247, 0.2);
}

/* Vision statement */
.vision-statement {
  text-align: center;
  font-size: 15px;
  color: #a9b1d6;
  line-height: 1.8;
  padding: 8px 0;
}

.vision-statement strong {
  color: #c0caf5;
}

/* Responsive */
@media (max-width: 768px) {
  .roadmap-timeline {
    padding-left: 36px;
  }

  .roadmap-timeline::before {
    left: 12px;
  }

  .roadmap-phase::before {
    left: -30px;
    width: 12px;
    height: 12px;
  }

  .phase-body {
    padding: 16px;
  }

  .phase-title {
    font-size: 1.1rem;
  }
}
</style>

<div class="roadmap-timeline">

  <div class="roadmap-phase phase-now">
    <div class="phase-header">
      <span class="phase-label label-now">Now</span>
      <span class="phase-title">Terminal Client (Stable)</span>
    </div>
    <div class="phase-body">
      <p>Feature-complete terminal IRC client, ready for daily use.</p>
      <ul>
        <li><strong>38 built-in commands</strong> covering channels, queries, server management, and admin operations</li>
        <li><strong>TypeScript scripting</strong> with an event bus, custom commands, and full IRC protocol access</li>
        <li><strong>TOML-based theming</strong> with irssi-compatible format strings and 24-bit color support</li>
        <li><strong>Persistent logging</strong> with SQLite WAL, optional AES-256-GCM encryption, and FTS5 full-text search</li>
        <li><strong>Flood protection</strong> and automatic netsplit detection that batches join/part floods</li>
        <li><strong>Mouse support</strong> with clickable buffers, nick lists, and draggable panel resize handles</li>
        <li><strong>irssi-style navigation</strong> — <code>Esc+1-9</code> window switching, <code>/commands</code>, and aliases</li>
        <li><strong>Single binary</strong> — compiles to a standalone executable with Bun, no runtime dependencies</li>
      </ul>
    </div>
  </div>

  <div class="roadmap-phase phase-next">
    <div class="phase-header">
      <span class="phase-label label-next">Next</span>
      <span class="phase-title">Web UI</span>
    </div>
    <div class="phase-body">
      <p>The same smooth terminal aesthetics, rendered in the browser.</p>
      <ul>
        <li><strong>Real-time 1:1 state sync</strong> with the terminal client via the UI-agnostic Zustand store</li>
        <li><strong>Terminal-native look</strong> — the same dark, monospace design. Not a generic web chat skin</li>
        <li><strong>Connect from anywhere</strong> — your terminal session stays perfectly in sync</li>
        <li><strong>Shared logging database</strong> — messages appear everywhere, with per-client read markers</li>
      </ul>
      <div class="arch-note">
        The architecture is already designed for this. The Zustand store has <strong>zero UI imports</strong> — it manages pure IRC state. The UI layer never imports from <code>core/irc</code> directly. Swapping the React terminal renderer for a web renderer is a matter of building a new view layer on top of the same state.
      </div>
    </div>
  </div>

  <div class="roadmap-phase phase-future">
    <div class="phase-header">
      <span class="phase-label label-future">Future</span>
      <span class="phase-title">Mobile Web UI</span>
    </div>
    <div class="phase-body">
      <p>Responsive version of the web frontend for phones and tablets.</p>
      <ul>
        <li><strong>Same terminal-inspired design language</strong>, optimized for smaller screens</li>
        <li><strong>Touch-friendly interface</strong> with swipe gestures for buffer switching and panel navigation</li>
        <li><strong>Full feature parity</strong> with the desktop web UI — nothing left behind</li>
        <li><strong>All web-based</strong> — no native apps needed, works in any mobile browser</li>
      </ul>
    </div>
  </div>

  <div class="roadmap-phase phase-vision">
    <div class="phase-header">
      <span class="phase-label label-vision">Vision</span>
      <span class="phase-title">One IRC, Everywhere</span>
    </div>
    <div class="phase-body">
      <p class="vision-statement">
        One unified IRC experience across <strong>terminal</strong>, <strong>browser</strong>, and <strong>mobile browser</strong>.<br>
        All web-based. Switch devices without missing a message.
      </p>
    </div>
  </div>

</div>
