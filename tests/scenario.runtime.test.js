import { jest } from '@jest/globals'
import { JulianDate } from 'cesium'

import Universe from '../src/engine/Universe.js'
import {
  applySimulationParameters,
  createClockContext,
  loadScenarioRuntime
} from '../src/scenario/index.js'

jest.mock('../src/engine/objects/Earth.js', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'Earth',
    update: jest.fn(),
    attach: jest.fn(),
    addChild: jest.fn(),
    removeChild: jest.fn()
  }))
})

jest.mock('../src/engine/objects/Sun.js', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'Sun',
    update: jest.fn()
  }))
})

describe('Scenario runtime clock support', () => {
  test('createClockContext returns a clock-like object', () => {
    const clock = createClockContext()
    expect(clock.startTime).toBeInstanceOf(JulianDate)
    expect(clock.currentTime).toBeInstanceOf(JulianDate)
    expect(clock.stopTime).toBeInstanceOf(JulianDate)
    expect(clock.multiplier).toBe(1)
    expect(clock.clockStep).toBe(1)
    expect(clock.clockRange).toBe(0)
    expect(clock.shouldAnimate).toBe(false)
  })

  test('applySimulationParameters mutates a plain clock context', () => {
    const clock = createClockContext()
    applySimulationParameters(clock, {
      start_time: '2026-04-03T16:00:00Z',
      end_time: '2026-04-03T17:00:00Z',
      current_time: '2026-04-03T16:05:00Z',
      time_step: 2,
      clock_step: 'tick_dependent',
      clock_range: 'loop_stop',
      playback_state: 'play'
    })

    expect(JulianDate.toDate(clock.startTime).toISOString()).toBe('2026-04-03T16:00:00.000Z')
    expect(JulianDate.toDate(clock.stopTime).toISOString()).toBe('2026-04-03T17:00:00.000Z')
    expect(JulianDate.toDate(clock.currentTime).toISOString()).toBe('2026-04-03T16:05:00.000Z')
    expect(clock.multiplier).toBe(2)
    expect(clock.clockStep).toBe(0)
    expect(clock.clockRange).toBe(2)
    expect(clock.shouldAnimate).toBe(true)
  })

  test('applySimulationParameters supports start_time now with duration_sec', () => {
    const anchor = JulianDate.fromDate(new Date('2026-04-03T16:00:00Z'))
    const clock = createClockContext({
      startTime: anchor,
      currentTime: anchor,
      stopTime: JulianDate.addSeconds(anchor, 60, new JulianDate())
    })

    applySimulationParameters(clock, {
      start_time: 'now',
      duration_sec: 3600
    })

    expect(JulianDate.toDate(clock.startTime).toISOString()).toBe('2026-04-03T16:00:00.000Z')
    expect(JulianDate.toDate(clock.currentTime).toISOString()).toBe('2026-04-03T16:00:00.000Z')
    expect(JulianDate.toDate(clock.stopTime).toISOString()).toBe('2026-04-03T17:00:00.000Z')
  })

  test('loadScenarioRuntime loads objects and events without a viewer', () => {
    const universe = new Universe()
    const clock = createClockContext()
    const config = {
      simulationParameters: {
        start_time: '2026-04-03T16:00:00Z',
        current_time: '2026-04-03T16:00:00Z',
        end_time: '2026-04-03T17:00:00Z'
      },
      objects: [
        {
          type: 'AirVehicle',
          name: 'Drone-Alpha',
          latitude: 34.6712,
          longitude: -86.6496,
          altitude: 120
        }
      ],
      events: [
        {
          time: 0,
          type: 'setAirVehicleHeading',
          object: 'Drone-Alpha',
          heading: 135
        }
      ]
    }

    loadScenarioRuntime(universe, clock, config)
    expect(universe.getObject('Drone-Alpha')).toBeDefined()

    universe.update(clock.currentTime)
    expect(universe.getObject('Drone-Alpha').heading).toBeCloseTo(135, 8)
  })
})
