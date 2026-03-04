import type { ImagePreviewConfig } from "@/types/config"

export type UrlType = "direct_image" | "page_imgur" | "page_imgbb" | "page_generic"

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i
const DIRECT_HOST_RE = /^i\.(imgur\.com|ibb\.co)$/i
const IMGUR_PAGE_RE = /^(www\.)?imgur\.com\//i
const IMGBB_PAGE_RE = /^(www\.)?ibb\.co\//i

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Classify a URL — returns null only for non-HTTP URLs */
export function classifyUrl(url: string): UrlType | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null

  // Direct image by extension
  if (IMAGE_EXT_RE.test(parsed.pathname)) return "direct_image"

  // Direct image hosts (i.imgur.com, i.ibb.co)
  if (DIRECT_HOST_RE.test(parsed.host)) return "direct_image"

  // Known image page hosts
  if (IMGUR_PAGE_RE.test(parsed.host + parsed.pathname)) return "page_imgur"
  if (IMGBB_PAGE_RE.test(parsed.host + parsed.pathname)) return "page_imgbb"

  // Any other HTTP URL — try as generic page (will check content-type)
  return "page_generic"
}

/** Quick check: is this URL likely an image we should try to preview?
 *  Used by click handler to avoid previewing every random link. */
export function isLikelyImageUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false

  // Direct image by extension
  if (IMAGE_EXT_RE.test(parsed.pathname)) return true

  // Known image hosts
  if (DIRECT_HOST_RE.test(parsed.host)) return true
  if (IMGUR_PAGE_RE.test(parsed.host + parsed.pathname)) return true
  if (IMGBB_PAGE_RE.test(parsed.host + parsed.pathname)) return true

  return false
}

/** Extract og:image URL from HTML string */
function extractOgImage(html: string): string | null {
  const match = html.match(
    /<meta\s+(?:property="og:image"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:image")/i
  )
  return match?.[1] ?? match?.[2] ?? null
}

/** Get file extension from Content-Type header */
function extFromContentType(ct: string | null): string {
  if (!ct) return ".img"
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("png")) return ".png"
  if (ct.includes("gif")) return ".gif"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("bmp")) return ".bmp"
  return ".img"
}

/** Check if a content-type header indicates an image */
function isImageContentType(ct: string | null): boolean {
  if (!ct) return false
  return ct.startsWith("image/")
}

/** Fetch a URL body with size limits, return raw Buffer + content-type */
async function fetchUrl(
  url: string,
  config: ImagePreviewConfig,
  maxSize?: number
): Promise<{ data: Buffer; contentType: string | null }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.fetch_timeout * 1000)

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    })

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    const limit = maxSize ?? config.max_file_size
    const contentLength = parseInt(resp.headers.get("content-length") ?? "0", 10)
    if (contentLength > limit) {
      throw new Error(`Too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB`)
    }

    const reader = resp.body?.getReader()
    if (!reader) throw new Error("No response body")

    const chunks: Uint8Array[] = []
    let totalSize = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      totalSize += value.length
      if (totalSize > limit) {
        reader.cancel()
        throw new Error(`Too large: exceeded ${(limit / 1024 / 1024).toFixed(0)}MB limit`)
      }
    }

    return { data: Buffer.concat(chunks), contentType: resp.headers.get("content-type") }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch an image from a URL using erssi-style two-phase detection:
 * 1. Fetch the URL directly
 * 2. If content-type is image/* → done, return the image data
 * 3. If content-type is text/html → extract og:image, fetch that instead
 */
export async function fetchImage(
  url: string,
  config: ImagePreviewConfig
): Promise<{ data: Buffer; ext: string }> {
  // Phase 1: Fetch the URL
  const result = await fetchUrl(url, config)

  // If it's already an image, return directly
  if (isImageContentType(result.contentType)) {
    return { data: result.data, ext: extFromContentType(result.contentType) }
  }

  // Phase 2: If HTML, look for og:image
  if (result.contentType?.includes("text/html")) {
    const html = new TextDecoder().decode(result.data)
    const ogImage = extractOgImage(html)

    if (!ogImage) throw new Error("Page has no og:image")

    // Resolve relative og:image URLs
    let imageUrl: string
    try {
      imageUrl = new URL(ogImage, url).href
    } catch {
      imageUrl = ogImage
    }

    // Fetch the actual image
    const imgResult = await fetchUrl(imageUrl, config)
    if (!isImageContentType(imgResult.contentType)) {
      throw new Error(`og:image URL returned ${imgResult.contentType}, not an image`)
    }
    return { data: imgResult.data, ext: extFromContentType(imgResult.contentType) }
  }

  throw new Error(`URL returned ${result.contentType}, not an image`)
}
