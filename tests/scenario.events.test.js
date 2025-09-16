import { jest } from '@jest/globals'
import Universe from '../src/engine/Universe.js'
import { scheduleScenarioEvents, loadScenario } from '../src/scenario/index.js'
import { JulianDate } from 'cesium'

// Mock core objects to keep Universe lightweight
jest.mock('../src/engine/objects/Earth.js', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'Earth',
    update: jest.fn(),
    attach: jest.fn(),
    removeChild: jest.fn()
  }))
})
jest.mock('../src/engine/objects/Sun.js', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'Sun',
    update: jest.fn()
  }))
})

describe('Scenario event scheduling', () => {
  let universe
  let viewer
  let start

  beforeEach(() => {
    universe = new Universe()
    start = new JulianDate()
    viewer = { clock: { startTime: start, currentTime: start, stopTime: JulianDate.addSeconds(start, 1000, new JulianDate()) } }
  })

  test('scheduleScenarioEvents enqueues events with relative and absolute times', () => {
    const iso = new Date().toISOString()
    scheduleScenarioEvents(universe, viewer, [
      { time: 5, type: 'trackObject', observer: 'OBS', target: 'SAT' },
      { time: iso, type: 'trackObject', observer: 'OBS', target: 'SAT' }
    ])
    expect(universe.events.size()).toBe(2)
  })

  test('trackObject event sets gimbal tracking when due', () => {
    // Setup observatory and target
    const gimbal = { trackMode: 'idle', trackObject: null, update: jest.fn() }
    const site = { name: 'OBS', update: jest.fn() }
    const sensor = { update: jest.fn() }
    universe._observatories.push({ site, gimbal, sensor })
    const sat = { name: 'SAT', update: jest.fn() }
    universe.addObject(sat)

    // Schedule event at t0
    scheduleScenarioEvents(universe, viewer, [
      { time: 0, type: 'trackObject', observer: 'OBS', target: 'SAT' }
    ])

    // Process via universe.update
    universe.update(start)
    expect(gimbal.trackMode).toBe('rate')
    expect(gimbal.trackObject).toBe(sat)
  })

  test('trackObject event clears gimbal tracking when target is null', () => {
    const existingTarget = { name: 'OLD', update: jest.fn() }
    const gimbal = { trackMode: 'rate', trackObject: existingTarget, update: jest.fn() }
    const site = { name: 'OBS', update: jest.fn() }
    const sensor = { update: jest.fn() }
    universe._observatories.push({ site, gimbal, sensor })

    scheduleScenarioEvents(universe, viewer, [
      { time: 0, type: 'trackObject', observer: 'OBS', target: null }
    ])

    universe.update(start)
    expect(gimbal.trackObject).toBeNull()
  })

  test('loadScenario adds events without clearing existing ones', () => {
    // Add a pre-existing event
    universe.scheduleEvent({ time: JulianDate.addSeconds(start, 100, new JulianDate()), type: 'foo', data: {} })
    expect(universe.events.size()).toBe(1)

    // Load scenario with 2 additional events
    const cfg = { events: [
      { time: 1, type: 'trackObject', observer: 'OBS', target: 'SAT' },
      { time: 2, type: 'trackObject', observer: 'OBS', target: 'SAT' }
    ] }
    loadScenario(universe, viewer, cfg)
    expect(universe.events.size()).toBe(3)
  })
})
