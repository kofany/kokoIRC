import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { join } from "node:path"
import { loadScript, unloadScript, reloadScript, getLoadedScripts, isLoaded } from "@/core/scripts/manager"
import { scriptCommands } from "@/core/scripts/api"
import { eventBus } from "@/core/scripts/event-bus"
import { useStore } from "@/core/state/store"
import { DEFAULT_CONFIG } from "@/core/config/defaults"

const FIXTURES = join(import.meta.dir, "fixtures")

describe("ScriptManager", () => {
  beforeEach(() => {
    // Ensure store has a config so scripts can access it
    useStore.getState().setConfig({ ...DEFAULT_CONFIG })
  })

  afterEach(() => {
    // Clean up all loaded scripts
    for (const s of getLoadedScripts()) {
      unloadScript(s.name)
    }
    eventBus.clear()
  })

  test("loads a valid script", async () => {
    const result = await loadScript(join(FIXTURES, "test-script.ts"))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.name).toBe("test-script")
    }
    expect(isLoaded("test-script")).toBe(true)
  })

  test("loaded script registers commands", async () => {
    await loadScript(join(FIXTURES, "test-script.ts"))
    expect(scriptCommands.has("testcmd")).toBe(true)
  })

  test("loaded script registers event handlers", async () => {
    const sizeBefore = eventBus.size
    await loadScript(join(FIXTURES, "test-script.ts"))
    expect(eventBus.size).toBeGreaterThan(sizeBefore)
  })

  test("unload removes commands and handlers", async () => {
    await loadScript(join(FIXTURES, "test-script.ts"))
    expect(scriptCommands.has("testcmd")).toBe(true)

    unloadScript("test-script")
    expect(scriptCommands.has("testcmd")).toBe(false)
    expect(isLoaded("test-script")).toBe(false)
  })

  test("unload returns false for unknown script", () => {
    expect(unloadScript("nonexistent")).toBe(false)
  })

  test("reload unloads and reloads", async () => {
    await loadScript(join(FIXTURES, "test-script.ts"))
    expect(isLoaded("test-script")).toBe(true)

    const result = await reloadScript("test-script")
    expect(result.ok).toBe(true)
    expect(isLoaded("test-script")).toBe(true)
    expect(scriptCommands.has("testcmd")).toBe(true)
  })

  test("reload fails for unloaded script", async () => {
    const result = await reloadScript("nonexistent")
    expect(result.ok).toBe(false)
  })

  test("getLoadedScripts returns loaded info", async () => {
    await loadScript(join(FIXTURES, "test-script.ts"))
    const scripts = getLoadedScripts()
    expect(scripts.length).toBe(1)
    expect(scripts[0].name).toBe("test-script")
    expect(scripts[0].meta.version).toBe("1.0.0")
  })

  test("rejects script with no default export", async () => {
    const result = await loadScript(join(FIXTURES, "bad-script.ts"))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("no default export")
    }
  })

  test("handles script that throws during init", async () => {
    const result = await loadScript(join(FIXTURES, "error-script.ts"))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("init failed on purpose")
    }
    // Should not be left in loaded state
    expect(isLoaded("error-script")).toBe(false)
  })

  test("returns error for nonexistent file", async () => {
    const result = await loadScript(join(FIXTURES, "does-not-exist.ts"))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("not found")
    }
  })

  test("loading same script twice replaces it", async () => {
    await loadScript(join(FIXTURES, "test-script.ts"))
    await loadScript(join(FIXTURES, "test-script.ts"))
    const scripts = getLoadedScripts()
    expect(scripts.length).toBe(1)
  })
})
