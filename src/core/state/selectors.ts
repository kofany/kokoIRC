import { useStore } from "./store"
import { sortBuffers, sortNicks } from "./sorting"
import type { Buffer, NickEntry } from "@/types"

export function useActiveBuffer(): Buffer | null {
  return useStore((s) => {
    if (!s.activeBufferId) return null
    return s.buffers.get(s.activeBufferId) ?? null
  })
}

export function useSortedBuffers(): Array<Buffer & { connectionLabel: string }> {
  return useStore((s) => {
    const list = Array.from(s.buffers.values()).map((buf) => ({
      ...buf,
      connectionLabel: s.connections.get(buf.connectionId)?.label ?? buf.connectionId,
    }))
    return sortBuffers(list)
  })
}

export function useSortedNicks(bufferId: string, prefixOrder: string): NickEntry[] {
  return useStore((s) => {
    const buf = s.buffers.get(bufferId)
    if (!buf) return []
    return sortNicks(Array.from(buf.users.values()), prefixOrder)
  })
}

export function useConnection(id: string) {
  return useStore((s) => s.connections.get(id))
}
