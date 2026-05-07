import { JulianDate } from 'cesium'
import Event from './Event.js'

/**
 * Minimal priority-ordered event queue for time-based firing.
 *
 * - Maintains ascending order by time, then by insertion sequence.
 * - Delegates due commands to the command bus.
 */
class EventQueue {
  constructor({ commandBus = undefined } = {}) {
    this._events = []
    this.commandBus = commandBus
  }

  add(evt) {
    const e = (evt instanceof Event) ? evt : new Event(evt)
    this._events.push(e)
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

  process(currentTime, context) {
    if (!(currentTime instanceof JulianDate)) {
      throw new Error('EventQueue.process: currentTime must be a JulianDate')
    }
    if (!Array.isArray(this._events) || this._events.length === 0) return

    const universe = context?.universe ?? context
    const commandBus = context?.commandBus ?? universe?.commandBus ?? this.commandBus
    if (!commandBus) {
      throw new Error('EventQueue.process: commandBus is required')
    }
    const commandContext = {
      ...(context && typeof context === 'object' ? context : {}),
      universe,
      time: currentTime,
      source: context?.source ?? 'scenario',
      commandBus
    }

    let i = 0
    while (i < this._events.length) {
      const e = this._events[i]
      if (JulianDate.lessThan(e.time, currentTime) || JulianDate.equals(e.time, currentTime)) {
        commandBus.execute(e.command, {
          ...commandContext,
          time: e.time,
          currentTime
        })
        this._events.splice(i, 1)
        continue
      }
      break
    }
  }
}

export default EventQueue
