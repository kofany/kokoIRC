import { useStore } from "@/core/state/store"
import { makeBufferId } from "@/types"
import type { Message } from "@/types"
import { nextMsgId } from "@/core/utils/id"
import type { Client } from "kofany-irc-framework"

// ─── Constants (proven thresholds from erssi) ────────────────

const CTCP_THRESHOLD = 5
const CTCP_WINDOW = 5_000
const CTCP_BLOCK = 60_000

const TILDE_THRESHOLD = 5
const TILDE_WINDOW = 5_000
const TILDE_BLOCK = 60_000

const DUP_MIN_IN_WINDOW = 5     // need 5+ msgs in window before checking dups
const DUP_THRESHOLD = 3          // 3 identical out of those = flood
const DUP_WINDOW = 5_000
const DUP_BLOCK = 60_000

const NICK_THRESHOLD = 5
const NICK_WINDOW = 3_000
const NICK_BLOCK = 60_000

// ─── Per-connection state ────────────────────────────────────

interface FloodState {
  ctcpTimes: number[]
  ctcpBlockedUntil: number
  tildeTimes: number[]
  tildeBlockedUntil: number
  msgWindow: { text: string; time: number }[]
  blockedTexts: Map<string, number>       // text → blockedUntil
  nickTimes: Map<string, number[]>        // bufferId → timestamps
  nickBlockedUntil: Map<string, number>   // bufferId → blockedUntil
}

const states = new Map<string, FloodState>()

function getState(connId: string): FloodState {
  let s = states.get(connId)
  if (!s) {
    s = {
      ctcpTimes: [],
      ctcpBlockedUntil: 0,
      tildeTimes: [],
      tildeBlockedUntil: 0,
      msgWindow: [],
      blockedTexts: new Map(),
      nickTimes: new Map(),
      nickBlockedUntil: new Map(),
    }
    states.set(connId, s)
  }
  return s
}

export function destroyAntifloodState(connId: string) {
  states.delete(connId)
}

// ─── Helpers ─────────────────────────────────────────────────

function isFloodProtectionEnabled(): boolean {
  return useStore.getState().config?.general?.flood_protection ?? true
}

function statusNotify(connId: string, text: string) {
  const store = useStore.getState()
  const statusId = makeBufferId(connId, "Status")
  if (store.buffers.has(statusId)) {
    store.addMessage(statusId, makeEventMessage(
      `%Zf7768eFlood protection:%N %Ze0af68${text}%N`
    ))
  }
}

function makeEventMessage(text: string): Message {
  return {
    id: nextMsgId(),
    timestamp: new Date(),
    type: "event",
    text,
    highlight: false,
  }
}

/** Prune timestamps older than `window` ms, return count remaining. */
function pruneWindow(times: number[], now: number, window: number): number {
  const cutoff = now - window
  let i = 0
  while (i < times.length && times[i] < cutoff) i++
  if (i > 0) times.splice(0, i)
  return times.length
}

// ─── Parsed middleware (CTCP + message floods) ───────────────

export function createAntiFloodMiddleware(connId: string) {
  return function middlewareInstaller(client: Client, rawEvents: any, parsedEvents: any) {
    parsedEvents.use(function antiFloodHandler(command: string, event: any, _client: Client, next: () => void) {
      if (!isFloodProtectionEnabled()) {
        next()
        return
      }

      const state = getState(connId)
      const now = Date.now()

      // ── CTCP requests ──
      if (command === "ctcp request") {
        if (state.ctcpBlockedUntil > now) {
          // Still blocked — extend silently
          state.ctcpBlockedUntil = now + CTCP_BLOCK
          return // don't call next() — suppress event + auto-response
        }

        state.ctcpTimes.push(now)
        const count = pruneWindow(state.ctcpTimes, now, CTCP_WINDOW)

        if (count >= CTCP_THRESHOLD) {
          state.ctcpBlockedUntil = now + CTCP_BLOCK
          state.ctcpTimes.length = 0
          statusNotify(connId, "CTCP flood detected \u2014 blocking CTCP for 60s")
          return // suppress
        }

        next()
        return
      }

      // ── Messages: privmsg, notice, action ──
      if (command === "privmsg" || command === "notice" || command === "action") {
        const ident: string = event.ident || ""
        const message: string = event.message || ""
        const target: string = event.target || ""
        const isChannel = target.startsWith("#") || target.startsWith("&") ||
                          target.startsWith("+") || target.startsWith("!")

        // ~ident flood check
        if (ident.startsWith("~")) {
          if (state.tildeBlockedUntil > now) {
            state.tildeBlockedUntil = now + TILDE_BLOCK
            return // suppress
          }

          state.tildeTimes.push(now)
          const count = pruneWindow(state.tildeTimes, now, TILDE_WINDOW)

          if (count >= TILDE_THRESHOLD) {
            state.tildeBlockedUntil = now + TILDE_BLOCK
            state.tildeTimes.length = 0
            statusNotify(connId, "~ident flood detected \u2014 blocking tilde messages for 60s")
            return // suppress
          }
        }

        // Duplicate text flood (channel messages only)
        if (isChannel && message) {
          // Check if this exact text is already blocked
          const blockedUntil = state.blockedTexts.get(message)
          if (blockedUntil && blockedUntil > now) {
            state.blockedTexts.set(message, now + DUP_BLOCK)
            return // suppress
          }

          // Add to sliding message window
          state.msgWindow.push({ text: message, time: now })
          // Prune old entries
          const cutoff = now - DUP_WINDOW
          while (state.msgWindow.length > 0 && state.msgWindow[0].time < cutoff) {
            state.msgWindow.shift()
          }

          // Only analyze when enough messages in window
          if (state.msgWindow.length >= DUP_MIN_IN_WINDOW) {
            // Count occurrences of this message in window
            let dupes = 0
            for (const entry of state.msgWindow) {
              if (entry.text === message) dupes++
            }
            if (dupes >= DUP_THRESHOLD) {
              state.blockedTexts.set(message, now + DUP_BLOCK)
              statusNotify(connId, "Duplicate flood detected \u2014 blocking pattern for 60s")
              return // suppress
            }
          }

          // Clean expired blocked texts periodically
          if (state.blockedTexts.size > 50) {
            for (const [text, until] of state.blockedTexts) {
              if (until <= now) state.blockedTexts.delete(text)
            }
          }
        }

        next()
        return
      }

      // Everything else passes through
      next()
    })
  }
}

// ─── Nick flood guard (called from events.ts) ────────────────

export function shouldSuppressNickFlood(connId: string, bufferId: string): boolean {
  if (!isFloodProtectionEnabled()) return false

  const state = getState(connId)
  const now = Date.now()

  // Check if currently blocked for this buffer
  const blockedUntil = state.nickBlockedUntil.get(bufferId) ?? 0
  if (blockedUntil > now) {
    // Extend block silently
    state.nickBlockedUntil.set(bufferId, now + NICK_BLOCK)
    return true
  }

  // Track nick change timestamp
  let times = state.nickTimes.get(bufferId)
  if (!times) {
    times = []
    state.nickTimes.set(bufferId, times)
  }
  times.push(now)
  pruneWindow(times, now, NICK_WINDOW)

  if (times.length >= NICK_THRESHOLD) {
    state.nickBlockedUntil.set(bufferId, now + NICK_BLOCK)
    times.length = 0

    // Extract channel name from bufferId for status message
    const parts = bufferId.split("/")
    const channel = parts.length > 1 ? parts[parts.length - 1] : bufferId
    statusNotify(connId, `Nick flood in ${channel} \u2014 suppressing nick changes for 60s`)
    return true
  }

  return false
}
