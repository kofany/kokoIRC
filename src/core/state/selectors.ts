import { useMemo } from "react"
import { useStore } from "./store"
import { sortBuffers, sortNicks } from "./sorting"
import type { Buffer, NickEntry } from "@/types"

export function useActiveBuffer(): Buffer | null {
  const activeBufferId = useStore((s) => s.activeBufferId)
  const buffersMap = useStore((s) => s.buffers)
  return activeBufferId ? buffersMap.get(activeBufferId) ?? null : null
}

export function useSortedBuffers(): Array<Buffer & { connectionLabel: string }> {
  const buffersMap = useStore((s) => s.buffers)
  const connectionsMap = useStore((s) => s.connections)
  return useMemo(() => {
    const list = Array.from(buffersMap.values())
      .filter((buf) => buf.connectionId !== "_default")
      .map((buf) => ({
        ...buf,
        connectionLabel: connectionsMap.get(buf.connectionId)?.label ?? buf.connectionId,
      }))
    return sortBuffers(list)
  }, [buffersMap, connectionsMap])
}

const EMPTY_NICKS: NickEntry[] = []

export function useSortedNicks(bufferId: string, prefixOrder: string): NickEntry[] {
  const buffer = useStore((s) => s.buffers.get(bufferId))
  return useMemo(() => {
    if (!buffer) return EMPTY_NICKS
    return sortNicks(Array.from(buffer.users.values()), prefixOrder)
  }, [buffer, prefixOrder])
}

export function useConnection(id: string) {
  return useStore((s) => s.connections.get(id))
}
