import EventQueue from '../src/engine/event/EventQueue.js'
import Event from '../src/engine/event/Event.js'
import { JulianDate } from 'cesium'

describe('EventQueue', () => {
  let queue
  let universe
  let base

  beforeEach(() => {
    queue = new EventQueue()
    universe = { name: 'U' }
    base = new JulianDate()
  })

  test('adds events and fires due ones', () => {
    const calls = []
    queue.registerHandler('alpha', (_u, e) => calls.push(`alpha:${e.id}`))

    const nowEvt = new Event({ time: base, type: 'alpha' })
    const later = JulianDate.addSeconds(base, 10, new JulianDate())
    const laterEvt = new Event({ time: later, type: 'alpha' })

    queue.add(nowEvt)
    queue.add(laterEvt)

    expect(queue.size()).toBe(2)

    // Process at base: only nowEvt fires
    queue.process(base, universe)
    expect(calls.length).toBe(1)
    expect(queue.size()).toBe(1)

    // Process at later: laterEvt fires
    queue.process(later, universe)
    expect(calls.length).toBe(2)
    expect(queue.size()).toBe(0)
  })

  test('per-event handler overrides registry', () => {
    const calls = []
    queue.registerHandler('beta', () => calls.push('beta:registry'))

    const e1 = new Event({ time: base, type: 'beta' })
    const e2 = new Event({ time: base, type: 'beta', handler: () => calls.push('beta:override') })

    queue.add(e1)
    queue.add(e2)

    queue.process(base, universe)
    expect(calls).toEqual(['beta:registry', 'beta:override'])
  })

  test('stable ordering for equal-times by insertion order', () => {
    const calls = []
    const mk = (n) => new Event({ time: base, type: 't', handler: () => calls.push(n) })
    queue.add(mk(1))
    queue.add(mk(2))
    queue.add(mk(3))
    queue.process(base, universe)
    expect(calls).toEqual([1, 2, 3])
  })

  test('remove and clear work', () => {
    const e1id = queue.add({ time: base, type: 'x', handler: () => {} })
    const e2id = queue.add({ time: JulianDate.addSeconds(base, 1, new JulianDate()), type: 'y', handler: () => {} })
    expect(queue.size()).toBe(2)
    expect(queue.remove(e1id)).toBe(true)
    expect(queue.size()).toBe(1)
    expect(queue.remove('nope')).toBe(false)
    queue.clear()
    expect(queue.size()).toBe(0)
  })

  test('throws on missing handler for event type', () => {
    queue.add({ time: base, type: 'no-handler' })
    expect(() => queue.process(base, universe)).toThrow(/no handler/i)
  })

  test('throws on invalid currentTime', () => {
    expect(() => queue.process('not-a-jd', universe)).toThrow(/JulianDate/i)
  })

  test('register/unregister validation', () => {
    expect(() => queue.registerHandler('', () => {})).toThrow(/type is required/i)
    expect(() => queue.registerHandler('t', null)).toThrow(/handler must be a function/i)
    expect(() => queue.unregisterHandler('')).toThrow(/type is required/i)
  })
})
