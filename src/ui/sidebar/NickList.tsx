import { useMemo } from "react"
import { useStore } from "@/core/state/store"
import { sortNicks } from "@/core/state/sorting"
import { resolveAbstractions, parseFormatString, StyledText } from "@/core/theme"
import { BufferType, ActivityLevel, makeBufferId } from "@/types"

const DEFAULT_PREFIX_ORDER = "~&@%+"
const EMPTY_NICKS: import("@/types").NickEntry[] = []

export function NickList() {
  const activeBufferId = useStore((s) => s.activeBufferId)
  const buffersMap = useStore((s) => s.buffers)
  const connectionsMap = useStore((s) => s.connections)
  const theme = useStore((s) => s.theme)
  const colors = theme?.colors

  const buffer = activeBufferId ? buffersMap.get(activeBufferId) ?? null : null
  const conn = buffer ? connectionsMap.get(buffer.connectionId) : undefined

  const prefixOrder = conn?.isupport?.PREFIX
    ? extractPrefixChars(conn.isupport.PREFIX)
    : DEFAULT_PREFIX_ORDER

  const sortedNicks = useMemo(() => {
    if (!buffer) return EMPTY_NICKS
    return sortNicks(Array.from(buffer.users.values()), prefixOrder)
  }, [buffer, prefixOrder])

  if (!buffer || buffer.type !== BufferType.Channel) {
    return (
      <box flexGrow={1}>
        <text><span fg={colors?.fg_dim ?? "#292e42"}>{"\u2014"}</span></text>
      </box>
    )
  }

  const formats = theme?.formats.nicklist ?? {}
  const abstracts = theme?.abstracts ?? {}

  return (
    <scrollbox height="100%">
      <box width="100%">
        <text><span fg={colors?.fg_muted ?? "#565f89"}>{sortedNicks.length} users</span></text>
      </box>
      {sortedNicks.map((entry) => {
        const formatKey = getFormatKey(entry.prefix)
        const format = formats[formatKey] ?? " $0"
        const resolved = resolveAbstractions(format, abstracts)
        const spans = parseFormatString(resolved, [entry.nick])

        return (
          <box key={entry.nick} width="100%"
            onMouseDown={() => {
              if (!buffer) return
              const store = useStore.getState()
              const queryId = makeBufferId(buffer.connectionId, entry.nick)
              if (!store.buffers.has(queryId)) {
                store.addBuffer({
                  id: queryId,
                  connectionId: buffer.connectionId,
                  type: BufferType.Query,
                  name: entry.nick,
                  messages: [],
                  activity: ActivityLevel.None,
                  unreadCount: 0,
                  lastRead: new Date(),
                  users: new Map(),
                })
              }
              store.setActiveBuffer(queryId)
            }}
          >
            <StyledText spans={spans} />
          </box>
        )
      })}
    </scrollbox>
  )
}

function getFormatKey(prefix: string): string {
  switch (prefix) {
    case "~": return "owner"
    case "&": return "admin"
    case "@": return "op"
    case "%": return "halfop"
    case "+": return "voice"
    default: return "normal"
  }
}

function extractPrefixChars(isupportPrefix: unknown): string {
  if (typeof isupportPrefix !== "string") return DEFAULT_PREFIX_ORDER
  const match = isupportPrefix.match(/\)(.+)$/)
  return match ? match[1] : DEFAULT_PREFIX_ORDER
}
