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

/** Match a terminal identifier string to a protocol.
 *  Works with both #{client_termtype} (e.g. "iTerm2 3.6.8", "ghostty 1.3.0")
 *  and #{client_termname} (e.g. "xterm-ghostty", "xterm-kitty").
 *  iterm FIRST, then kitty family, then sixel-capable terminals. */
function matchTermName(name: string): ImageProtocol | null {
  const t = name.toLowerCase()

  // iTerm2 — "iTerm2 3.6.8" from termtype, or "iterm2" from termname
  if (t.includes("iterm")) return "iterm2"

  // Kitty protocol family
  if (t.includes("kitty")) return "kitty"
  if (t.includes("ghostty")) return "kitty"
  if (t.includes("wezterm")) return "kitty"
  if (t.includes("rio")) return "kitty"
  // Subterm: "subterm x.x.x" from termtype, LC_TERMINAL=Subterm without tmux
  if (t.includes("subterm")) return "kitty"

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
 *  Returns [protocol, detectedName] — detectedName is the raw string that matched.
 *  In tmux: queries #{client_termtype} first (returns real terminal identity
 *  like "iTerm2 3.6.8", "ghostty 1.3.0"), then #{client_termname} as fallback.
 *  Outside tmux: checks env vars, then generic TERM. */
export function detectProtocol(configOverride?: string): [ImageProtocol, string] {
  if (configOverride && configOverride !== "auto") {
    return [configOverride as ImageProtocol, `config:${configOverride}`]
  }

  const inTmux = isInsideTmux()

  // ─── tmux: query the REAL outer terminal ───────────────────
  if (inTmux) {
    // #{client_termtype} returns the actual terminal identity
    // (e.g. "iTerm2 3.6.8", "ghostty 1.3.0-main+...", "subterm 1.0")
    // unlike #{client_termname} which returns generic "xterm-256color" for iTerm2
    try {
      const result = Bun.spawnSync(["tmux", "display-message", "-p", "#{client_termtype}"])
      const termType = new TextDecoder().decode(result.stdout).trim()
      if (termType) {
        const match = matchTermName(termType)
        if (match) return [match, termType]
      }
    } catch {}

    // Fallback: #{client_termname} (works for ghostty "xterm-ghostty", kitty "xterm-kitty")
    try {
      const result = Bun.spawnSync(["tmux", "display-message", "-p", "#{client_termname}"])
      const termName = new TextDecoder().decode(result.stdout).trim()
      if (termName) {
        const match = matchTermName(termName)
        if (match) return [match, termName]
      }
    } catch {}
  }

  // ─── env var detection (non-tmux, or tmux query returned unknown) ──
  const termProgram = (process.env.TERM_PROGRAM ?? "").toLowerCase()
  const lcTerminal = (process.env.LC_TERMINAL ?? "").toLowerCase()

  if (termProgram === "iterm.app" || termProgram === "iterm2" || lcTerminal === "iterm2") {
    return ["iterm2", `TERM_PROGRAM=${process.env.TERM_PROGRAM ?? lcTerminal}`]
  }
  if (lcTerminal === "subterm") return ["kitty", `LC_TERMINAL=${process.env.LC_TERMINAL}`]
  if (termProgram === "wezterm") return ["kitty", `TERM_PROGRAM=${process.env.TERM_PROGRAM}`]
  if (termProgram === "rio") return ["kitty", `TERM_PROGRAM=${process.env.TERM_PROGRAM}`]
  if (termProgram === "mintty") return ["sixel", `TERM_PROGRAM=${process.env.TERM_PROGRAM}`]
  if (process.env.KITTY_PID) return ["kitty", `KITTY_PID=${process.env.KITTY_PID}`]
  if (process.env.GHOSTTY_RESOURCES_DIR) return ["kitty", "GHOSTTY_RESOURCES_DIR"]
  if (process.env.WT_SESSION) return ["sixel", "WT_SESSION"]

  // Generic TERM value — last resort
  const term = (process.env.TERM ?? "").toLowerCase()
  const termMatch = matchTermName(term)
  if (termMatch) return [termMatch, `TERM=${process.env.TERM}`]

  return ["symbols", "unknown"]
}
