import { test, expect, describe, beforeEach } from "bun:test"
import { useStore } from "@/core/state/store"
import { BufferType, ActivityLevel } from "@/types"
import type { Buffer, Message, NickEntry } from "@/types"

function makeBuffer(id: string, overrides: Partial<Buffer> = {}): Buffer {
  return {
    id,
    connectionId: "test",
    type: BufferType.Channel,
    name: id.split("/")[1] ?? id,
    messages: [],
    activity: ActivityLevel.None,
    unreadCount: 0,
    lastRead: new Date(),
    users: new Map(),
    listModes: new Map(),
    ...overrides,
  }
}

function makeMessage(id: number, text = "test"): Message {
  return {
    id,
    timestamp: new Date(),
    type: "event",
    text,
    highlight: false,
  }
}

function makeNick(nick: string, overrides: Partial<NickEntry> = {}): NickEntry {
  return { nick, prefix: "", modes: "", away: false, ...overrides }
}

describe("batch store methods", () => {
  beforeEach(() => {
    // Reset store state
    useStore.setState({
      connections: new Map(),
      buffers: new Map(),
      activeBufferId: null,
      previousActiveBufferId: null,
      config: null,
      theme: null,
    })
  })

  describe("batchRemoveNick", () => {
    test("removes nick from multiple buffers in one call", () => {
      const buf1 = makeBuffer("test/#a", { users: new Map([["alice", makeNick("alice")]]) })
      const buf2 = makeBuffer("test/#b", { users: new Map([["alice", makeNick("alice")], ["bob", makeNick("bob")]]) })
      useStore.setState({ buffers: new Map([["test/#a", buf1], ["test/#b", buf2]]) })

      useStore.getState().batchRemoveNick([
        { bufferId: "test/#a", nick: "alice" },
        { bufferId: "test/#b", nick: "alice" },
      ])

      const buffers = useStore.getState().buffers
      expect(buffers.get("test/#a")!.users.has("alice")).toBe(false)
      expect(buffers.get("test/#b")!.users.has("alice")).toBe(false)
      expect(buffers.get("test/#b")!.users.has("bob")).toBe(true)
    })

    test("skips non-existent buffers", () => {
      const buf1 = makeBuffer("test/#a", { users: new Map([["alice", makeNick("alice")]]) })
      useStore.setState({ buffers: new Map([["test/#a", buf1]]) })

      useStore.getState().batchRemoveNick([
        { bufferId: "test/#a", nick: "alice" },
        { bufferId: "test/#nonexistent", nick: "alice" },
      ])

      expect(useStore.getState().buffers.get("test/#a")!.users.size).toBe(0)
    })
  })

  describe("batchAddNick", () => {
    test("adds nick to multiple buffers in one call", () => {
      const buf1 = makeBuffer("test/#a")
      const buf2 = makeBuffer("test/#b")
      useStore.setState({ buffers: new Map([["test/#a", buf1], ["test/#b", buf2]]) })

      useStore.getState().batchAddNick([
        { bufferId: "test/#a", entry: makeNick("alice") },
        { bufferId: "test/#b", entry: makeNick("alice") },
      ])

      const buffers = useStore.getState().buffers
      expect(buffers.get("test/#a")!.users.has("alice")).toBe(true)
      expect(buffers.get("test/#b")!.users.has("alice")).toBe(true)
    })
  })

  describe("batchUpdateNick", () => {
    test("renames nick across multiple buffers", () => {
      const users = new Map([["alice", makeNick("alice", { prefix: "@" })]])
      const buf1 = makeBuffer("test/#a", { users: new Map(users) })
      const buf2 = makeBuffer("test/#b", { users: new Map(users) })
      useStore.setState({ buffers: new Map([["test/#a", buf1], ["test/#b", buf2]]) })

      useStore.getState().batchUpdateNick([
        { bufferId: "test/#a", oldNick: "alice", newNick: "alice_" },
        { bufferId: "test/#b", oldNick: "alice", newNick: "alice_" },
      ])

      const buffers = useStore.getState().buffers
      expect(buffers.get("test/#a")!.users.has("alice")).toBe(false)
      expect(buffers.get("test/#a")!.users.has("alice_")).toBe(true)
      expect(buffers.get("test/#a")!.users.get("alice_")!.prefix).toBe("@")
      expect(buffers.get("test/#b")!.users.has("alice_")).toBe(true)
    })
  })

  describe("batchAddMessage", () => {
    test("adds messages to multiple buffers", () => {
      const buf1 = makeBuffer("test/#a")
      const buf2 = makeBuffer("test/#b")
      useStore.setState({ buffers: new Map([["test/#a", buf1], ["test/#b", buf2]]) })

      useStore.getState().batchAddMessage([
        { bufferId: "test/#a", message: makeMessage(1, "hello") },
        { bufferId: "test/#b", message: makeMessage(2, "world") },
      ])

      const buffers = useStore.getState().buffers
      expect(buffers.get("test/#a")!.messages).toHaveLength(1)
      expect(buffers.get("test/#a")!.messages[0].text).toBe("hello")
      expect(buffers.get("test/#b")!.messages).toHaveLength(1)
      expect(buffers.get("test/#b")!.messages[0].text).toBe("world")
    })

    test("enforces scrollback limit per buffer", () => {
      useStore.setState({ config: { display: { scrollback_lines: 3 } } as any })
      const buf1 = makeBuffer("test/#a", {
        messages: [makeMessage(1), makeMessage(2), makeMessage(3)],
      })
      useStore.setState({ buffers: new Map([["test/#a", buf1]]) })

      useStore.getState().batchAddMessage([
        { bufferId: "test/#a", message: makeMessage(4, "new1") },
        { bufferId: "test/#a", message: makeMessage(5, "new2") },
      ])

      const messages = useStore.getState().buffers.get("test/#a")!.messages
      expect(messages).toHaveLength(3)
      expect(messages[0].id).toBe(3)
      expect(messages[2].id).toBe(5)
    })

    test("single-entry batch works identically to addMessage", () => {
      const buf1 = makeBuffer("test/#a")
      useStore.setState({ buffers: new Map([["test/#a", buf1]]) })

      useStore.getState().batchAddMessage([
        { bufferId: "test/#a", message: makeMessage(1, "solo") },
      ])

      const messages = useStore.getState().buffers.get("test/#a")!.messages
      expect(messages).toHaveLength(1)
      expect(messages[0].text).toBe("solo")
    })
  })
})
