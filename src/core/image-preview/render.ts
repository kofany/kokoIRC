import sharp from "sharp"
import { writeSync } from "node:fs"
import { useStore } from "@/core/state/store"
import { detectProtocol, isInsideTmux } from "./detect"
import { isCached, writeCache } from "./cache"
import { classifyUrl, fetchImage } from "./fetch"
import { encodeKittyRGBA, encodeKittyPNG, encodeIterm2, encodeSixel, encodeSymbols, wrapTmuxDCS, type KittyFormat } from "./encode"

// Mouse tracking escape sequences — disable during image write to prevent
// accumulated stdin mouse events from crashing Bun's event loop (malloc double-free).
const MOUSE_DISABLE = "\x1b[?1003l\x1b[?1006l\x1b[?1002l\x1b[?1000l"
const MOUSE_ENABLE  = "\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1006h"

/** Log debug info to the active buffer */
function dbg(msg: string) {
  const s = useStore.getState()
  const buf = s.activeBufferId
  if (!buf) return
  s.addMessage(buf, {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    type: "event",
    text: `%Z565f89[img] ${msg}%N`,
    highlight: false,
  })
}

/** Main pipeline: fetch → cache → encode → write to stdout directly */
export async function preparePreview(url: string): Promise<void> {
  const store = useStore.getState()
  const config = store.config?.image_preview

  dbg(`start: ${url}`)

  if (!config?.enabled) {
    dbg("aborted: image preview disabled in config")
    store.updateImagePreview({ status: "error", error: "Image preview disabled" })
    return
  }

  try {
    // 1. Classify URL
    const urlType = classifyUrl(url)
    dbg(`classify: ${urlType ?? "null (not a valid URL)"}`)
    if (!urlType) {
      store.updateImagePreview({ status: "error", error: "Not an image URL" })
      return
    }

    // 2. Check cache
    let imagePath = await isCached(url)
    dbg(imagePath ? `cache hit: ${imagePath}` : "cache miss, fetching...")

    // 3. Fetch if not cached
    if (!imagePath) {
      const { data, ext } = await fetchImage(url, config)
      dbg(`fetched: ${data.length} bytes, ext=${ext}`)
      imagePath = await writeCache(url, data, ext)
      dbg(`cached: ${imagePath}`)
    }

    // Bail if preview was dismissed while we were fetching
    if (!useStore.getState().imagePreview) return

    // 4. Load with sharp and get metadata
    const metadata = await sharp(imagePath).metadata()
    const imgWidth = metadata.width ?? 0
    const imgHeight = metadata.height ?? 0
    dbg(`sharp: ${imgWidth}x${imgHeight} ${metadata.format}`)

    if (imgWidth === 0 || imgHeight === 0) {
      store.updateImagePreview({ status: "error", error: "Invalid image dimensions" })
      return
    }

    // 5. Detect protocol
    const protocol = detectProtocol(config.protocol)
    const inTmux = isInsideTmux()
    const kittyFmt = (config.kitty_format ?? "rgba") as KittyFormat
    dbg(`protocol: ${protocol}${inTmux ? " (tmux)" : ""} [config=${config.protocol}, kitty_fmt=${kittyFmt}]`)

    // 6. Calculate display dimensions — match erssi's approach:
    //    max = 75% of terminal, aspect ratio with cellAspect=2, cell geometry 8×16
    const termCols = process.stdout.columns || 80
    const termRows = process.stdout.rows || 24

    const maxCols = config.max_width || Math.floor(termCols * 0.75)
    const maxRows = config.max_height || Math.floor(termRows * 0.75)

    const innerCols = maxCols - 2
    const innerRows = maxRows - 2

    const cellAspect = 2
    const imgAspect = imgWidth / imgHeight

    let displayCols: number
    let displayRows: number

    if (imgAspect * cellAspect > innerCols / innerRows) {
      displayCols = innerCols
      displayRows = Math.max(1, Math.round(innerCols / (imgAspect * cellAspect)))
    } else {
      displayRows = innerRows
      displayCols = Math.max(1, Math.round(innerRows * imgAspect * cellAspect))
    }

    let pixelWidth = protocol === "symbols" ? displayCols : displayCols * 8
    let pixelHeight = protocol === "symbols" ? displayRows * 2 : displayRows * 16

    // Byte limit like erssi (IMAGE_PREVIEW_MAX_BYTES = 2MB).
    // Only applies to raw RGBA (f=32) — PNG is already compressed and much smaller.
    if (protocol !== "symbols" && !(protocol === "kitty" && kittyFmt === "png")) {
      const MAX_BYTES = 2_000_000
      // Raw RGBA = W*H*4, base64 overhead = *1.37, DCS overhead = *1.05
      const estimatedBytes = pixelWidth * pixelHeight * 4 * 1.4
      if (estimatedBytes > MAX_BYTES) {
        const scale = Math.sqrt(MAX_BYTES / estimatedBytes)
        pixelWidth = Math.floor(pixelWidth * scale)
        pixelHeight = Math.floor(pixelHeight * scale)
        // Recalculate display cells to match
        displayCols = Math.max(1, Math.round(pixelWidth / 8))
        displayRows = Math.max(1, Math.round(pixelHeight / 16))
        dbg(`byte limit: scaled to ${pixelWidth}x${pixelHeight} px (${displayCols}x${displayRows} cells)`)
      }
    }

    dbg(`display: ${displayCols}x${displayRows} cells, ${pixelWidth}x${pixelHeight} px, term=${termCols}x${termRows}`)

    // 7. Encode based on protocol — returns raw sequences (no DCS wrapping)
    let rawChunks: string[]

    if (protocol === "kitty") {
      if (kittyFmt === "png") {
        // PNG (f=100) — terminal decodes natively, more robust at chunk boundaries
        const pngBuf = await sharp(imagePath)
          .resize(pixelWidth, pixelHeight, { fit: "inside" })
          .png()
          .toBuffer()
        dbg(`kitty: PNG ${pngBuf.length} bytes, fmt=png`)
        rawChunks = encodeKittyPNG(pngBuf, displayCols, displayRows)
      } else {
        // Raw RGBA (f=32) — direct pixel data, matches erssi/chafa output
        const { data, info } = await sharp(imagePath)
          .resize(pixelWidth, pixelHeight, { fit: "inside" })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        const rgbaCopy = Buffer.from(data)
        dbg(`kitty: RGBA ${info.width}x${info.height}, ${rgbaCopy.length} bytes, fmt=rgba`)
        rawChunks = encodeKittyRGBA(rgbaCopy, info.width, info.height, displayCols, displayRows)
      }
    } else if (protocol === "iterm2") {
      const resized = await sharp(imagePath)
        .resize(pixelWidth, pixelHeight, { fit: "inside" })
        .png()
        .toBuffer()
      dbg(`iterm2: resized PNG ${resized.length} bytes`)
      rawChunks = [encodeIterm2(resized, displayCols, displayRows)]
    } else if (protocol === "sixel") {
      const { data, info } = await sharp(imagePath)
        .resize(pixelWidth, pixelHeight, { fit: "inside" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const rgbaCopy = Buffer.from(data)
      dbg(`sixel: RGBA ${info.width}x${info.height}, ${rgbaCopy.length} bytes`)
      rawChunks = [encodeSixel(rgbaCopy, info.width, info.height)]
    } else {
      const { data, info } = await sharp(imagePath)
        .resize(displayCols, displayRows * 2, { fit: "inside" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const rgbaCopy = Buffer.from(data)
      dbg(`symbols: RGBA ${info.width}x${info.height}, ${rgbaCopy.length} bytes`)
      rawChunks = [encodeSymbols(rgbaCopy, info.width, info.height)]
    }

    dbg(`encoded: ${rawChunks.length} chunks`)

    // Bail if preview was dismissed while we were encoding
    if (!useStore.getState().imagePreview) return

    const title = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? url).slice(0, 40)

    // 8. Update store with dimensions (NO encoded data — it stays out of React)
    store.updateImagePreview({
      status: "ready",
      width: displayCols + 2,
      height: displayRows + 2,
      title,
      protocol,
    })

    // 9. Write image directly to stdout, bypassing React/OpenTUI
    //    Use setTimeout to let the overlay box render first
    setTimeout(() => {
      if (!useStore.getState().imagePreview) return

      const popupWidth = displayCols + 2
      const popupHeight = displayRows + 2
      const left = Math.max(0, Math.floor((termCols - popupWidth) / 2))
      const top = Math.max(0, Math.floor((termRows - popupHeight) / 2))

      // Interior position: skip border + title row
      const interiorRow = top + 2
      const interiorCol = left + 1

      try {
        // Disable mouse tracking BEFORE writing image data.
        // While writeSync blocks Bun's event loop, the terminal still sends mouse
        // events through stdin. These accumulate in kernel buffers and when the event
        // loop resumes, Bun's internal buffer handling can trigger a malloc double-free.
        writeSync(1, MOUSE_DISABLE)

        // Write EACH chunk as a separate writeSync call.
        // Subterm's terminal.write() is async-without-await, so a single giant
        // write delivered via PTY can be split by the OS into multiple read events.
        // If two read events hit processData() concurrently, the parser's
        // pendingData state can race and sequences get lost (base64 leak).
        // Per-chunk writes keep each PTY read small enough to be processed atomically.
        writeSync(1, `\x1b7\x1b[${interiorRow};${interiorCol}H`)
        for (const chunk of rawChunks) {
          if (inTmux && protocol !== "symbols") {
            writeSync(1, Buffer.from(wrapTmuxDCS(chunk)))
          } else {
            writeSync(1, Buffer.from(chunk))
          }
        }
        writeSync(1, "\x1b8")

        // Re-enable mouse tracking
        writeSync(1, MOUSE_ENABLE)
      } catch (e: any) {
        // Always try to re-enable mouse tracking even on error
        try { writeSync(1, MOUSE_ENABLE) } catch {}
        dbg(`%Zf7768ewrite failed: ${e.message}%N`)
      }
    }, 50)

    dbg(`done: popup ${displayCols + 2}x${displayRows + 2}, title="${title}"`)
  } catch (err: any) {
    dbg(`%Zf7768eERROR: ${err.message}%N`)
    if (err.stack) {
      const firstFrame = err.stack.split("\n")[1]?.trim()
      if (firstFrame) dbg(`%Zf7768e  at ${firstFrame}%N`)
    }
    store.updateImagePreview({
      status: "error",
      error: err.message ?? "Unknown error",
    })
  }
}
