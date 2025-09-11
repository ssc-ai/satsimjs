import { JulianDate } from 'cesium'

let __evtSeq = 0

/**
 * Simple time-based event.
 *
 * - time: Cesium JulianDate or ISO/date string (converted to JulianDate)
 * - type: string identifier
 * - data: arbitrary payload
 * - handler: optional function (universe, event)
 * - once: defaults to true
 */
class Event {
  constructor(opts = {}) {
    const { time, type, data, handler, once = true, id } = opts
    this.time = Event.toJulianDate(time)
    if (!this.time) throw new Error('Event: invalid or missing time')
    this.type = (type != null ? String(type) : undefined)
    this.data = data
    this.handler = (typeof handler === 'function' ? handler : null)
    this.once = !!once
    this.fired = false
    this.id = id || `evt_${Date.now()}_${__evtSeq++}`
    this._seq = __evtSeq++
  }

  static toJulianDate(t) {
    if (!t) return null
    if (t instanceof JulianDate) return t
    if (typeof t === 'string' || t instanceof Date) {
      try { return JulianDate.fromDate(new Date(t)) } catch (_) { return null }
    }
    return null
  }
}

export default Event

