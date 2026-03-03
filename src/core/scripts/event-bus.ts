import { EventPriority } from "./types"
import type { EventHandler, EventRegistration, EventContext } from "./types"

export class EventBus {
  private handlers: EventRegistration[] = []

  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event: string, handler: EventHandler, priority = EventPriority.NORMAL, owner = ""): () => void {
    const reg: EventRegistration = { event, handler, priority, once: false, owner }
    this.insert(reg)
    return () => this.remove(reg)
  }

  /** Subscribe to an event for a single firing. */
  once(event: string, handler: EventHandler, priority = EventPriority.NORMAL, owner = ""): () => void {
    const reg: EventRegistration = { event, handler, priority, once: true, owner }
    this.insert(reg)
    return () => this.remove(reg)
  }

  /** Emit an event. Returns false if a handler called stop(). */
  emit(event: string, data?: any): boolean {
    const ctx: EventContext = {
      stopped: false,
      stop() { this.stopped = true },
    }

    // Snapshot matching handlers (allows safe removal during iteration)
    const matching = this.handlers.filter((h) => h.event === event)

    for (const reg of matching) {
      reg.handler(data, ctx)

      if (reg.once) {
        this.remove(reg)
      }

      if (ctx.stopped) {
        // Remove remaining once handlers that matched but didn't fire
        for (const r of matching) {
          if (r.once && r !== reg) this.remove(r)
        }
        return false
      }
    }

    return true
  }

  /** Remove all registrations for a given owner. */
  removeAll(owner: string): void {
    this.handlers = this.handlers.filter((h) => h.owner !== owner)
  }

  /** Remove all handlers. */
  clear(): void {
    this.handlers = []
  }

  /** Number of registered handlers (for testing). */
  get size(): number {
    return this.handlers.length
  }

  /** Insert a registration in priority-sorted position (descending). */
  private insert(reg: EventRegistration): void {
    let i = 0
    while (i < this.handlers.length && this.handlers[i].priority >= reg.priority) {
      i++
    }
    this.handlers.splice(i, 0, reg)
  }

  /** Remove a specific registration by reference. */
  private remove(reg: EventRegistration): void {
    const idx = this.handlers.indexOf(reg)
    if (idx !== -1) this.handlers.splice(idx, 1)
  }
}

/** Singleton event bus shared across the app and all scripts. */
export const eventBus = new EventBus()
