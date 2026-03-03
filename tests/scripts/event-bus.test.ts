import { test, expect, describe, beforeEach } from "bun:test"
import { EventBus } from "@/core/scripts/event-bus"
import { EventPriority } from "@/core/scripts/types"

describe("EventBus", () => {
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
  })

  test("fires handlers for matching events", () => {
    const calls: string[] = []
    bus.on("test", () => calls.push("a"))
    bus.on("test", () => calls.push("b"))
    bus.on("other", () => calls.push("c"))

    bus.emit("test")
    expect(calls).toEqual(["a", "b"])
  })

  test("passes data to handlers", () => {
    let received: any
    bus.on("test", (data) => { received = data })

    bus.emit("test", { foo: "bar" })
    expect(received).toEqual({ foo: "bar" })
  })

  test("fires handlers in priority order (descending)", () => {
    const calls: string[] = []
    bus.on("test", () => calls.push("normal"), EventPriority.NORMAL)
    bus.on("test", () => calls.push("highest"), EventPriority.HIGHEST)
    bus.on("test", () => calls.push("low"), EventPriority.LOW)
    bus.on("test", () => calls.push("high"), EventPriority.HIGH)

    bus.emit("test")
    expect(calls).toEqual(["highest", "high", "normal", "low"])
  })

  test("same priority preserves insertion order", () => {
    const calls: string[] = []
    bus.on("test", () => calls.push("first"), EventPriority.NORMAL)
    bus.on("test", () => calls.push("second"), EventPriority.NORMAL)
    bus.on("test", () => calls.push("third"), EventPriority.NORMAL)

    bus.emit("test")
    expect(calls).toEqual(["first", "second", "third"])
  })

  test("stop() prevents lower-priority handlers from running", () => {
    const calls: string[] = []
    bus.on("test", () => calls.push("highest"), EventPriority.HIGHEST)
    bus.on("test", (_data, ctx) => {
      calls.push("high-stopper")
      ctx.stop()
    }, EventPriority.HIGH)
    bus.on("test", () => calls.push("normal"), EventPriority.NORMAL)

    const result = bus.emit("test")
    expect(calls).toEqual(["highest", "high-stopper"])
    expect(result).toBe(false)
  })

  test("emit returns true when no handler stops propagation", () => {
    bus.on("test", () => {})
    expect(bus.emit("test")).toBe(true)
  })

  test("emit returns true for events with no handlers", () => {
    expect(bus.emit("nonexistent")).toBe(true)
  })

  test("once handlers fire only once", () => {
    let count = 0
    bus.once("test", () => count++)

    bus.emit("test")
    bus.emit("test")
    expect(count).toBe(1)
  })

  test("once handlers are removed even when stop() is called", () => {
    const calls: string[] = []
    bus.once("test", (_data, ctx) => {
      calls.push("stopper")
      ctx.stop()
    }, EventPriority.HIGH)
    bus.once("test", () => calls.push("normal"), EventPriority.NORMAL)

    bus.emit("test")
    expect(calls).toEqual(["stopper"])
    expect(bus.size).toBe(0)
  })

  test("unsubscribe removes handler", () => {
    let count = 0
    const unsub = bus.on("test", () => count++)

    bus.emit("test")
    expect(count).toBe(1)

    unsub()
    bus.emit("test")
    expect(count).toBe(1)
  })

  test("removeAll removes handlers by owner", () => {
    const calls: string[] = []
    bus.on("test", () => calls.push("owner-a"), EventPriority.NORMAL, "a")
    bus.on("test", () => calls.push("owner-b"), EventPriority.NORMAL, "b")
    bus.on("test", () => calls.push("owner-a2"), EventPriority.NORMAL, "a")

    bus.removeAll("a")
    bus.emit("test")
    expect(calls).toEqual(["owner-b"])
  })

  test("removeAll only removes matching owner", () => {
    bus.on("e1", () => {}, EventPriority.NORMAL, "x")
    bus.on("e2", () => {}, EventPriority.NORMAL, "y")
    bus.on("e3", () => {}, EventPriority.NORMAL, "x")

    expect(bus.size).toBe(3)
    bus.removeAll("x")
    expect(bus.size).toBe(1)
  })

  test("clear removes all handlers", () => {
    bus.on("a", () => {})
    bus.on("b", () => {})
    bus.on("c", () => {})
    expect(bus.size).toBe(3)

    bus.clear()
    expect(bus.size).toBe(0)
  })

  test("custom numeric priorities work", () => {
    const calls: string[] = []
    bus.on("test", () => calls.push("90"), 90)
    bus.on("test", () => calls.push("10"), 10)
    bus.on("test", () => calls.push("50"), 50)

    bus.emit("test")
    expect(calls).toEqual(["90", "50", "10"])
  })

  test("handler removal during emit is safe", () => {
    const calls: string[] = []
    let unsub: (() => void) | undefined

    unsub = bus.on("test", () => {
      calls.push("first")
      unsub?.()
    })
    bus.on("test", () => calls.push("second"))

    bus.emit("test")
    expect(calls).toEqual(["first", "second"])

    // First handler should be gone now
    calls.length = 0
    bus.emit("test")
    expect(calls).toEqual(["second"])
  })
})
