import type { StyledSpan } from "@/types/theme"

/**
 * Irssi-compatible color map.
 * Lowercase = normal, uppercase = bright.
 */
const COLOR_MAP: Record<string, string> = {
  k: "#000000", K: "#555555",
  r: "#aa0000", R: "#ff5555",
  g: "#00aa00", G: "#55ff55",
  y: "#aa5500", Y: "#ffff55",
  b: "#0000aa", B: "#5555ff",
  m: "#aa00aa", M: "#ff55ff",
  c: "#00aaaa", C: "#55ffff",
  w: "#aaaaaa", W: "#ffffff",
}

/**
 * Standard mIRC color palette (indices 0–98).
 * 0–15: classic 16-color set, 16–98: extended palette.
 */
const MIRC_COLORS: string[] = [
  "#ffffff", "#000000", "#00007f", "#009300", "#ff0000", "#7f0000", "#9c009c", "#fc7f00",
  "#ffff00", "#00fc00", "#009393", "#00ffff", "#0000fc", "#ff00ff", "#7f7f7f", "#d2d2d2",
  "#470000", "#472100", "#474700", "#324700", "#004700", "#00472c", "#004747", "#002747",
  "#000047", "#2e0047", "#470047", "#47002a", "#740000", "#743a00", "#747400", "#517400",
  "#007400", "#007449", "#007474", "#004074", "#000074", "#4b0074", "#740074", "#740045",
  "#b50000", "#b56300", "#b5b500", "#7db500", "#00b500", "#00b571", "#00b5b5", "#0063b5",
  "#0000b5", "#7500b5", "#b500b5", "#b5006b", "#ff0000", "#ff8c00", "#ffff00", "#b2ff00",
  "#00ff00", "#00ffa0", "#00ffff", "#008cff", "#0000ff", "#a500ff", "#ff00ff", "#ff0098",
  "#ff5959", "#ffb459", "#ffff71", "#cfff60", "#6fff6f", "#65ffc9", "#6dffff", "#59b4ff",
  "#5959ff", "#c459ff", "#ff66ff", "#ff59bc", "#ff9c9c", "#ffd39c", "#ffff9c", "#e2ff9c",
  "#9cff9c", "#9cffdb", "#9cffff", "#9cd3ff", "#9c9cff", "#dc9cff", "#ff9cff", "#ff94d3",
  "#000000", "#131313", "#282828", "#363636", "#4d4d4d", "#656565", "#818181", "#9f9f9f",
  "#bcbcbc", "#e2e2e2", "#ffffff",
]

const MAX_ABSTRACTION_DEPTH = 10

interface StyleState {
  fg?: string
  bg?: string
  bold: boolean
  italic: boolean
  underline: boolean
  dim: boolean
}

function defaultStyle(): StyleState {
  return { bold: false, italic: false, underline: false, dim: false }
}

function cloneStyle(s: StyleState): StyleState {
  return { ...s }
}

function styleToSpan(text: string, style: StyleState): StyledSpan {
  const span: StyledSpan = {
    text,
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
    dim: style.dim,
  }
  if (style.fg !== undefined) span.fg = style.fg
  if (style.bg !== undefined) span.bg = style.bg
  return span
}

/**
 * Substitute positional variables ($0, $1, $*, $[N]0, $[-N]0) in a string.
 */
function substituteVars(input: string, params: string[]): string {
  let result = ""
  let i = 0

  while (i < input.length) {
    if (input[i] === "$") {
      i++
      if (i >= input.length) {
        result += "$"
        break
      }

      // $* — all params joined with space
      if (input[i] === "*") {
        result += params.join(" ")
        i++
        continue
      }

      // $[N]D or $[-N]D — padded variable
      if (input[i] === "[") {
        i++ // skip [
        let numStr = ""
        while (i < input.length && input[i] !== "]") {
          numStr += input[i]
          i++
        }
        if (i < input.length) i++ // skip ]

        const padWidth = parseInt(numStr, 10)
        // Read the variable index digit(s)
        let idxStr = ""
        while (i < input.length && input[i] >= "0" && input[i] <= "9") {
          idxStr += input[i]
          i++
        }
        const idx = parseInt(idxStr, 10)
        const value = idx < params.length ? params[idx] : ""

        const absWidth = Math.abs(padWidth)
        if (padWidth < 0) {
          // left-pad
          result += value.padStart(absWidth, " ")
        } else {
          // right-pad
          result += value.padEnd(absWidth, " ")
        }
        continue
      }

      // $0, $1, ... $9 — positional variable (can be multi-digit)
      if (input[i] >= "0" && input[i] <= "9") {
        let idxStr = ""
        while (i < input.length && input[i] >= "0" && input[i] <= "9") {
          idxStr += input[i]
          i++
        }
        const idx = parseInt(idxStr, 10)
        result += idx < params.length ? params[idx] : ""
        continue
      }

      // Not a recognized variable — keep the $ and current char
      result += "$" + input[i]
      i++
    } else {
      result += input[i]
      i++
    }
  }

  return result
}

/**
 * Resolve `{name args...}` abstraction references.
 * Recursively expands up to MAX_ABSTRACTION_DEPTH.
 */
/**
 * Find the matching closing brace, respecting nested braces.
 */
function findMatchingBrace(input: string, openPos: number): number {
  let depth = 1
  let i = openPos + 1
  while (i < input.length && depth > 0) {
    if (input[i] === "{") depth++
    else if (input[i] === "}") depth--
    if (depth > 0) i++
  }
  return depth === 0 ? i : -1
}

/**
 * Split abstraction args respecting nested braces.
 * e.g., "$2 {pubnick $0}" → ["$2", "{pubnick $0}"]
 */
function splitAbstractionArgs(argsStr: string): string[] {
  const args: string[] = []
  let current = ""
  let depth = 0
  for (let i = 0; i < argsStr.length; i++) {
    if (argsStr[i] === "{") depth++
    else if (argsStr[i] === "}") depth--

    if (argsStr[i] === " " && depth === 0) {
      if (current.length > 0) args.push(current)
      current = ""
    } else {
      current += argsStr[i]
    }
  }
  if (current.length > 0) args.push(current)
  return args
}

export function resolveAbstractions(
  input: string,
  abstracts: Record<string, string>,
  depth: number = 0,
): string {
  if (depth >= MAX_ABSTRACTION_DEPTH) return input

  let result = ""
  let i = 0

  while (i < input.length) {
    if (input[i] === "{") {
      // Find matching closing brace (respecting nesting)
      const closeIdx = findMatchingBrace(input, i)
      if (closeIdx === -1) {
        result += input[i]
        i++
        continue
      }

      const inner = input.substring(i + 1, closeIdx)
      const spaceIdx = inner.indexOf(" ")

      let name: string
      let argsStr: string

      if (spaceIdx === -1) {
        name = inner
        argsStr = ""
      } else {
        name = inner.substring(0, spaceIdx)
        argsStr = inner.substring(spaceIdx + 1)
      }

      if (name in abstracts) {
        const template = abstracts[name]
        // Split args respecting nested braces
        const args = argsStr ? splitAbstractionArgs(argsStr) : []
        // First resolve nested abstractions in args
        const resolvedArgs = args.map(a => resolveAbstractions(a, abstracts, depth + 1))
        // Then substitute into template
        const expanded = substituteVars(template, resolvedArgs)
        // Recurse to handle any remaining abstractions
        result += resolveAbstractions(expanded, abstracts, depth + 1)
      } else {
        result += input.substring(i, closeIdx + 1)
      }

      i = closeIdx + 1
    } else {
      result += input[i]
      i++
    }
  }

  return result
}

/**
 * Parse an irssi-compatible format string into styled spans.
 *
 * Supports:
 * - %X color codes (irssi color map)
 * - %ZRRGGBB 24-bit hex colors
 * - %_ %u %i %d style toggles (bold, underline, italic, dim)
 * - %N/%n reset
 * - %| indent marker (skipped)
 * - $0 $1 $* $[N]0 $[-N]0 variable substitution
 */
export function parseFormatString(input: string, params: string[] = []): StyledSpan[] {
  // Step 1: Substitute variables
  const text = substituteVars(input, params)

  // Step 2: Walk char by char, parse color/style codes, build spans
  const spans: StyledSpan[] = []
  let current = defaultStyle()
  let buffer = ""
  let i = 0

  function flush() {
    if (buffer.length > 0) {
      spans.push(styleToSpan(buffer, current))
      buffer = ""
    }
  }

  while (i < text.length) {
    if (text[i] === "%") {
      i++
      if (i >= text.length) {
        buffer += "%"
        break
      }

      const code = text[i]

      // %N or %n — reset all
      if (code === "N" || code === "n") {
        flush()
        current = defaultStyle()
        i++
        continue
      }

      // %_ — toggle bold
      if (code === "_") {
        flush()
        current = cloneStyle(current)
        current.bold = !current.bold
        i++
        continue
      }

      // %u — toggle underline
      if (code === "u") {
        flush()
        current = cloneStyle(current)
        current.underline = !current.underline
        i++
        continue
      }

      // %i — toggle italic
      if (code === "i") {
        flush()
        current = cloneStyle(current)
        current.italic = !current.italic
        i++
        continue
      }

      // %d — toggle dim
      if (code === "d") {
        flush()
        current = cloneStyle(current)
        current.dim = !current.dim
        i++
        continue
      }

      // %Z — 24-bit hex color: %ZRRGGBB
      if (code === "Z") {
        flush()
        const hex = text.substring(i + 1, i + 7)
        current = cloneStyle(current)
        current.fg = "#" + hex
        i += 7
        continue
      }

      // %| — indent marker, skip
      if (code === "|") {
        i++
        continue
      }

      // Color code from color map
      if (code in COLOR_MAP) {
        flush()
        current = cloneStyle(current)
        current.fg = COLOR_MAP[code]
        i++
        continue
      }

      // %% — literal percent
      if (code === "%") {
        buffer += "%"
        i++
        continue
      }

      // Unknown code — keep as-is
      buffer += "%" + code
      i++
    } else {
      // ── mIRC control characters ──
      const ch = text.charCodeAt(i)

      // \x02 — bold toggle
      if (ch === 0x02) {
        flush()
        current = cloneStyle(current)
        current.bold = !current.bold
        i++
        continue
      }

      // \x03 — mIRC color: \x03[FG[,BG]]
      if (ch === 0x03) {
        flush()
        current = cloneStyle(current)
        i++

        // Read up to 2 digits for foreground
        let fgStr = ""
        if (i < text.length && text[i] >= "0" && text[i] <= "9") {
          fgStr += text[i]; i++
          if (i < text.length && text[i] >= "0" && text[i] <= "9") {
            fgStr += text[i]; i++
          }
        }

        // Read optional ,BG (only if comma is followed by a digit)
        let bgStr = ""
        if (fgStr && i < text.length && text[i] === "," &&
            i + 1 < text.length && text[i + 1] >= "0" && text[i + 1] <= "9") {
          i++ // skip comma
          bgStr += text[i]; i++
          if (i < text.length && text[i] >= "0" && text[i] <= "9") {
            bgStr += text[i]; i++
          }
        }

        if (!fgStr) {
          // \x03 alone = reset color
          current.fg = undefined
          current.bg = undefined
        } else {
          const fgNum = parseInt(fgStr, 10)
          if (fgNum >= 0 && fgNum < MIRC_COLORS.length) {
            current.fg = MIRC_COLORS[fgNum]
          }
          if (bgStr) {
            const bgNum = parseInt(bgStr, 10)
            if (bgNum >= 0 && bgNum < MIRC_COLORS.length) {
              current.bg = MIRC_COLORS[bgNum]
            }
          }
        }
        continue
      }

      // \x04 — hex color: \x04[RRGGBB[,RRGGBB]]
      if (ch === 0x04) {
        flush()
        current = cloneStyle(current)
        i++

        const fgHex = readHex6(text, i)
        if (fgHex) {
          current.fg = "#" + fgHex
          i += 6
          if (i < text.length && text[i] === ",") {
            const bgHex = readHex6(text, i + 1)
            if (bgHex) {
              current.bg = "#" + bgHex
              i += 7 // comma + 6 hex chars
            }
          }
        } else {
          // \x04 alone = reset color
          current.fg = undefined
          current.bg = undefined
        }
        continue
      }

      // \x0F — reset all formatting
      if (ch === 0x0F) {
        flush()
        current = defaultStyle()
        i++
        continue
      }

      // \x16 — reverse (swap fg/bg)
      if (ch === 0x16) {
        flush()
        current = cloneStyle(current)
        const tmp = current.fg
        current.fg = current.bg
        current.bg = tmp
        i++
        continue
      }

      // \x1D — italic toggle
      if (ch === 0x1D) {
        flush()
        current = cloneStyle(current)
        current.italic = !current.italic
        i++
        continue
      }

      // \x1E — strikethrough toggle (mapped to dim — terminals lack strikethrough)
      if (ch === 0x1E) {
        flush()
        current = cloneStyle(current)
        current.dim = !current.dim
        i++
        continue
      }

      // \x1F — underline toggle
      if (ch === 0x1F) {
        flush()
        current = cloneStyle(current)
        current.underline = !current.underline
        i++
        continue
      }

      // \x11 — monospace (no-op in terminal)
      if (ch === 0x11) {
        i++
        continue
      }

      buffer += text[i]
      i++
    }
  }

  flush()

  // If nothing was produced (empty input), return a single empty span
  if (spans.length === 0) {
    spans.push(styleToSpan("", defaultStyle()))
  }

  return spans
}

/** Read exactly 6 hex chars from position, or return null. */
function readHex6(text: string, pos: number): string | null {
  if (pos + 6 > text.length) return null
  const slice = text.substring(pos, pos + 6)
  return /^[0-9a-fA-F]{6}$/.test(slice) ? slice : null
}
