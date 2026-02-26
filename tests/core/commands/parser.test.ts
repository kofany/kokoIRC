import { test, expect, describe } from "bun:test"
import { parseCommand } from "@/core/commands/parser"

describe("parseCommand", () => {
  test("/join #channel", () => {
    const result = parseCommand("/join #polska")
    expect(result).toEqual({ command: "join", args: ["#polska"] })
  })

  test("/msg nick message text", () => {
    const result = parseCommand("/msg kofany hello there friend")
    expect(result).toEqual({ command: "msg", args: ["kofany", "hello there friend"] })
  })

  test("/me does something", () => {
    const result = parseCommand("/me does something")
    expect(result).toEqual({ command: "me", args: ["does something"] })
  })

  test("plain text is not a command", () => {
    const result = parseCommand("just regular text")
    expect(result).toBeNull()
  })

  test("/quit with optional message", () => {
    expect(parseCommand("/quit")).toEqual({ command: "quit", args: [] })
    expect(parseCommand("/quit bye all")).toEqual({ command: "quit", args: ["bye all"] })
  })

  test("/nick newnick", () => {
    const result = parseCommand("/nick kofany2")
    expect(result).toEqual({ command: "nick", args: ["kofany2"] })
  })

  test("/part with optional message", () => {
    expect(parseCommand("/part")).toEqual({ command: "part", args: [] })
    expect(parseCommand("/part #channel goodbye")).toEqual({ command: "part", args: ["#channel", "goodbye"] })
  })
})
