export type ImageProtocol = "kitty" | "iterm2" | "sixel" | "symbols"

export function isInsideTmux(): boolean {
  return !!process.env.TMUX
}

/** Get the tmux pane's absolute position on the outer terminal screen */
export function getTmuxPaneOffset(): { top: number; left: number } {
  try {
    const result = Bun.spawnSync(["tmux", "display-message", "-p", "#{pane_top}:#{pane_left}"])
    const output = new TextDecoder().decode(result.stdout).trim()
    const [top, left] = output.split(":").map(Number)
    if (!isNaN(top) && !isNaN(left)) return { top, left }
  } catch {}
  return { top: 0, left: 0 }
}

/** Match a terminal name to a protocol. Matches erssi's order from
 *  image-preview-chafa.c:107-142 — iterm FIRST, then kitty family,
 *  then sixel-capable terminals. */
function matchTermName(name: string): ImageProtocol | null {
  const t = name.toLowerCase()

  // iTerm2 (must be before kitty — iTerm2+tmux was misdetected)
  if (t.includes("iterm")) return "iterm2"

  // Kitty protocol family
  if (t.includes("kitty")) return "kitty"
  if (t.includes("ghostty")) return "kitty"
  if (t.includes("wezterm")) return "kitty"
  if (t.includes("rio")) return "kitty"

  // Sixel-capable terminals
  if (t.includes("foot")) return "sixel"
  if (t.includes("contour")) return "sixel"
  if (t.includes("konsole")) return "sixel"
  if (t.includes("mintty")) return "sixel"
  if (t.includes("mlterm")) return "sixel"
  if (t.includes("xterm")) return "sixel"

  return null
}

/** Detect the best image display protocol for the current terminal.
 *  In tmux: queries #{client_termname} first (like erssi).
 *  Outside tmux: checks env vars. */
export function detectProtocol(configOverride?: string): ImageProtocol {
  if (configOverride && configOverride !== "auto") {
    return configOverride as ImageProtocol
  }

  const inTmux = isInsideTmux()

  // ─── tmux: query the REAL outer terminal ───────────────────
  if (inTmux) {
    try {
      const result = Bun.spawnSync(["tmux", "display-message", "-p", "#{client_termname}"])
      const termName = new TextDecoder().decode(result.stdout).trim()
      if (termName) {
        const match = matchTermName(termName)
        if (match) return match
      }
    } catch {}
  }

  // ─── env var detection (non-tmux, or tmux query returned unknown) ──
  // Order matches erssi: check SPECIFIC identifiers first (TERM_PROGRAM, env vars),
  // then generic TERM last. This prevents iTerm2 (TERM=xterm-256color) from
  // being misdetected as sixel via the "xterm" match in matchTermName.
  const term = (process.env.TERM ?? "").toLowerCase()
  const termProgram = (process.env.TERM_PROGRAM ?? "").toLowerCase()
  const lcTerminal = (process.env.LC_TERMINAL ?? "").toLowerCase()

  // TERM_PROGRAM / LC_TERMINAL — most specific identifier, check FIRST
  if (termProgram === "iterm.app" || termProgram === "iterm2" || lcTerminal === "iterm2") {
    return "iterm2"
  }
  if (termProgram === "wezterm") return "kitty"
  if (termProgram === "rio") return "kitty"
  if (termProgram === "mintty") return "sixel"

  // Process-specific env vars
  if (process.env.KITTY_PID) return "kitty"
  if (process.env.GHOSTTY_RESOURCES_DIR) return "kitty"
  if (process.env.WT_SESSION) return "sixel"

  // Generic TERM value (xterm-kitty, xterm-ghostty, etc.) — LAST
  const termMatch = matchTermName(term)
  if (termMatch) return termMatch

  return "symbols"
}
