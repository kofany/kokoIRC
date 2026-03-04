import { createHash } from "crypto"
import { readdir, stat, unlink } from "node:fs/promises"
import { join, extname } from "node:path"
import { IMAGE_CACHE_DIR } from "@/core/constants"

// Magic bytes for common image formats
const MAGIC = {
  jpeg: [0xff, 0xd8, 0xff],
  png:  [0x89, 0x50, 0x4e, 0x47],
  gif:  [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46],  // RIFF header (check WEBP at offset 8)
} as const

/** Get the cache file path for a URL */
export function getCachePath(url: string, ext?: string): string {
  const hash = createHash("sha256").update(url).digest("hex")
  const suffix = ext || extname(new URL(url).pathname) || ".img"
  return join(IMAGE_CACHE_DIR, hash + suffix)
}

/** Check if a URL is already cached and valid. Returns path or null. */
export async function isCached(url: string): Promise<string | null> {
  // Try common extensions since we may not know the original
  const hash = createHash("sha256").update(url).digest("hex")
  const glob = new Bun.Glob(hash + ".*")

  for await (const file of glob.scan(IMAGE_CACHE_DIR)) {
    const path = join(IMAGE_CACHE_DIR, file)
    if (await validateImage(path)) return path
  }

  return null
}

/** Write image data to cache, return the path */
export async function writeCache(url: string, data: Buffer, ext?: string): Promise<string> {
  const path = getCachePath(url, ext)
  await Bun.write(path, data)
  return path
}

/** Validate an image file by checking magic bytes */
export async function validateImage(path: string): Promise<boolean> {
  const file = Bun.file(path)
  if (!(await file.exists())) return false

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (header.length < 3) return false

  // JPEG
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return true
  // PNG
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return true
  // GIF
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) return true
  // WEBP (RIFF....WEBP)
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
      header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) return true

  return false
}

/** Clean up old cache files based on size and age limits */
export async function cleanupCache(maxMb: number, maxDays: number): Promise<void> {
  const entries: Array<{ path: string; size: number; mtimeMs: number }> = []
  const maxAgeMs = maxDays * 24 * 60 * 60 * 1000
  const now = Date.now()

  let files: string[]
  try {
    files = await readdir(IMAGE_CACHE_DIR)
  } catch {
    return
  }

  for (const file of files) {
    const path = join(IMAGE_CACHE_DIR, file)
    try {
      const s = await stat(path)
      if (!s.isFile()) continue

      // Remove files older than maxDays
      if (now - s.mtimeMs > maxAgeMs) {
        await unlink(path)
        continue
      }

      entries.push({ path, size: s.size, mtimeMs: s.mtimeMs })
    } catch {
      // Skip files we can't stat
    }
  }

  // Sort oldest first, remove until under size limit
  entries.sort((a, b) => a.mtimeMs - b.mtimeMs)
  const maxBytes = maxMb * 1024 * 1024
  let totalSize = entries.reduce((sum, e) => sum + e.size, 0)

  for (const entry of entries) {
    if (totalSize <= maxBytes) break
    try {
      await unlink(entry.path)
      totalSize -= entry.size
    } catch {
      // Skip
    }
  }
}
