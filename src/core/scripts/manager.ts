import { join } from "node:path"
import { useStore } from "@/core/state/store"
import { SCRIPTS_DIR } from "@/core/constants"
import { createScriptAPI } from "./api"
import type { ScriptMeta, ScriptModule } from "./types"

interface LoadedScript {
  name: string
  path: string
  meta: ScriptMeta
  cleanup: () => void
  scriptCleanup?: () => void
}

const loaded = new Map<string, LoadedScript>()

/** Resolve a script name or path to an absolute file path. */
function resolvePath(nameOrPath: string): string {
  if (nameOrPath.startsWith("/") || nameOrPath.startsWith("./") || nameOrPath.startsWith("~")) {
    return nameOrPath
  }
  // Strip .ts extension if given, we'll add it back
  const base = nameOrPath.replace(/\.ts$/, "")
  return join(SCRIPTS_DIR, `${base}.ts`)
}

/** Load a script by name or path. */
export async function loadScript(nameOrPath: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const path = resolvePath(nameOrPath)

  // Check file exists
  const file = Bun.file(path)
  if (!(await file.exists())) {
    return { ok: false, error: `Script not found: ${path}` }
  }

  let mod: ScriptModule
  try {
    mod = await import(`file://${path}?t=${Date.now()}`)
  } catch (err: any) {
    return { ok: false, error: `Failed to import: ${err.message}` }
  }

  if (typeof mod.default !== "function") {
    return { ok: false, error: `Script has no default export function` }
  }

  const meta: ScriptMeta = mod.meta ?? {
    name: nameOrPath.replace(/\.ts$/, "").split("/").pop() ?? nameOrPath,
  }

  // Unload existing version if already loaded
  if (loaded.has(meta.name)) {
    unloadScript(meta.name)
  }

  const scriptDefaults = mod.config ?? {}
  const { api, cleanup } = createScriptAPI(meta, scriptDefaults)

  let scriptCleanup: (() => void) | undefined
  try {
    const result = mod.default(api)
    if (typeof result === "function") {
      scriptCleanup = result
    }
  } catch (err: any) {
    cleanup()
    return { ok: false, error: `init() threw: ${err.message}` }
  }

  loaded.set(meta.name, { name: meta.name, path, meta, cleanup, scriptCleanup })
  return { ok: true, name: meta.name }
}

/** Unload a script by name. */
export function unloadScript(name: string): boolean {
  const script = loaded.get(name)
  if (!script) return false

  // Call script's own cleanup first
  try {
    script.scriptCleanup?.()
  } catch {
    // Ignore cleanup errors
  }

  // Then clean up all tracked registrations
  script.cleanup()
  loaded.delete(name)
  return true
}

/** Reload a script (unload + load with cache bust). */
export async function reloadScript(name: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const script = loaded.get(name)
  if (!script) {
    return { ok: false, error: `Script '${name}' is not loaded` }
  }

  const path = script.path
  unloadScript(name)

  // Re-import with cache bust
  return loadScript(path)
}

/** Get list of loaded scripts. */
export function getLoadedScripts(): Array<{ name: string; path: string; meta: ScriptMeta }> {
  return Array.from(loaded.values()).map(({ name, path, meta }) => ({ name, path, meta }))
}

/** Get list of available script files in SCRIPTS_DIR. */
export async function getAvailableScripts(): Promise<Array<{ name: string; path: string; loaded: boolean }>> {
  const glob = new Bun.Glob("*.ts")
  const results: Array<{ name: string; path: string; loaded: boolean }> = []

  try {
    for await (const file of glob.scan({ cwd: SCRIPTS_DIR })) {
      const name = file.replace(/\.ts$/, "")
      results.push({
        name,
        path: join(SCRIPTS_DIR, file),
        loaded: loaded.has(name),
      })
    }
  } catch {
    // Directory might not exist yet
  }

  return results.sort((a, b) => a.name.localeCompare(b.name))
}

/** Load all scripts listed in config.scripts.autoload. */
export async function autoloadScripts(): Promise<void> {
  const config = useStore.getState().config
  const autoload: string[] = (config as any)?.scripts?.autoload ?? []
  const debug: boolean = (config as any)?.scripts?.debug ?? false

  for (const name of autoload) {
    const result = await loadScript(name)
    if (debug) {
      if (result.ok) {
        console.log(`[scripts] autoloaded: ${result.name}`)
      } else {
        console.error(`[scripts] autoload failed for '${name}': ${result.error}`)
      }
    }
  }
}

/** Check if a script is loaded. */
export function isLoaded(name: string): boolean {
  return loaded.has(name)
}
