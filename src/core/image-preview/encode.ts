import { image2sixel } from "sixel"

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

/** Encode raw RGBA pixels as Kitty APC sequences (one per chunk, no DCS wrapping).
 *  Uses f=32 (raw RGBA) with s=W,v=H source dimensions — matches chafa's output
 *  format, which is more broadly compatible than f=100 (PNG). */
export function encodeKittyChunks(rgbaBuffer: Buffer, width: number, height: number, cols: number, rows: number): string[] {
  const b64 = rgbaBuffer.toString("base64")
  // Must fit inside tmux DCS passthrough buffer (4096 bytes for tmux < 3.4).
  // DCS overhead per chunk: ~22 bytes (continuation) to ~55 bytes (first).
  // 3800 + 55 = 3855, safely under 4096.
  const CHUNK_SIZE = 3800
  const parts: string[] = []

  for (let i = 0, idx = 0; i < b64.length; i += CHUNK_SIZE, idx++) {
    const chunk = b64.slice(i, i + CHUNK_SIZE)
    const isFirst = idx === 0
    const isLast = i + CHUNK_SIZE >= b64.length
    const m = isLast ? 0 : 1

    if (isFirst) {
      parts.push(`${ESC}_Ga=T,f=32,s=${width},v=${height},c=${cols},r=${rows},m=${m};${chunk}${ST}`)
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
  return `${ESC}]1337;File=inline=1;width=${cols};height=${rows};preserveAspectRatio=1:${b64}\x07`
}

// ─── Sixel Encoding ──────────────────────────────────────────

/** Encode raw RGBA pixels as a raw sixel sequence */
export function encodeSixel(rgbaBuffer: Buffer, width: number, height: number): string {
  // Create a clean Uint8ClampedArray from a copy — Buffer.buffer is the shared Node pool
  const copy = new Uint8ClampedArray(rgbaBuffer.length)
  copy.set(rgbaBuffer)
  return image2sixel(copy, width, height, 256)
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
