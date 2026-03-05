import { useMemo } from "react"
import { useStore } from "@/core/state/store"
import { sortNicks } from "@/core/state/sorting"
import { resolveAbstractions, parseFormatString, StyledText } from "@/core/theme"
import { BufferType, ActivityLevel, makeBufferId } from "@/types"

const DEFAULT_PREFIX_ORDER = "~&@%+"
const EMPTY_NICKS: import("@/types").NickEntry[] = []

export function NickList() {
  const buffer = useStore((s) => s.activeBufferId ? s.buffers.get(s.activeBufferId) ?? null : null)
  const conn = useStore((s) => {
    const buf = s.activeBufferId ? s.buffers.get(s.activeBufferId) : null
    return buf ? s.connections.get(buf.connectionId) : undefined
  })
  const theme = useStore((s) => s.theme)
  const rightWidth = useStore((s) => s.config?.sidepanel.right.width ?? 18)
  const colors = theme?.colors

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
        // Compute visible chars added by the format (everything except $0)
        const formatOverhead = resolved.replace(/\$0/, "").replace(/%[ZNn_uid|%]/g, "").replace(/%Z[0-9a-fA-F]{6}/g, "").length
        // Available width: rightWidth minus border (1) minus format decoration
        const maxNickLen = Math.max(4, rightWidth - 1 - formatOverhead)
        let displayNick = entry.nick
        if (displayNick.length > maxNickLen) {
          displayNick = displayNick.slice(0, maxNickLen - 1) + "+"
        }
        const spans = parseFormatString(resolved, [displayNick])

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
                  listModes: new Map(),
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
