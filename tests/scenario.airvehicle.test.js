import { jest } from '@jest/globals'
import { Cartesian3, Color, JulianDate, Quaternion } from 'cesium'
import { addScenarioObject } from '../src/scenario/index.js'

describe('scenario air vehicle support', () => {
  let viewer
  let universe

  beforeEach(() => {
    const now = JulianDate.fromDate(new Date('2024-01-01T00:00:00Z'))
    viewer = {
      clock: {
        currentTime: now.clone(),
        startTime: now.clone(),
        stopTime: JulianDate.addSeconds(now, 3600, new JulianDate()),
      },
      addObjectVisualizer: jest.fn(),
    }

    universe = {
      hasObject: jest.fn().mockReturnValue(false),
      removeObject: jest.fn(),
      addAirVehicle: jest.fn().mockImplementation((name, latitude, longitude, altitude, velocityNed, accelerationNed, heading) => ({
        name,
        latitude,
        longitude,
        altitude,
        velocityNed,
        accelerationNed,
        heading: heading ?? 0,
        position: Cartesian3.fromDegrees(longitude, latitude, altitude),
        update: jest.fn(),
        hasWaypointRoute: false,
        waypointRoute: undefined,
        setWaypointRoute: jest.fn(function setWaypointRoute(route) {
          this.hasWaypointRoute = true
          this.waypointRoute = route
          return this
        }),
      })),
    }
  })

  test('parses AirVehicle objects and passes NED vectors through to universe', () => {
    addScenarioObject(universe, viewer, {
      type: 'AirVehicle',
      name: 'Drone-1',
      latitude: 34.25,
      longitude: -117.1,
      altitude: 1200,
      velocity_ned: [45, 5, -2],
      acceleration_ned: [0.1, 0, 0],
      heading: 85,
      epoch: '2024-01-01T00:00:00Z',
      color: [0, 255, 255],
    })

    expect(universe.addAirVehicle).toHaveBeenCalledTimes(1)
    const args = universe.addAirVehicle.mock.calls[0]
    expect(args[0]).toBe('Drone-1')
    expect(args[1]).toBeCloseTo(34.25, 8)
    expect(args[2]).toBeCloseTo(-117.1, 8)
    expect(args[3]).toBeCloseTo(1200, 8)
    expect(args[4]).toEqual(new Cartesian3(45, 5, -2))
    expect(args[5]).toEqual(new Cartesian3(0.1, 0, 0))
    expect(args[6]).toBeCloseTo(85, 8)
    expect(args[8]).toBe(true)

    expect(viewer.addObjectVisualizer).toHaveBeenCalledTimes(1)
    const { path, point } = viewer.addObjectVisualizer.mock.calls[0][2]
    const expected = Color.fromBytes(0, 255, 255, 255)
    expect(path.resolution).toBe(5)
    expect(Color.equals(path.material, expected)).toBe(true)
    expect(Color.equals(point.color, expected)).toBe(true)
  })

  test('supports drone alias and derives velocity from speed/heading/vertical_speed', () => {
    addScenarioObject(universe, viewer, {
      type: 'drone',
      name: 'Drone-2',
      lat: 35,
      lon: -118,
      speed: 50,
      heading: 90,
      vertical_speed: 3,
    })

    expect(universe.addAirVehicle).toHaveBeenCalledTimes(1)
    const velocityNed = universe.addAirVehicle.mock.calls[0][4]
    expect(velocityNed.x).toBeCloseTo(0, 8)
    expect(velocityNed.y).toBeCloseTo(50, 8)
    expect(velocityNed.z).toBeCloseTo(-3, 8)
  })

  test('propagates collision radius onto the created vehicle', () => {
    addScenarioObject(universe, viewer, {
      type: 'AirVehicle',
      name: 'Drone-Collision',
      latitude: 34.25,
      longitude: -117.1,
      altitude: 1200,
      collision_radius: 3,
    })

    const createdVehicle = viewer.addObjectVisualizer.mock.calls[0][0]
    expect(createdVehicle.collisionRadius).toBe(3)
  })

  test('accepts string model entries and applies default model options', () => {
    addScenarioObject(universe, viewer, {
      type: 'AirVehicle',
      name: 'Drone-Model-String',
      latitude: 34.25,
      longitude: -117.1,
      altitude: 1200,
      heading: 45,
      model: '/assets/models/CesiumDrone.glb',
    })

    expect(viewer.addObjectVisualizer).toHaveBeenCalledTimes(1)
    const options = viewer.addObjectVisualizer.mock.calls[0][2]
    expect(options.model.uri).toBe('/assets/models/CesiumDrone.glb')
    expect(options.model.minimumPixelSize).toBe(64)
    expect(options.model.maximumScale).toBe(20000)
    expect(options.orientation).toBeDefined()

    const q = options.orientation.getValue(viewer.clock.currentTime)
    expect(q).toBeDefined()
    expect(Number.isFinite(q.x)).toBe(true)
    expect(Number.isFinite(q.y)).toBe(true)
    expect(Number.isFinite(q.z)).toBe(true)
    expect(Number.isFinite(q.w)).toBe(true)
  })

  test('accepts object model entries with canonical keys and heading offset', () => {
    const withOffset = {
      type: 'AirVehicle',
      name: 'Drone-Model-Offset',
      latitude: 34.25,
      longitude: -117.1,
      altitude: 1200,
      heading: 0,
      model: {
        uri: '/assets/models/CesiumDrone.glb',
        scale: 1.5,
        min_pix_size: 80,
        heading_offset: 90,
      },
    }
    addScenarioObject(universe, viewer, withOffset)

    const withOffsetOptions = viewer.addObjectVisualizer.mock.calls[0][2]
    expect(withOffsetOptions.model.uri).toBe('/assets/models/CesiumDrone.glb')
    expect(withOffsetOptions.model.scale).toBeCloseTo(1.5, 8)
    expect(withOffsetOptions.model.minimumPixelSize).toBe(80)
    expect(withOffsetOptions.model.maximumScale).toBe(20000)
    expect(withOffsetOptions.model.min_pix_size).toBeUndefined()
    expect(withOffsetOptions.model.heading_offset).toBeUndefined()
    const qWithOffset = withOffsetOptions.orientation.getValue(viewer.clock.currentTime)

    viewer.addObjectVisualizer.mockClear()
    addScenarioObject(universe, viewer, {
      ...withOffset,
      model: {
        uri: '/assets/models/CesiumDrone.glb',
        scale: 1.5,
        min_pix_size: 80,
        heading_offset: 0,
      },
    })

    const noOffsetOptions = viewer.addObjectVisualizer.mock.calls[0][2]
    const qWithoutOffset = noOffsetOptions.orientation.getValue(viewer.clock.currentTime)
    expect(Quaternion.equalsEpsilon(qWithOffset, qWithoutOffset, 1e-12)).toBe(false)
  })

  test('supports model pitch/roll offsets and strips them from Cesium model options', () => {
    addScenarioObject(universe, viewer, {
      type: 'AirVehicle',
      name: 'Drone-Model-Roll-Offset',
      latitude: 34.25,
      longitude: -117.1,
      altitude: 1200,
      heading: 0,
      model: {
        uri: '/assets/models/CesiumDrone.glb',
        roll_offset: 90,
        pitch_offset: 0,
      },
    })

    const withOffsetOptions = viewer.addObjectVisualizer.mock.calls[0][2]
    expect(withOffsetOptions.model.roll_offset).toBeUndefined()
    expect(withOffsetOptions.model.pitch_offset).toBeUndefined()
    const qWithOffset = withOffsetOptions.orientation.getValue(viewer.clock.currentTime)

    viewer.addObjectVisualizer.mockClear()
    addScenarioObject(universe, viewer, {
      type: 'AirVehicle',
      name: 'Drone-Model-Roll-Offset',
      latitude: 34.25,
      longitude: -117.1,
      altitude: 1200,
      heading: 0,
      model: {
        uri: '/assets/models/CesiumDrone.glb',
        roll_offset: 0,
        pitch_offset: 0,
      },
    })

    const noOffsetOptions = viewer.addObjectVisualizer.mock.calls[0][2]
    const qWithoutOffset = noOffsetOptions.orientation.getValue(viewer.clock.currentTime)
    expect(Quaternion.equalsEpsilon(qWithOffset, qWithoutOffset, 1e-12)).toBe(false)
  })

  test('does not map deprecated heading_offset_deg', () => {
    addScenarioObject(universe, viewer, {
      type: 'AirVehicle',
      name: 'Drone-Deprecated-Heading-Offset',
      latitude: 34.25,
      longitude: -117.1,
      altitude: 1200,
      heading: 0,
      model: {
        uri: '/assets/models/CesiumDrone.glb',
        heading_offset_deg: 90,
      },
    })

    const deprecatedOptions = viewer.addObjectVisualizer.mock.calls[0][2]
    const qDeprecated = deprecatedOptions.orientation.getValue(viewer.clock.currentTime)

    viewer.addObjectVisualizer.mockClear()
    addScenarioObject(universe, viewer, {
      type: 'AirVehicle',
      name: 'Drone-Deprecated-Heading-Offset',
      latitude: 34.25,
      longitude: -117.1,
      altitude: 1200,
      heading: 0,
      model: {
        uri: '/assets/models/CesiumDrone.glb',
        heading_offset: 0,
      },
    })

    const canonicalOptions = viewer.addObjectVisualizer.mock.calls[0][2]
    const qCanonical = canonicalOptions.orientation.getValue(viewer.clock.currentTime)
    expect(Quaternion.equalsEpsilon(qDeprecated, qCanonical, 1e-12)).toBe(true)
  })

  test('skips invalid air vehicle definitions without coordinates', () => {
    addScenarioObject(universe, viewer, {
      type: 'uav',
      name: 'BadDrone',
      velocity_ned: [10, 0, 0],
    })

    expect(universe.addAirVehicle).not.toHaveBeenCalled()
    expect(viewer.addObjectVisualizer).not.toHaveBeenCalled()
  })

  test('parses nested waypoint routes and derives the initial position from the first waypoint', () => {
    addScenarioObject(universe, viewer, {
      type: 'AirVehicle',
      name: 'Drone-Route',
      route: {
        mode: 'loop',
        start_time: '2024-01-01T00:00:00Z',
        default_speed: 20,
        waypoints: [
          { latitude: 34.25, longitude: -117.1, altitude: 1200 },
          { latitude: 34.26, longitude: -117.11, altitude: 1250, offset: 30 },
        ]
      }
    })

    expect(universe.addAirVehicle).toHaveBeenCalledTimes(1)
    const args = universe.addAirVehicle.mock.calls[0]
    expect(args[1]).toBeCloseTo(34.25, 8)
    expect(args[2]).toBeCloseTo(-117.1, 8)
    expect(args[3]).toBeCloseTo(1200, 8)

    const createdVehicle = universe.addAirVehicle.mock.results[0].value
    expect(createdVehicle.setWaypointRoute).toHaveBeenCalledTimes(1)
    expect(createdVehicle.setWaypointRoute.mock.calls[0][0]).toEqual({
      mode: 'loop',
      startTime: '2024-01-01T00:00:00Z',
      defaultSpeedMps: 20,
      waypoints: [
        { latitude: 34.25, longitude: -117.1, altitude: 1200 },
        { latitude: 34.26, longitude: -117.11, altitude: 1250, offsetSec: 30 },
      ]
    })

    expect(viewer.addObjectVisualizer).toHaveBeenCalledTimes(1)
    expect(viewer.addObjectVisualizer.mock.calls[0][1]).toContain('mode=loop')
    expect(viewer.addObjectVisualizer.mock.calls[0][1]).toContain('waypoints=2')
  })

  test('normalizes top-level waypoint route fields', () => {
    addScenarioObject(universe, viewer, {
      type: 'drone',
      name: 'Drone-Route-Aliases',
      waypoints: [
        { latitude: 35, longitude: -118, altitude: 500 },
        { latitude: 35.001, longitude: -118.002, altitude: 550, offset: 15, speed: 30 },
      ],
      route_mode: 'pingpong',
      start_time: '2024-01-01T00:00:10Z',
      default_speed: 25,
      loop_speed: 18,
    })

    const createdVehicle = universe.addAirVehicle.mock.results[0].value
    expect(createdVehicle.setWaypointRoute).toHaveBeenCalledTimes(1)
    expect(createdVehicle.setWaypointRoute.mock.calls[0][0]).toEqual({
      mode: 'pingpong',
      startTime: '2024-01-01T00:00:10Z',
      defaultSpeedMps: 25,
      loopSpeedMps: 18,
      waypoints: [
        { latitude: 35, longitude: -118, altitude: 500 },
        { latitude: 35.001, longitude: -118.002, altitude: 550, offsetSec: 15, speedMps: 30 },
      ]
    })
  })

  test('anchors waypoint route start_time now to the scenario start time', () => {
    addScenarioObject(universe, viewer, {
      type: 'AirVehicle',
      name: 'Drone-Route-Now',
      route: {
        start_time: 'now',
        waypoints: [
          { latitude: 34.25, longitude: -117.1, altitude: 1200 },
          { latitude: 34.26, longitude: -117.11, altitude: 1250, offset: 30 },
        ]
      }
    })

    const createdVehicle = universe.addAirVehicle.mock.results[0].value
    expect(createdVehicle.setWaypointRoute).toHaveBeenCalledTimes(1)
    const route = createdVehicle.setWaypointRoute.mock.calls[0][0]
    expect(route.startTime).toBeInstanceOf(JulianDate)
    expect(JulianDate.toDate(route.startTime).toISOString()).toBe('2024-01-01T00:00:00.000Z')
  })

  test('removes the created vehicle and skips visualization when waypoint route setup fails', () => {
    universe.addAirVehicle.mockImplementationOnce((name, latitude, longitude, altitude, velocityNed, accelerationNed, heading) => ({
      name,
      latitude,
      longitude,
      altitude,
      velocityNed,
      accelerationNed,
      heading: heading ?? 0,
      position: Cartesian3.fromDegrees(longitude, latitude, altitude),
      update: jest.fn(),
      hasWaypointRoute: false,
      waypointRoute: undefined,
      setWaypointRoute: jest.fn(() => {
        throw new Error('bad route')
      }),
    }))

    addScenarioObject(universe, viewer, {
      type: 'AirVehicle',
      name: 'Drone-Bad-Route',
      route: {
        waypoints: [
          { latitude: 34.25, longitude: -117.1, altitude: 1200 },
          { latitude: 34.26, longitude: -117.11, altitude: 1250 },
        ]
      }
    })

    expect(universe.removeObject).toHaveBeenCalledTimes(1)
    expect(viewer.addObjectVisualizer).not.toHaveBeenCalled()
  })
})
