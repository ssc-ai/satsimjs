import { JulianDate } from 'cesium'

let __evtSeq = 0

function createCommand(opts) {
  if (opts.command && typeof opts.command === 'object' && !Array.isArray(opts.command)) {
    return { ...opts.command }
  }

  const { data } = opts
  const flatCommand = { ...opts }
  delete flatCommand.time
  delete flatCommand.id
  delete flatCommand.data
  delete flatCommand.command

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return {
      type: flatCommand.type,
      ...data
    }
  }
  return flatCommand
}

/**
 * Time wrapper around a command.
 */
class Event {
  constructor(opts = {}) {
    const { time, type, id } = opts
    this.time = Event.toJulianDate(time)
    if (!this.time) throw new Error('Event: invalid or missing time')
    this.command = createCommand(opts)
    this.type = (this.command?.type != null ? String(this.command.type) : (type != null ? String(type) : undefined))
    this._seq = __evtSeq++
    this.id = id || `evt_${Date.now()}_${this._seq}`
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
