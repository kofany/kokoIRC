import sharp from "sharp"
import { writeSync } from "node:fs"
import { useStore } from "@/core/state/store"
import { getRenderer } from "@/core/renderer-ref"
import { detectProtocol, isInsideTmux } from "./detect"
import { isCached, writeCache } from "./cache"
import { classifyUrl, fetchImage } from "./fetch"
import { encodeKittyRGBA, encodeKittyPNG, encodeIterm2, encodeSixel, encodeSymbols, wrapTmuxDCS, type KittyFormat } from "./encode"

/** Main pipeline: fetch → cache → encode → write to stdout directly */
export async function preparePreview(url: string): Promise<void> {
  const store = useStore.getState()
  const config = store.config?.image_preview

  if (!config?.enabled) {
    store.updateImagePreview({ status: "error", error: "Image preview disabled" })
    return
  }

  try {
    // 1. Classify URL
    const urlType = classifyUrl(url)
    if (!urlType) {
      store.updateImagePreview({ status: "error", error: "Not an image URL" })
      return
    }

    // 2. Check cache
    let imagePath = await isCached(url)

    // 3. Fetch if not cached
    if (!imagePath) {
      const { data, ext } = await fetchImage(url, config)
      imagePath = await writeCache(url, data, ext)
    }

    // Bail if preview was dismissed while we were fetching
    if (!useStore.getState().imagePreview) return

    // 4. Load with sharp and get metadata
    const metadata = await sharp(imagePath).metadata()
    const imgWidth = metadata.width ?? 0
    const imgHeight = metadata.height ?? 0

    if (imgWidth === 0 || imgHeight === 0) {
      store.updateImagePreview({ status: "error", error: "Invalid image dimensions" })
      return
    }

    // 5. Detect protocol
    const [protocol] = detectProtocol(config.protocol)
    const inTmux = isInsideTmux()
    // Always use PNG for kitty protocol. Raw RGBA (f=32) produces hundreds of
    // chunks — causes chunk misalignment in terminals with async parsers, and
    // hundreds of writeSync calls trigger malloc double-free in Bun. PNG
    // compresses to ~20-35 chunks, terminals decode natively — more robust.
    const kittyFmt: KittyFormat = (protocol === "kitty") ? "png" : (config.kitty_format ?? "rgba") as KittyFormat

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
      const estimatedBytes = pixelWidth * pixelHeight * 4 * 1.4
      if (estimatedBytes > MAX_BYTES) {
        const scale = Math.sqrt(MAX_BYTES / estimatedBytes)
        pixelWidth = Math.floor(pixelWidth * scale)
        pixelHeight = Math.floor(pixelHeight * scale)
        displayCols = Math.max(1, Math.round(pixelWidth / 8))
        displayRows = Math.max(1, Math.round(pixelHeight / 16))
      }
    }

    // 7. Encode based on protocol — returns raw sequences (no DCS wrapping)
    let rawChunks: string[]

    if (protocol === "kitty") {
      if (kittyFmt === "png") {
        const pngBuf = await sharp(imagePath)
          .resize(pixelWidth, pixelHeight, { fit: "inside" })
          .png()
          .toBuffer()
        rawChunks = encodeKittyPNG(pngBuf, displayCols, displayRows)
      } else {
        const { data, info } = await sharp(imagePath)
          .resize(pixelWidth, pixelHeight, { fit: "inside" })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        const rgbaCopy = Buffer.from(data)
        rawChunks = encodeKittyRGBA(rgbaCopy, info.width, info.height, displayCols, displayRows)
      }
    } else if (protocol === "iterm2") {
      const resized = await sharp(imagePath)
        .resize(pixelWidth, pixelHeight, { fit: "inside" })
        .png()
        .toBuffer()
      rawChunks = [encodeIterm2(resized, displayCols, displayRows)]
    } else if (protocol === "sixel") {
      const { data, info } = await sharp(imagePath)
        .resize(pixelWidth, pixelHeight, { fit: "inside" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const rgbaCopy = Buffer.from(data)
      rawChunks = [encodeSixel(rgbaCopy, info.width, info.height)]
    } else {
      const { data, info } = await sharp(imagePath)
        .resize(displayCols, displayRows * 2, { fit: "inside" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const rgbaCopy = Buffer.from(data)
      rawChunks = [encodeSymbols(rgbaCopy, info.width, info.height)]
    }

    // Pre-build the output buffer outside the write callback to reduce
    // allocation pressure during the critical stdin-suspended window.
    let outputBuf: Buffer
    if (inTmux && protocol !== "symbols") {
      outputBuf = Buffer.from(rawChunks.map(c => wrapTmuxDCS(c)).join(""))
    } else {
      outputBuf = Buffer.from(rawChunks.join(""))
    }

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

    // 9. Write image directly to stdout, bypassing React/OpenTUI.
    //    Use setTimeout to let the overlay box render first.
    setTimeout(() => {
      if (!useStore.getState().imagePreview) return

      const renderer = getRenderer()
      const popupWidth = displayCols + 2
      const popupHeight = displayRows + 2
      const left = Math.max(0, Math.floor((termCols - popupWidth) / 2))
      const top = Math.max(0, Math.floor((termRows - popupHeight) / 2))
      const interiorRow = top + 2
      const interiorCol = left + 1

      // Use OpenTUI's suspend/resume instead of manual stdin pause/resume.
      // suspend() properly: removes stdin data listener, disables mouse,
      // clears stdin buffer, sets raw mode false, pauses stdin.
      // resume() properly: drains accumulated stdin data via setImmediate
      // before re-attaching listener — prevents the burst that triggers
      // Bun's malloc double-free.
      renderer?.suspend()

      try {
        writeSync(1, `\x1b7\x1b[${interiorRow};${interiorCol}H`)
        writeSync(1, outputBuf)
        writeSync(1, "\x1b8")
      } catch {
        // Write failed — resume will still restore terminal state
      } finally {
        renderer?.resume()
      }
    }, 50)
  } catch (err: any) {
    store.updateImagePreview({
      status: "error",
      error: err.message ?? "Unknown error",
    })
  }
}
