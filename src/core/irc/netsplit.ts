import { useStore } from "@/core/state/store"
import { makeBufferId } from "@/types"
import type { Message } from "@/types"
import { nextMsgId } from "@/core/utils/id"

// ─── Types ───────────────────────────────────────────────────

interface SplitRecord {
  nick: string
  channels: string[]  // buffer IDs the user was in
}

interface SplitGroup {
  server1: string
  server2: string
  nicks: SplitRecord[]
  lastQuit: number
  printed: boolean
}

interface NetjoinGroup {
  server1: string
  server2: string
  nicks: string[]
  channels: Set<string>  // buffer IDs
  lastJoin: number
  printed: boolean
}

// ─── Constants ───────────────────────────────────────────────

const SPLIT_BATCH_WAIT = 5_000       // 5s — collect quits before printing
const NETJOIN_BATCH_WAIT = 5_000     // 5s — collect joins before printing
const SPLIT_EXPIRE = 3600_000        // 1 hour — forget split records
const MAX_NICKS_DISPLAY = 15         // truncate nick list after this

// ─── Per-connection state ────────────────────────────────────

const splitState = new Map<string, {
  groups: SplitGroup[]
  /** nick → SplitGroup mapping for fast netjoin lookup */
  nickIndex: Map<string, SplitGroup>
  netjoins: NetjoinGroup[]
  timer: ReturnType<typeof setInterval> | null
}>()

function getState(connId: string) {
  let s = splitState.get(connId)
  if (!s) {
    s = { groups: [], nickIndex: new Map(), netjoins: [], timer: null }
    splitState.set(connId, s)
  }
  if (!s.timer) {
    s.timer = setInterval(() => tick(connId), 1_000)
  }
  return s
}

/** Clean up when disconnecting. */
export function destroyNetsplitState(connId: string) {
  const s = splitState.get(connId)
  if (s?.timer) clearInterval(s.timer)
  splitState.delete(connId)
}

// ─── Detection ───────────────────────────────────────────────

/**
 * Check if a QUIT message looks like a netsplit.
 * Format: "host1.domain host2.domain" — two valid hostnames separated by a single space.
 */
export function isNetsplitQuit(message: string): boolean {
  if (!message) return false
  // Must not contain : or / (avoids URLs and other messages)
  if (message.includes(":") || message.includes("/")) return false

  const space = message.indexOf(" ")
  if (space <= 0 || space === message.length - 1) return false
  // Only one space
  if (message.indexOf(" ", space + 1) !== -1) return false

  const host1 = message.slice(0, space)
  const host2 = message.slice(space + 1)

  return isValidSplitHost(host1) && isValidSplitHost(host2) && host1 !== host2
}

function isValidSplitHost(host: string): boolean {
  if (host.length < 3) return false
  if (host.startsWith(".") || host.endsWith(".")) return false
  if (host.includes("..")) return false

  const dot = host.lastIndexOf(".")
  if (dot <= 0) return false

  const tld = host.slice(dot + 1)
  if (tld.length < 2) return false
  if (!/^[a-zA-Z]+$/.test(tld)) return false

  return true
}

// ─── Quit handling ───────────────────────────────────────────

/**
 * Process a QUIT that looks like a netsplit.
 * Returns true if it was handled (suppress normal quit display).
 */
export function handleNetsplitQuit(
  connId: string,
  nick: string,
  message: string,
  affectedBufferIds: string[],
): boolean {
  if (!isNetsplitQuit(message)) return false

  const space = message.indexOf(" ")
  const server1 = message.slice(0, space)
  const server2 = message.slice(space + 1)
  const state = getState(connId)
  const now = Date.now()

  // Find existing group for this server pair
  let group = state.groups.find(
    (g) => g.server1 === server1 && g.server2 === server2 && !g.printed,
  )

  if (!group) {
    group = { server1, server2, nicks: [], lastQuit: now, printed: false }
    state.groups.push(group)
  }

  group.nicks.push({ nick, channels: affectedBufferIds })
  group.lastQuit = now
  state.nickIndex.set(nick, group)

  return true
}

// ─── Join handling (netjoin) ─────────────────────────────────

/**
 * Check if a JOIN is from a user who was in a netsplit.
 * Returns true if it was handled (suppress normal join display).
 */
export function handleNetsplitJoin(
  connId: string,
  nick: string,
  bufferId: string,
): boolean {
  const state = splitState.get(connId)
  if (!state) return false

  const splitGroup = state.nickIndex.get(nick)
  if (!splitGroup) return false

  // This nick was in a netsplit — batch the rejoin
  const now = Date.now()
  const key = `${splitGroup.server1} ${splitGroup.server2}`

  let njGroup = state.netjoins.find(
    (g) => g.server1 === splitGroup.server1 && g.server2 === splitGroup.server2 && !g.printed,
  )

  if (!njGroup) {
    njGroup = {
      server1: splitGroup.server1,
      server2: splitGroup.server2,
      nicks: [],
      channels: new Set(),
      lastJoin: now,
      printed: false,
    }
    state.netjoins.push(njGroup)
  }

  if (!njGroup.nicks.includes(nick)) {
    njGroup.nicks.push(nick)
  }
  njGroup.channels.add(bufferId)
  njGroup.lastJoin = now

  // Remove from split index
  state.nickIndex.delete(nick)

  return true
}

// ─── Tick — check for batches to print ───────────────────────

function tick(connId: string) {
  const state = splitState.get(connId)
  if (!state) return
  const now = Date.now()

  // Print split groups that have been quiet for SPLIT_BATCH_WAIT
  for (const group of state.groups) {
    if (!group.printed && now - group.lastQuit >= SPLIT_BATCH_WAIT) {
      printSplitGroup(connId, group)
      group.printed = true
    }
  }

  // Print netjoin groups that have been quiet for NETJOIN_BATCH_WAIT
  for (const nj of state.netjoins) {
    if (!nj.printed && now - nj.lastJoin >= NETJOIN_BATCH_WAIT) {
      printNetjoinGroup(connId, nj)
      nj.printed = true
    }
  }

  // Expire old split records
  state.groups = state.groups.filter((g) => now - g.lastQuit < SPLIT_EXPIRE)
  state.netjoins = state.netjoins.filter((nj) => now - nj.lastJoin < SPLIT_EXPIRE)

  // Clean up nick index for expired groups
  for (const [nick, group] of state.nickIndex) {
    if (now - group.lastQuit >= SPLIT_EXPIRE) {
      state.nickIndex.delete(nick)
    }
  }

  // If nothing left, stop the timer
  if (state.groups.length === 0 && state.netjoins.length === 0 && state.nickIndex.size === 0) {
    if (state.timer) {
      clearInterval(state.timer)
      state.timer = null
    }
  }
}

// ─── Printing ────────────────────────────────────────────────

function makeEventMessage(text: string): Message {
  return {
    id: nextMsgId(),
    timestamp: new Date(),
    type: "event",
    text,
    highlight: false,
  }
}

function printSplitGroup(connId: string, group: SplitGroup) {
  const store = useStore.getState()

  // Collect all affected buffer IDs
  const allBufferIds = new Set<string>()
  for (const rec of group.nicks) {
    for (const id of rec.channels) allBufferIds.add(id)
  }

  // Build nick list with truncation
  const nickNames = group.nicks.map((r) => r.nick)
  let nickStr: string
  if (nickNames.length > MAX_NICKS_DISPLAY) {
    const shown = nickNames.slice(0, MAX_NICKS_DISPLAY).join(", ")
    const more = nickNames.length - MAX_NICKS_DISPLAY
    nickStr = `${shown} %Z565f89(+${more} more)%N`
  } else {
    nickStr = nickNames.join(", ")
  }

  const msg = `%Zf7768eNetsplit%N %Za9b1d6${group.server1}%N %Z565f89\u21C4%N %Za9b1d6${group.server2}%N %Z565f89quits:%N %Ze0af68${nickStr}%N`

  // Show in all affected channels
  for (const bufferId of allBufferIds) {
    if (store.buffers.has(bufferId)) {
      store.addMessage(bufferId, makeEventMessage(msg))
    }
  }
}

function printNetjoinGroup(connId: string, group: NetjoinGroup) {
  const store = useStore.getState()

  let nickStr: string
  if (group.nicks.length > MAX_NICKS_DISPLAY) {
    const shown = group.nicks.slice(0, MAX_NICKS_DISPLAY).join(", ")
    const more = group.nicks.length - MAX_NICKS_DISPLAY
    nickStr = `${shown} %Z565f89(+${more} more)%N`
  } else {
    nickStr = group.nicks.join(", ")
  }

  const msg = `%Z9ece6aNetsplit over%N %Za9b1d6${group.server1}%N %Z565f89\u21C4%N %Za9b1d6${group.server2}%N %Z565f89joins:%N %Ze0af68${nickStr}%N`

  for (const bufferId of group.channels) {
    if (store.buffers.has(bufferId)) {
      store.addMessage(bufferId, makeEventMessage(msg))
    }
  }
}
