import { test, expect, describe } from "bun:test"
import { sortBuffers, sortNicks } from "@/core/state/sorting"
import { BufferType, ActivityLevel } from "@/types"

describe("sortBuffers", () => {
  test("sorts by connection label, then sort group, then name", () => {
    const buffers = [
      { connectionId: "libera", connectionLabel: "Libera", type: BufferType.Channel, name: "#opentui" },
      { connectionId: "ircnet", connectionLabel: "IRCnet", type: BufferType.Query, name: "kofany" },
      { connectionId: "ircnet", connectionLabel: "IRCnet", type: BufferType.Channel, name: "#polska" },
      { connectionId: "ircnet", connectionLabel: "IRCnet", type: BufferType.Channel, name: "#erssi" },
      { connectionId: "ircnet", connectionLabel: "IRCnet", type: BufferType.Server, name: "Status" },
    ]
    const sorted = sortBuffers(buffers as any)
    expect(sorted.map(b => b.name)).toEqual([
      "Status", "#erssi", "#polska", "kofany", "#opentui"
    ])
  })
})

describe("sortNicks", () => {
  test("sorts by prefix priority then alphabetically", () => {
    const nicks = [
      { nick: "zebra", prefix: "", away: false },
      { nick: "alpha", prefix: "@", away: false },
      { nick: "beta", prefix: "+", away: false },
      { nick: "omega", prefix: "@", away: false },
      { nick: "gamma", prefix: "", away: false },
    ]
    const prefixOrder = "~&@%+"
    const sorted = sortNicks(nicks, prefixOrder)
    expect(sorted.map(n => n.nick)).toEqual([
      "alpha", "omega", "beta", "gamma", "zebra"
    ])
  })
})
