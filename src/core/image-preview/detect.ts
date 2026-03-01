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

/** Detect the best image display protocol for the current terminal */
export function detectProtocol(configOverride?: string): ImageProtocol {
  if (configOverride && configOverride !== "auto") {
    return configOverride as ImageProtocol
  }

  const inTmux = isInsideTmux()
  let termName = ""

  if (inTmux) {
    // Ask tmux for the real outer terminal
    try {
      const result = Bun.spawnSync(["tmux", "display-message", "-p", "#{client_termname}"])
      termName = new TextDecoder().decode(result.stdout).trim().toLowerCase()
    } catch {
      // Fallback if tmux query fails
    }
  }

  if (!termName) {
    termName = (process.env.TERM ?? "").toLowerCase()
  }

  const termProgram = (process.env.TERM_PROGRAM ?? "").toLowerCase()

  // Kitty protocol family
  if (
    termName.includes("kitty") || termName.includes("xterm-kitty") ||
    process.env.KITTY_PID ||
    termName.includes("ghostty") || termName.includes("xterm-ghostty") ||
    process.env.GHOSTTY_RESOURCES_DIR ||
    termProgram === "wezterm" ||
    termProgram === "rio"
  ) {
    return "kitty"
  }

  // iTerm2 protocol
  if (
    termProgram === "iterm.app" || termProgram === "iterm2" ||
    (process.env.LC_TERMINAL ?? "").toLowerCase() === "iterm2"
  ) {
    return "iterm2"
  }

  // Sixel-capable terminals
  if (
    termName.includes("foot") ||
    termName.includes("contour") ||
    termName.includes("mlterm")
  ) {
    return "sixel"
  }

  return "symbols"
}
