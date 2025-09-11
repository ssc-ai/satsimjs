import { JulianDate } from 'cesium'
import Event from './Event.js'

/**
 * Minimal priority-ordered event queue for time-based firing.
 *
 * - Maintains ascending order by time, then by insertion sequence.
 * - Supports typed handler registry and per-event handler override.
 */
class EventQueue {
  constructor() {
    this._events = []
    this._handlers = new Map()
  }

  registerHandler(type, fn) {
    if (!type) throw new Error('EventQueue.registerHandler: type is required')
    if (typeof fn !== 'function') throw new Error('EventQueue.registerHandler: handler must be a function')
    this._handlers.set(String(type).toLowerCase(), fn)
  }

  unregisterHandler(type) {
    if (!type) throw new Error('EventQueue.unregisterHandler: type is required')
    return this._handlers.delete(String(type).toLowerCase())
  }

  getHandler(type) {
    if (!type) throw new Error('EventQueue.getHandler: type is required')
    return this._handlers.get(String(type).toLowerCase())
  }

  add(evt) {
    const e = (evt instanceof Event) ? evt : new Event(evt)
    this._events.push(e)
    // Sort by time, then by sequence for stability
    this._events.sort((a, b) => {
      if (JulianDate.lessThan(a.time, b.time)) return -1
      if (JulianDate.greaterThan(a.time, b.time)) return 1
      return (a._seq - b._seq)
    })
    return e.id
  }

  remove(id) {
    const idx = this._events.findIndex(e => e.id === id)
    if (idx >= 0) {
      this._events.splice(idx, 1)
      return true
    }
    return false
  }

  clear() { this._events.length = 0 }
  size() { return this._events.length }

  process(currentTime, universe) {
    if (!(currentTime instanceof JulianDate)) {
      throw new Error('EventQueue.process: currentTime must be a JulianDate')
    }
    if (!Array.isArray(this._events) || this._events.length === 0) return

    // Since sorted ascending by time, process from front while due
    let i = 0
    while (i < this._events.length) {
      const e = this._events[i]
      if (JulianDate.lessThan(e.time, currentTime) || JulianDate.equals(e.time, currentTime)) {
        const handler = e.handler || this.getHandler(e.type)
        if (typeof handler !== 'function') {
          throw new Error(`EventQueue: no handler for type '${e.type}'`)
        }
        handler(universe, e)
        e.fired = true
        // Remove one-shot events
        this._events.splice(i, 1)
        continue
      }
      break
    }
  }
}

export default EventQueue
