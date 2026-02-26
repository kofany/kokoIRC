import type { Buffer, NickEntry } from "@/types"
import { getSortGroup } from "@/types"

interface SortableBuffer {
  connectionLabel: string
  type: Buffer["type"]
  name: string
}

export function sortBuffers<T extends SortableBuffer>(buffers: T[]): T[] {
  return [...buffers].sort((a, b) => {
    const labelCmp = a.connectionLabel.localeCompare(b.connectionLabel, undefined, { sensitivity: "base" })
    if (labelCmp !== 0) return labelCmp
    const groupA = getSortGroup(a.type)
    const groupB = getSortGroup(b.type)
    if (groupA !== groupB) return groupA - groupB
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })
}

export function sortNicks(nicks: NickEntry[], prefixOrder: string): NickEntry[] {
  return [...nicks].sort((a, b) => {
    const prefixA = a.prefix ? prefixOrder.indexOf(a.prefix) : prefixOrder.length
    const prefixB = b.prefix ? prefixOrder.indexOf(b.prefix) : prefixOrder.length
    const pA = prefixA === -1 ? prefixOrder.length : prefixA
    const pB = prefixB === -1 ? prefixOrder.length : prefixB
    if (pA !== pB) return pA - pB
    return a.nick.localeCompare(b.nick, undefined, { sensitivity: "base" })
  })
}
