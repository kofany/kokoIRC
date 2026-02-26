import { test, expect, describe } from "bun:test"
import { loadTheme } from "@/core/theme/loader"

describe("loadTheme", () => {
  test("loads and parses default theme", async () => {
    const theme = await loadTheme("themes/default.theme")
    expect(theme.meta.name).toBe("Default")
    expect(theme.abstracts.timestamp).toBeDefined()
    expect(theme.formats.messages.own_msg).toBeDefined()
    expect(theme.formats.events.join).toBeDefined()
    expect(theme.formats.sidepanel.item_selected).toBeDefined()
    expect(theme.formats.nicklist.op).toBeDefined()
  })
})
