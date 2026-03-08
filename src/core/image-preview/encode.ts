import { encodeSixel as encodeSixelRaw } from "./sixel"

const ESC = "\x1b"
const ST = `${ESC}\\`

// ─── tmux DCS passthrough ────────────────────────────────────

/** Wrap an escape sequence in tmux DCS passthrough */
export function wrapTmuxDCS(sequence: string): string {
  // Escape all ESC bytes inside the payload
  const escaped = sequence.replace(/\x1b/g, "\x1b\x1b")
  return `${ESC}Ptmux;${escaped}${ST}`
}

// ─── Kitty Graphics Protocol ─────────────────────────────────
//
// Each chunk is a self-contained ESC_G...ESC\ sequence.
// First chunk carries metadata (a=T,f=,s=,v=,c=,r=) + payload.
// Continuation chunks carry m=1 + payload. Last chunk has m=0.
//
// q=2 suppresses terminal responses (prevents PTY echo issues).
// Each chunk MUST be written to stdout as a separate writeSync call
// (see render.ts) — subterm's async write pipeline can race when
// processing many sequences delivered in a single large buffer.

export type KittyFormat = "rgba" | "png"

/** Encode RGBA pixels as Kitty APC sequences using f=32 (raw RGBA). */
export function encodeKittyRGBA(rgbaBuffer: Buffer, width: number, height: number, cols: number, rows: number): string[] {
  return encodeKittyChunked(rgbaBuffer.toString("base64"), `a=T,q=2,f=32,s=${width},v=${height},c=${cols},r=${rows}`)
}

/** Encode a PNG buffer as Kitty APC sequences using f=100 (PNG). */
export function encodeKittyPNG(pngBuffer: Buffer, cols: number, rows: number): string[] {
  return encodeKittyChunked(pngBuffer.toString("base64"), `a=T,q=2,f=100,c=${cols},r=${rows}`)
}

/** Split base64 into Kitty APC chunks. First chunk includes metadata. */
function encodeKittyChunked(b64: string, firstChunkParams: string): string[] {
  // tmux DCS passthrough buffer is 4096 bytes (tmux < 3.4).
  // First chunk overhead: ~80 bytes params + 11 bytes framing = ~91.
  // Continuation overhead: ~11 bytes. DCS wrap adds ~22.
  // 3800 + 91 + 22 = 3913, safely under 4096.
  const CHUNK_SIZE = 3800
  const parts: string[] = []

  for (let i = 0, idx = 0; i < b64.length; i += CHUNK_SIZE, idx++) {
    const chunk = b64.slice(i, i + CHUNK_SIZE)
    const isFirst = idx === 0
    const isLast = i + CHUNK_SIZE >= b64.length
    const m = isLast ? 0 : 1

    if (isFirst) {
      parts.push(`${ESC}_G${firstChunkParams},m=${m};${chunk}${ST}`)
    } else {
      parts.push(`${ESC}_Gm=${m};${chunk}${ST}`)
    }
  }

  return parts
}

// ─── iTerm2 Inline Image Protocol ────────────────────────────

/** Encode an image buffer as a raw iTerm2 inline image sequence */
export function encodeIterm2(imageBuffer: Buffer, cols: number, rows: number): string {
  const b64 = imageBuffer.toString("base64")
  // preserveAspectRatio=0: we already calculated correct dimensions in render.ts,
  // so let iTerm2 stretch to fill the cell area. Using 1 causes double-correction.
  return `${ESC}]1337;File=inline=1;width=${cols};height=${rows};preserveAspectRatio=0:${b64}\x07`
}

// ─── Sixel Encoding ──────────────────────────────────────────

/** Encode raw RGBA pixels as a raw sixel sequence */
export function encodeSixel(rgbaBuffer: Buffer, width: number, height: number): string {
  return encodeSixelRaw(new Uint8Array(rgbaBuffer), width, height)
}

// ─── Unicode Half-Block Fallback ─────────────────────────────

/** Encode RGBA pixels as Unicode half-block characters with 24-bit ANSI color */
export function encodeSymbols(rgbaBuffer: Buffer, width: number, height: number): string {
  const lines: string[] = []

  for (let y = 0; y < height; y += 2) {
    let line = ""
    for (let x = 0; x < width; x++) {
      // Top pixel
      const topIdx = (y * width + x) * 4
      const tr = rgbaBuffer[topIdx]
      const tg = rgbaBuffer[topIdx + 1]
      const tb = rgbaBuffer[topIdx + 2]

      // Bottom pixel (may be beyond height)
      if (y + 1 < height) {
        const botIdx = ((y + 1) * width + x) * 4
        const br = rgbaBuffer[botIdx]
        const bg = rgbaBuffer[botIdx + 1]
        const bb = rgbaBuffer[botIdx + 2]
        // ▀ = upper half block: fg=top, bg=bottom
        line += `${ESC}[38;2;${tr};${tg};${tb}m${ESC}[48;2;${br};${bg};${bb}m▀`
      } else {
        // Last odd row: only top pixel
        line += `${ESC}[38;2;${tr};${tg};${tb}m▀`
      }
    }
    line += `${ESC}[0m`
    lines.push(line)
  }

  return lines.join("\n")
}
