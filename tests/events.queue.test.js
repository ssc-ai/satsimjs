import { jest } from '@jest/globals'
import EventQueue from '../src/engine/event/EventQueue.js'
import Event from '../src/engine/event/Event.js'
import { JulianDate } from 'cesium'

describe('EventQueue', () => {
  let queue
  let universe
  let base
  let calls
  let commandBus

  beforeEach(() => {
    calls = []
    commandBus = {
      execute: jest.fn((command) => calls.push(command))
    }
    queue = new EventQueue({ commandBus })
    universe = { name: 'U' }
    base = new JulianDate()
  })

  test('adds events and fires due ones', () => {
    const nowEvt = new Event({ time: base, type: 'alpha', value: 1 })
    const later = JulianDate.addSeconds(base, 10, new JulianDate())
    const laterEvt = new Event({ time: later, type: 'alpha', value: 2 })

    queue.add(nowEvt)
    queue.add(laterEvt)

    expect(queue.size()).toBe(2)

    queue.process(base, universe)
    expect(calls).toEqual([{ type: 'alpha', value: 1 }])
    expect(queue.size()).toBe(1)

    queue.process(later, universe)
    expect(calls).toEqual([
      { type: 'alpha', value: 1 },
      { type: 'alpha', value: 2 }
    ])
    expect(queue.size()).toBe(0)
  })

  test('stable ordering for equal-times by insertion order', () => {
    const mk = (n) => new Event({ time: base, type: 't', value: n })
    queue.add(mk(1))
    queue.add(mk(2))
    queue.add(mk(3))
    queue.process(base, universe)
    expect(calls.map((command) => command.value)).toEqual([1, 2, 3])
  })

  test('delegates due command events to a command bus', () => {
    queue.add({
      time: base,
      command: {
        type: 'customCommand',
        value: 42
      }
    })

    queue.process(base, {
      universe,
      source: 'test'
    })

    expect(commandBus.execute).toHaveBeenCalledWith(
      { type: 'customCommand', value: 42 },
      expect.objectContaining({
        universe,
        time: base,
        source: 'test',
        commandBus
      })
    )
    expect(queue.size()).toBe(0)
  })

  test('remove and clear work', () => {
    const e1id = queue.add({ time: base, type: 'x' })
    queue.add({ time: JulianDate.addSeconds(base, 1, new JulianDate()), type: 'y' })
    expect(queue.size()).toBe(2)
    expect(queue.remove(e1id)).toBe(true)
    expect(queue.size()).toBe(1)
    expect(queue.remove('nope')).toBe(false)
    queue.clear()
    expect(queue.size()).toBe(0)
  })

  test('throws when due events have no command bus', () => {
    queue = new EventQueue()
    queue.add({ time: base, type: 'no-bus' })
    expect(() => queue.process(base, universe)).toThrow(/commandBus is required/i)
  })

  test('throws on invalid currentTime', () => {
    expect(() => queue.process('not-a-jd', universe)).toThrow(/JulianDate/i)
  })
})
