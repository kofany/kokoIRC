/** Pure TypeScript sixel encoder — no native dependencies.
 *  Converts RGBA pixel data to sixel format for terminal display.
 *
 *  Sixel format: each "band" is 6 rows of pixels. For each color in the palette,
 *  we scan across the band outputting characters whose 6-bit value (+ 63) indicates
 *  which of the 6 rows contain that color at that x position. */

// ─── Color Quantization (Median Cut) ─────────────────────────────────────

interface ColorBox {
  pixels: Uint32Array
  rMin: number; rMax: number
  gMin: number; gMax: number
  bMin: number; bMax: number
}

function buildBox(pixels: Uint32Array): ColorBox {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0
  for (let i = 0; i < pixels.length; i++) {
    const c = pixels[i]
    const r = c & 0xFF
    const g = (c >> 8) & 0xFF
    const b = (c >> 16) & 0xFF
    if (r < rMin) rMin = r; if (r > rMax) rMax = r
    if (g < gMin) gMin = g; if (g > gMax) gMax = g
    if (b < bMin) bMin = b; if (b > bMax) bMax = b
  }
  return { pixels, rMin, rMax, gMin, gMax, bMin, bMax }
}

function medianCut(rgba: Uint8Array, width: number, height: number, maxColors: number): { palette: number[][]; indexed: Uint8Array } {
  // Pack pixels into uint32 (ignore alpha)
  const count = width * height
  const packed = new Uint32Array(count)
  for (let i = 0; i < count; i++) {
    const off = i * 4
    packed[i] = rgba[off] | (rgba[off + 1] << 8) | (rgba[off + 2] << 16)
  }

  // Build initial box and split
  const boxes: ColorBox[] = [buildBox(packed)]

  while (boxes.length < maxColors) {
    // Find box with largest range
    let bestIdx = 0
    let bestRange = 0
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]
      if (b.pixels.length < 2) continue
      const range = Math.max(b.rMax - b.rMin, b.gMax - b.gMin, b.bMax - b.bMin)
      if (range > bestRange) { bestRange = range; bestIdx = i }
    }

    if (bestRange === 0) break

    const box = boxes[bestIdx]
    const rRange = box.rMax - box.rMin
    const gRange = box.gMax - box.gMin
    const bRange = box.bMax - box.bMin

    // Sort along the longest axis
    let channel: number
    if (rRange >= gRange && rRange >= bRange) channel = 0
    else if (gRange >= bRange) channel = 8
    else channel = 16

    const sorted = box.pixels.slice().sort((a, b) =>
      ((a >> channel) & 0xFF) - ((b >> channel) & 0xFF)
    )

    const mid = sorted.length >> 1
    boxes.splice(bestIdx, 1,
      buildBox(sorted.slice(0, mid)),
      buildBox(sorted.slice(mid))
    )
  }

  // Build palette from box averages
  const palette: number[][] = []
  for (const box of boxes) {
    let rSum = 0, gSum = 0, bSum = 0
    for (let i = 0; i < box.pixels.length; i++) {
      const c = box.pixels[i]
      rSum += c & 0xFF
      gSum += (c >> 8) & 0xFF
      bSum += (c >> 16) & 0xFF
    }
    const n = box.pixels.length || 1
    palette.push([Math.round(rSum / n), Math.round(gSum / n), Math.round(bSum / n)])
  }

  // Map each pixel to nearest palette entry
  const indexed = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    const off = i * 4
    const r = rgba[off], g = rgba[off + 1], b = rgba[off + 2]
    let bestDist = Infinity
    let bestColor = 0
    for (let c = 0; c < palette.length; c++) {
      const dr = r - palette[c][0]
      const dg = g - palette[c][1]
      const db = b - palette[c][2]
      const dist = dr * dr + dg * dg + db * db
      if (dist < bestDist) { bestDist = dist; bestColor = c }
    }
    indexed[i] = bestColor
  }

  return { palette, indexed }
}

// ─── Sixel Encoding ──────────────────────────────────────────────────────

/** Encode RGBA pixel data as a sixel string.
 *  @param rgba  Raw RGBA pixel buffer
 *  @param width  Image width in pixels
 *  @param height Image height in pixels
 *  @param maxColors Max palette size (default 256, sixel max) */
export function encodeSixel(rgba: Uint8Array, width: number, height: number, maxColors = 256): string {
  const { palette, indexed } = medianCut(rgba, width, height, Math.min(maxColors, 256))

  const parts: string[] = []

  // DCS q — sixel header. P2=1 means background stays transparent.
  // "0;0;0" = aspect ratio params (let terminal decide)
  parts.push("\x1bPq")

  // Palette definitions: #N;2;R;G;B (percentages 0-100)
  for (let i = 0; i < palette.length; i++) {
    const [r, g, b] = palette[i]
    parts.push(`#${i};2;${Math.round(r * 100 / 255)};${Math.round(g * 100 / 255)};${Math.round(b * 100 / 255)}`)
  }

  // Encode bands of 6 rows
  const bandCount = Math.ceil(height / 6)

  for (let band = 0; band < bandCount; band++) {
    const y0 = band * 6

    for (let color = 0; color < palette.length; color++) {
      // Build sixel line for this color in this band
      let hasPixel = false
      const chars: number[] = new Array(width)

      for (let x = 0; x < width; x++) {
        let bits = 0
        for (let row = 0; row < 6; row++) {
          const y = y0 + row
          if (y >= height) break
          if (indexed[y * width + x] === color) {
            bits |= (1 << row)
          }
        }
        chars[x] = bits
        if (bits !== 0) hasPixel = true
      }

      if (!hasPixel) continue

      // Select this color
      parts.push(`#${color}`)

      // Emit with run-length encoding
      let i = 0
      while (i < width) {
        const ch = chars[i]
        let run = 1
        while (i + run < width && chars[i + run] === ch) run++

        const sixelChar = String.fromCharCode(ch + 63)
        if (run >= 4) {
          parts.push(`!${run}${sixelChar}`)
        } else {
          for (let r = 0; r < run; r++) parts.push(sixelChar)
        }
        i += run
      }

      // Carriage return (back to column 0, same band)
      parts.push("$")
    }

    // Next band (move down 6 rows)
    if (band < bandCount - 1) {
      parts.push("-")
    }
  }

  // ST — string terminator
  parts.push("\x1b\\")

  return parts.join("")
}
