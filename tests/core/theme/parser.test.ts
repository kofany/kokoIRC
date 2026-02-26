import { test, expect, describe } from "bun:test"
import { parseFormatString, resolveAbstractions } from "@/core/theme/parser"
import type { StyledSpan } from "@/types/theme"

describe("parseFormatString", () => {
  test("plain text returns single span", () => {
    const result = parseFormatString("hello world")
    expect(result).toEqual([{ text: "hello world", bold: false, italic: false, underline: false, dim: false }])
  })

  test("%B sets bright blue foreground", () => {
    const result = parseFormatString("%Bhello%N")
    expect(result[0].fg).toBe("#5555ff")
    expect(result[0].text).toBe("hello")
  })

  test("%ZRRGGBB sets exact hex color", () => {
    const result = parseFormatString("%ZFF9500text%N")
    expect(result[0].fg).toBe("#FF9500")
    expect(result[0].text).toBe("text")
  })

  test("%_ toggles bold", () => {
    const result = parseFormatString("%_bold%_ notbold")
    expect(result[0].bold).toBe(true)
    expect(result[0].text).toBe("bold")
    expect(result[1].bold).toBe(false)
  })

  test("%N resets all styles", () => {
    const result = parseFormatString("%R%_red bold%N plain")
    expect(result[0].fg).toBe("#ff5555")
    expect(result[0].bold).toBe(true)
    expect(result[1].fg).toBeUndefined()
    expect(result[1].bold).toBe(false)
  })

  test("positional vars $0 $1 are substituted", () => {
    const result = parseFormatString("$0 said $1", ["kofany", "hello"])
    expect(result[0].text).toBe("kofany said hello")
  })

  test("padding $[8]0 right-pads to width", () => {
    const result = parseFormatString("$[8]0", ["hi"])
    expect(result[0].text).toBe("hi      ")
  })

  test("padding $[-8]0 left-pads to width", () => {
    const result = parseFormatString("$[-8]0", ["hi"])
    expect(result[0].text).toBe("      hi")
  })

  test("$* expands all params", () => {
    const result = parseFormatString("$*", ["a", "b", "c"])
    expect(result[0].text).toBe("a b c")
  })
})

describe("resolveAbstractions", () => {
  test("resolves {name $args} references", () => {
    const abstracts = {
      nick: "%B%_$*%_%N",
      msgnick: "$0{nick $1}\u276F ",
    }
    const resolved = resolveAbstractions("{msgnick @ kofany}", abstracts)
    expect(resolved).toBe("@%B%_kofany%_%N\u276F ")
  })

  test("handles nested abstractions", () => {
    const abstracts = {
      inner: "%R$*%N",
      outer: "before {inner $0} after",
    }
    const resolved = resolveAbstractions("{outer hello}", abstracts)
    expect(resolved).toBe("before %Rhello%N after")
  })

  test("returns original if abstraction not found", () => {
    const resolved = resolveAbstractions("{unknown test}", {})
    expect(resolved).toBe("{unknown test}")
  })
})
