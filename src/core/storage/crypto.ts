import { chmod } from "node:fs/promises"
import { ENV_PATH } from "@/core/constants"

const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12
const ENV_KEY_NAME = "KOKO_LOG_KEY"

let cachedKey: CryptoKey | null = null

/** Generate a random 256-bit hex key string. */
export function generateKeyHex(): string {
  const bytes = new Uint8Array(KEY_LENGTH / 8)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("hex")
}

/** Import a hex key string into a CryptoKey. */
async function importKey(hexKey: string): Promise<CryptoKey> {
  const raw = Buffer.from(hexKey, "hex")
  return crypto.subtle.importKey("raw", raw, { name: ALGORITHM }, false, ["encrypt", "decrypt"])
}

/** Encrypt plaintext. Returns { ciphertext: base64, iv: 12-byte Uint8Array }. */
export async function encrypt(
  text: string,
  key: CryptoKey,
): Promise<{ ciphertext: string; iv: Uint8Array }> {
  const iv = new Uint8Array(IV_LENGTH)
  crypto.getRandomValues(iv)
  const encoded = new TextEncoder().encode(text)
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded)
  return {
    ciphertext: Buffer.from(encrypted).toString("base64"),
    iv,
  }
}

/** Decrypt base64 ciphertext with the given IV. */
export async function decrypt(
  ciphertext: string,
  iv: Uint8Array,
  key: CryptoKey,
): Promise<string> {
  const data = Buffer.from(ciphertext, "base64")
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv: new Uint8Array(iv) }, key, data)
  return new TextDecoder().decode(decrypted)
}

/** Load key from .env, or generate and save one if missing. Returns CryptoKey. */
export async function loadOrCreateKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey

  const file = Bun.file(ENV_PATH)
  let content = (await file.exists()) ? await file.text() : ""

  // Try to find existing key
  const match = content.match(new RegExp(`^${ENV_KEY_NAME}=(.+)$`, "m"))
  let hexKey: string

  if (match) {
    hexKey = match[1].trim()
  } else {
    // Generate and append to .env
    hexKey = generateKeyHex()
    content = content.trimEnd() + (content.length > 0 ? "\n" : "") + `${ENV_KEY_NAME}=${hexKey}\n`
    await Bun.write(ENV_PATH, content)
    await chmod(ENV_PATH, 0o600)
  }

  cachedKey = await importKey(hexKey)
  return cachedKey
}

/** Clear cached key (for testing). */
export function clearKeyCache(): void {
  cachedKey = null
}
