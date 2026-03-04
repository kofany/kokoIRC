import type { CliRenderer } from "@opentui/core"

let ref: CliRenderer | null = null

export function setRenderer(r: CliRenderer) { ref = r }
export function getRenderer(): CliRenderer | null { return ref }
