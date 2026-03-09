import { jest } from '@jest/globals'
import Universe from '../src/engine/Universe.js'
import { scheduleScenarioEvents, loadScenario } from '../src/scenario/index.js'
import { Cartesian3, JulianDate } from 'cesium'

// Mock core objects to keep Universe lightweight
jest.mock('../src/engine/objects/Earth.js', () => {
  return jest.fn().mockImplementation(() => ({
    name: 'Earth',
    update: jest.fn(),
    attach: jest.fn(),
    addChild: jest.fn((child) => {
      child.parent = null
    }),
    removeChild: jest.fn((child) => {
      child.parent = null
    })
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
    expect(gimbal.trackMode).toBe('fixed')
  })

  test('stepGimbalAxes event steps axis values in fixed mode', () => {
    const gimbal = {
      trackMode: 'rate',
      trackObject: { name: 'SAT' },
      az: 10,
      el: 20,
      update: jest.fn()
    }
    const site = { name: 'OBS', update: jest.fn() }
    const sensor = { update: jest.fn() }
    universe._observatories.push({ site, gimbal, sensor })

    scheduleScenarioEvents(universe, viewer, [
      {
        time: 0,
        type: 'stepGimbalAxes',
        observer: 'OBS',
        axes: { az: 5, el: -3 }
      }
    ])

    universe.update(start)
    expect(gimbal.trackMode).toBe('fixed')
    expect(gimbal.trackObject).toBeNull()
    expect(gimbal.az).toBeCloseTo(15, 8)
    expect(gimbal.el).toBeCloseTo(17, 8)
  })

  test('setSensorZoom defaults to the primary sensor and preserves tracking state', () => {
    const trackedObject = { name: 'SAT' }
    const primarySensor = { name: 'Primary', setZoomLevel: jest.fn() }
    const secondarySensor = { name: 'Secondary', setZoomLevel: jest.fn() }
    const gimbal = { trackMode: 'rate', trackObject: trackedObject, update: jest.fn() }
    const site = { name: 'OBS', update: jest.fn() }
    universe._observatories.push({
      site,
      gimbal,
      sensor: primarySensor,
      sensors: [primarySensor, secondarySensor]
    })

    scheduleScenarioEvents(universe, viewer, [
      {
        time: 0,
        type: 'setSensorZoom',
        observer: 'OBS',
        zoomLevel: 0.75
      }
    ])

    universe.update(start)
    expect(primarySensor.setZoomLevel).toHaveBeenCalledWith(0.75)
    expect(secondarySensor.setZoomLevel).not.toHaveBeenCalled()
    expect(gimbal.trackMode).toBe('rate')
    expect(gimbal.trackObject).toBe(trackedObject)
  })

  test('stepSensorZoom targets a named sensor on a multi-sensor observatory', () => {
    const primarySensor = { name: 'Primary', stepZoomLevel: jest.fn() }
    const narrowSensor = { name: 'Narrow', stepZoomLevel: jest.fn() }
    const gimbal = { trackMode: 'fixed', trackObject: null, update: jest.fn() }
    const site = { name: 'OBS', update: jest.fn() }
    universe._observatories.push({
      site,
      gimbal,
      sensor: primarySensor,
      sensors: [primarySensor, narrowSensor]
    })

    scheduleScenarioEvents(universe, viewer, [
      {
        time: 0,
        type: 'stepSensorZoom',
        observer: 'OBS',
        sensor: 'Narrow',
        deltaZoomLevel: 0.125
      }
    ])

    universe.update(start)
    expect(narrowSensor.stepZoomLevel).toHaveBeenCalledWith(0.125)
    expect(primarySensor.stepZoomLevel).not.toHaveBeenCalled()
  })

  test('setDirectedEnergyActive toggles a named laser payload without affecting tracking', () => {
    const trackedObject = { name: 'SAT' }
    const primarySensor = { name: 'Primary', setZoomLevel: jest.fn() }
    const laser = { name: 'HSV HEL', type: 'Laser', active: false, update: jest.fn() }
    const gimbal = { trackMode: 'rate', trackObject: trackedObject, update: jest.fn() }
    const site = { name: 'OBS', update: jest.fn() }
    universe._observatories.push({
      site,
      gimbal,
      sensor: primarySensor,
      sensors: [primarySensor, laser]
    })

    scheduleScenarioEvents(universe, viewer, [
      {
        time: 0,
        type: 'setDirectedEnergyActive',
        observer: 'OBS',
        device: 'HSV HEL',
        active: true
      }
    ])

    universe.update(start)
    expect(laser.active).toBe(true)
    expect(gimbal.trackMode).toBe('rate')
    expect(gimbal.trackObject).toBe(trackedObject)
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

  test('airVehicleManeuver updates vehicle velocity and acceleration', () => {
    const vehicle = {
      name: 'Drone-Alpha',
      velocityNed: new Cartesian3(1, 1, 0),
      accelerationNed: new Cartesian3(0, 0, 0),
      heading: 0,
      update: jest.fn()
    }
    universe.addObject(vehicle)

    scheduleScenarioEvents(universe, viewer, [
      {
        time: 0,
        type: 'airVehicleManeuver',
        object: 'Drone-Alpha',
        velocity_ned: [12, 4, -1],
        acceleration_ned: [0.2, -0.1, 0.0]
      }
    ])

    universe.update(start)
    expect(vehicle.velocityNed).toEqual(new Cartesian3(12, 4, -1))
    expect(vehicle.accelerationNed).toEqual(new Cartesian3(0.2, -0.1, 0))
  })

  test('setAirVehicleVelocityNed derives velocity from speed/heading/vertical_speed', () => {
    const vehicle = {
      name: 'Drone-Alpha',
      velocityNed: new Cartesian3(0, 0, 0),
      accelerationNed: new Cartesian3(0, 0, 0),
      heading: 0,
      update: jest.fn()
    }
    universe.addObject(vehicle)

    scheduleScenarioEvents(universe, viewer, [
      {
        time: 0,
        type: 'setAirVehicleVelocityNed',
        object: 'Drone-Alpha',
        speed: 50,
        heading: 90,
        vertical_speed: 3
      }
    ])

    universe.update(start)
    expect(vehicle.velocityNed.x).toBeCloseTo(0, 8)
    expect(vehicle.velocityNed.y).toBeCloseTo(50, 8)
    expect(vehicle.velocityNed.z).toBeCloseTo(-3, 8)
  })

  test('setAirVehicleHeading updates heading directly', () => {
    const vehicle = {
      name: 'Drone-Alpha',
      velocityNed: new Cartesian3(0, 0, 0),
      accelerationNed: new Cartesian3(0, 0, 0),
      heading: 10,
      update: jest.fn()
    }
    universe.addObject(vehicle)

    scheduleScenarioEvents(universe, viewer, [
      { time: 0, type: 'setAirVehicleHeading', object: 'Drone-Alpha', heading: 225 }
    ])

    universe.update(start)
    expect(vehicle.heading).toBeCloseTo(225, 8)
  })

  test('manual maneuver events cancel an active waypoint route and continue from the cancel point', () => {
    const vehicle = universe.addAirVehicle(
      'Drone-Route',
      0,
      0,
      0,
      new Cartesian3(),
      new Cartesian3(),
      undefined,
      start
    )
    vehicle.setWaypointRoute({
      startTime: start,
      waypoints: [
        { lat: 0, lon: 0, alt: 0 },
        { lat: 0, lon: 1, alt: 0, offsetSec: 20 }
      ]
    }, start)

    scheduleScenarioEvents(universe, viewer, [
      {
        time: 10,
        type: 'setAirVehicleVelocityNed',
        object: 'Drone-Route',
        velocity_ned: [50, 0, 0]
      }
    ])

    universe.update(JulianDate.addSeconds(start, 10, new JulianDate()))
    expect(vehicle.hasWaypointRoute).toBe(false)
    expect(vehicle.longitude).toBeCloseTo(0.5, 3)
    expect(vehicle.velocityNed.x).toBeCloseTo(50, 8)
    expect(vehicle.velocityNed.y).toBeCloseTo(0, 8)

    universe.update(JulianDate.addSeconds(start, 20, new JulianDate()))
    expect(vehicle.latitude).toBeGreaterThan(0)
    expect(vehicle.longitude).toBeCloseTo(0.5, 2)
  })

  test('non-routed air vehicles continue to use manual maneuver events unchanged', () => {
    const vehicle = universe.addAirVehicle(
      'Drone-Manual',
      0,
      0,
      0,
      new Cartesian3(10, 0, 0),
      new Cartesian3(),
      undefined,
      start
    )

    scheduleScenarioEvents(universe, viewer, [
      {
        time: 0,
        type: 'airVehicleManeuver',
        object: 'Drone-Manual',
        velocity_ned: [0, 25, -2],
        acceleration_ned: [0.1, 0, 0]
      }
    ])

    universe.update(start)
    expect(vehicle.hasWaypointRoute).toBe(false)
    expect(vehicle.velocityNed).toEqual(new Cartesian3(0, 25, -2))
    expect(vehicle.accelerationNed).toEqual(new Cartesian3(0.1, 0, 0))
  })
})
