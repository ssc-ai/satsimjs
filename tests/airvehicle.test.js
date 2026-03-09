import { jest } from '@jest/globals'
import { Cartesian3, Cartographic, EllipsoidGeodesic, JulianDate, ReferenceFrame } from 'cesium'
import AirVehicle from '../src/engine/objects/AirVehicle.js'

const EARTH_ANGULAR_SPEED = 7.292115146706979e-5

describe('AirVehicle', () => {
  let epoch

  beforeEach(() => {
    epoch = JulianDate.fromDate(new Date('2024-01-01T00:00:00Z'))
  })

  test('creates an Earth-fixed air vehicle from geodetic state', () => {
    const vehicle = new AirVehicle(
      34.25,
      -117.1,
      1200,
      new Cartesian3(45, 5, 0),
      new Cartesian3(0, 0, 0),
      90,
      epoch,
      'Drone-1'
    )

    expect(vehicle.name).toBe('Drone-1')
    expect(vehicle.referenceFrame).toBe(ReferenceFrame.FIXED)
    expect(vehicle.latitude).toBeCloseTo(34.25, 8)
    expect(vehicle.longitude).toBeCloseTo(-117.1, 8)
    expect(vehicle.altitude).toBeCloseTo(1200, 8)
    expect(Cartesian3.magnitude(vehicle.position)).toBeGreaterThan(6e6)
  })

  test('propagates latitude/longitude with NED velocity', () => {
    const vehicle = new AirVehicle(
      0,
      0,
      1000,
      new Cartesian3(100, 50, 0),
      new Cartesian3(0, 0, 0),
      undefined,
      epoch,
      'Drone-2'
    )

    const t1 = JulianDate.addSeconds(epoch, 10, new JulianDate())
    vehicle.update(t1, {})

    expect(vehicle.latitude).toBeGreaterThan(0)
    expect(vehicle.longitude).toBeGreaterThan(0)
    expect(vehicle.altitude).toBeCloseTo(1000, 8)
  })

  test('updates velocity with constant acceleration', () => {
    const vehicle = new AirVehicle(
      10,
      20,
      500,
      new Cartesian3(10, 0, 0),
      new Cartesian3(1.5, -0.5, 0.2),
      undefined,
      epoch,
      'Drone-3'
    )

    const t1 = JulianDate.addSeconds(epoch, 4, new JulianDate())
    vehicle.update(t1, {})

    expect(vehicle.velocityNed.x).toBeCloseTo(16, 8)
    expect(vehicle.velocityNed.y).toBeCloseTo(-2, 8)
    expect(vehicle.velocityNed.z).toBeCloseTo(0.8, 8)
  })

  test('auto heading follows horizontal velocity when heading is not specified', () => {
    const vehicle = new AirVehicle(
      0,
      0,
      0,
      new Cartesian3(0, 80, 0),
      new Cartesian3(0, 0, 0),
      undefined,
      epoch
    )

    expect(vehicle.heading).toBeCloseTo(90, 8)
  })

  test('explicit heading remains fixed while kinematics update', () => {
    const vehicle = new AirVehicle(
      0,
      0,
      0,
      new Cartesian3(0, 80, 0),
      new Cartesian3(0, 0, 0),
      15,
      epoch
    )

    const t1 = JulianDate.addSeconds(epoch, 30, new JulianDate())
    vehicle.update(t1, {})
    expect(vehicle.heading).toBeCloseTo(15, 8)
  })

  test('worldVelocity includes Earth rotation and fixed-frame motion', () => {
    const vehicle = new AirVehicle(
      0,
      0,
      0,
      new Cartesian3(60, 0, 0),
      new Cartesian3(0, 0, 0),
      undefined,
      epoch
    )

    const mockParent = {
      update: jest.fn(),
      transformVectorToWorld: jest.fn((v, result = new Cartesian3()) => Cartesian3.clone(v, result))
    }
    vehicle.parent = mockParent
    vehicle.update(epoch, {})

    const worldVelocity = vehicle.worldVelocity
    const cross = Cartesian3.cross(new Cartesian3(0, 0, EARTH_ANGULAR_SPEED), vehicle.position, new Cartesian3())
    const expected = Cartesian3.add(vehicle.velocity, cross, new Cartesian3())

    expect(mockParent.transformVectorToWorld).toHaveBeenCalled()
    expect(worldVelocity.x).toBeCloseTo(expected.x, 8)
    expect(worldVelocity.y).toBeCloseTo(expected.y, 8)
    expect(worldVelocity.z).toBeCloseTo(expected.z, 8)
  })

  test('state is deterministic for non-monotonic time queries', () => {
    const vehicle = new AirVehicle(
      34,
      -86,
      1000,
      new Cartesian3(30, 15, -0.5),
      new Cartesian3(0.2, -0.1, 0.02),
      undefined,
      epoch
    )

    const t30 = JulianDate.addSeconds(epoch, 30, new JulianDate())
    const t10 = JulianDate.addSeconds(epoch, 10, new JulianDate())

    vehicle.update(t30, {})
    const latAt30First = vehicle.latitude
    const lonAt30First = vehicle.longitude
    const altAt30First = vehicle.altitude
    const velAt30First = Cartesian3.clone(vehicle.velocityNed)

    // Query a different time in-between, as Cesium path sampling does.
    vehicle.update(t10, {})
    vehicle.update(t30, {})

    expect(vehicle.latitude).toBeCloseTo(latAt30First, 12)
    expect(vehicle.longitude).toBeCloseTo(lonAt30First, 12)
    expect(vehicle.altitude).toBeCloseTo(altAt30First, 9)
    expect(vehicle.velocityNed.x).toBeCloseTo(velAt30First.x, 12)
    expect(vehicle.velocityNed.y).toBeCloseTo(velAt30First.y, 12)
    expect(vehicle.velocityNed.z).toBeCloseTo(velAt30First.z, 12)
  })

  test('supports absolute-time waypoint traversal', () => {
    const vehicle = new AirVehicle(0, 0, 100, new Cartesian3(), new Cartesian3(), undefined, epoch, 'Route-Absolute')
    vehicle.setWaypointRoute({
      startTime: epoch,
      waypoints: [
        { lat: 0, lon: 0, alt: 100 },
        { lat: 0, lon: 1, alt: 200, offsetSec: 20 },
        { lat: 1, lon: 1, alt: 300, time: JulianDate.addSeconds(epoch, 50, new JulianDate()) },
      ]
    }, epoch)

    vehicle.update(JulianDate.addSeconds(epoch, 10, new JulianDate()), {})
    expect(vehicle.latitude).toBeCloseTo(0, 6)
    expect(vehicle.longitude).toBeCloseTo(0.5, 3)
    expect(vehicle.altitude).toBeCloseTo(150, 6)

    vehicle.update(JulianDate.addSeconds(epoch, 35, new JulianDate()), {})
    expect(vehicle.latitude).toBeCloseTo(0.5, 3)
    expect(vehicle.longitude).toBeCloseTo(1, 3)
    expect(vehicle.altitude).toBeCloseTo(250, 6)
  })

  test('supports speed-derived waypoint traversal', () => {
    const vehicle = new AirVehicle(0, 0, 0, new Cartesian3(), new Cartesian3(), undefined, epoch, 'Route-Speed')
    vehicle.setWaypointRoute({
      startTime: epoch,
      defaultSpeedMps: 100,
      waypoints: [
        { lat: 0, lon: 0, alt: 0 },
        { lat: 0, lon: 0.001, alt: 0 },
      ]
    }, epoch)

    const route = vehicle.waypointRoute
    const durationSec = JulianDate.secondsDifference(route.waypoints[1].time, route.waypoints[0].time)
    const distanceM = new EllipsoidGeodesic(
      Cartographic.fromDegrees(0, 0, 0),
      Cartographic.fromDegrees(0.001, 0, 0)
    ).surfaceDistance

    expect(durationSec).toBeCloseTo(distanceM / 100, 6)

    vehicle.update(JulianDate.addSeconds(epoch, durationSec / 2, new JulianDate()), {})
    expect(vehicle.longitude).toBeCloseTo(0.0005, 4)
    expect(vehicle.heading).toBeCloseTo(90, 3)
  })

  test('supports mixed timing rules in one waypoint route', () => {
    const vehicle = new AirVehicle(0, 0, 0, new Cartesian3(), new Cartesian3(), undefined, epoch, 'Route-Mixed')
    vehicle.setWaypointRoute({
      startTime: epoch,
      defaultSpeedMps: 50,
      waypoints: [
        { lat: 0, lon: 0, alt: 0 },
        { lat: 0, lon: 0.001, alt: 50, offsetSec: 10 },
        { lat: 0.001, lon: 0.001, alt: 100 },
      ]
    }, epoch)

    const route = vehicle.waypointRoute
    expect(JulianDate.secondsDifference(route.waypoints[1].time, route.waypoints[0].time)).toBeCloseTo(10, 9)
    expect(JulianDate.secondsDifference(route.waypoints[2].time, route.waypoints[1].time)).toBeGreaterThan(2)
    expect(route.mode).toBe('once')
    expect(route.waypoints).toHaveLength(3)
  })

  test('holds the first waypoint before route start time', () => {
    const startTime = JulianDate.addSeconds(epoch, 30, new JulianDate())
    const vehicle = new AirVehicle(10, 20, 5, new Cartesian3(20, 0, 0), new Cartesian3(), undefined, epoch, 'Route-PreStart')
    vehicle.setWaypointRoute({
      startTime,
      waypoints: [
        { lat: 1, lon: 2, alt: 30 },
        { lat: 1, lon: 3, alt: 30, offsetSec: 20 },
      ]
    }, epoch)

    vehicle.update(epoch, {})
    expect(vehicle.latitude).toBeCloseTo(1, 8)
    expect(vehicle.longitude).toBeCloseTo(2, 8)
    expect(vehicle.altitude).toBeCloseTo(30, 8)
    expect(vehicle.velocityNed.x).toBeCloseTo(0, 8)
    expect(vehicle.velocityNed.y).toBeCloseTo(0, 8)
    expect(vehicle.velocityNed.z).toBeCloseTo(0, 8)
  })

  test('holds the final waypoint after a once route ends', () => {
    const vehicle = new AirVehicle(0, 0, 0, new Cartesian3(), new Cartesian3(), undefined, epoch, 'Route-Once')
    vehicle.setWaypointRoute({
      startTime: epoch,
      waypoints: [
        { lat: 0, lon: 0, alt: 0 },
        { lat: 0, lon: 1, alt: 50, offsetSec: 20 },
      ]
    }, epoch)

    vehicle.update(JulianDate.addSeconds(epoch, 40, new JulianDate()), {})
    expect(vehicle.latitude).toBeCloseTo(0, 8)
    expect(vehicle.longitude).toBeCloseTo(1, 8)
    expect(vehicle.altitude).toBeCloseTo(50, 8)
    expect(vehicle.velocityNed.x).toBeCloseTo(0, 8)
    expect(vehicle.velocityNed.y).toBeCloseTo(0, 8)
    expect(vehicle.velocityNed.z).toBeCloseTo(0, 8)
  })

  test('supports pingpong mode by reversing the same legs', () => {
    const vehicle = new AirVehicle(0, 0, 0, new Cartesian3(), new Cartesian3(), undefined, epoch, 'Route-PingPong')
    vehicle.setWaypointRoute({
      startTime: epoch,
      mode: 'pingpong',
      waypoints: [
        { lat: 0, lon: 0, alt: 0 },
        { lat: 0, lon: 1, alt: 0, offsetSec: 20 },
      ]
    }, epoch)

    vehicle.update(JulianDate.addSeconds(epoch, 30, new JulianDate()), {})
    expect(vehicle.longitude).toBeCloseTo(0.5, 3)
  })

  test('supports loop mode using the route default speed for the closing leg', () => {
    const vehicle = new AirVehicle(0, 0, 0, new Cartesian3(), new Cartesian3(), undefined, epoch, 'Route-Loop')
    vehicle.setWaypointRoute({
      startTime: epoch,
      mode: 'loop',
      defaultSpeedMps: 100,
      waypoints: [
        { lat: 0, lon: 0, alt: 0 },
        { lat: 0, lon: 0.001, alt: 0, offsetSec: 10 },
      ]
    }, epoch)

    const closingDistanceM = new EllipsoidGeodesic(
      Cartographic.fromDegrees(0.001, 0, 0),
      Cartographic.fromDegrees(0, 0, 0)
    ).surfaceDistance
    const closingDurationSec = closingDistanceM / 100
    vehicle.update(JulianDate.addSeconds(epoch, 10 + closingDurationSec / 2, new JulianDate()), {})
    expect(vehicle.longitude).toBeCloseTo(0.0005, 4)
  })

  test('takes the shortest path across the dateline', () => {
    const vehicle = new AirVehicle(0, 179, 0, new Cartesian3(), new Cartesian3(), undefined, epoch, 'Route-Dateline')
    vehicle.setWaypointRoute({
      startTime: epoch,
      waypoints: [
        { lat: 0, lon: 179, alt: 0 },
        { lat: 0, lon: -179, alt: 0, offsetSec: 20 },
      ]
    }, epoch)

    vehicle.update(JulianDate.addSeconds(epoch, 10, new JulianDate()), {})
    expect(Math.abs(Math.abs(vehicle.longitude) - 180)).toBeLessThan(0.5)
  })

  test('auto heading follows waypoint motion while explicit heading remains fixed', () => {
    const autoVehicle = new AirVehicle(0, 0, 0, new Cartesian3(), new Cartesian3(), undefined, epoch, 'Route-AutoHeading')
    autoVehicle.setWaypointRoute({
      startTime: epoch,
      waypoints: [
        { lat: 0, lon: 0, alt: 0 },
        { lat: 0, lon: 1, alt: 0, offsetSec: 20 },
      ]
    }, epoch)
    autoVehicle.update(JulianDate.addSeconds(epoch, 5, new JulianDate()), {})
    expect(autoVehicle.heading).toBeCloseTo(90, 3)

    const fixedHeadingVehicle = new AirVehicle(0, 0, 0, new Cartesian3(), new Cartesian3(), 15, epoch, 'Route-FixedHeading')
    fixedHeadingVehicle.setWaypointRoute({
      startTime: epoch,
      waypoints: [
        { lat: 0, lon: 0, alt: 0 },
        { lat: 0, lon: 1, alt: 0, offsetSec: 20 },
      ]
    }, epoch)
    fixedHeadingVehicle.update(JulianDate.addSeconds(epoch, 5, new JulianDate()), {})
    expect(fixedHeadingVehicle.heading).toBeCloseTo(15, 8)
  })

  test('remains deterministic for non-monotonic waypoint queries', () => {
    const vehicle = new AirVehicle(0, 0, 0, new Cartesian3(), new Cartesian3(), undefined, epoch, 'Route-Deterministic')
    vehicle.setWaypointRoute({
      startTime: epoch,
      mode: 'pingpong',
      waypoints: [
        { lat: 0, lon: 0, alt: 0 },
        { lat: 0, lon: 1, alt: 100, offsetSec: 20 },
        { lat: 1, lon: 1, alt: 200, offsetSec: 20 },
      ]
    }, epoch)

    const t30 = JulianDate.addSeconds(epoch, 30, new JulianDate())
    const t10 = JulianDate.addSeconds(epoch, 10, new JulianDate())
    vehicle.update(t30, {})
    const firstLon = vehicle.longitude
    const firstLat = vehicle.latitude
    const firstAlt = vehicle.altitude

    vehicle.update(t10, {})
    vehicle.update(t30, {})
    expect(vehicle.longitude).toBeCloseTo(firstLon, 12)
    expect(vehicle.latitude).toBeCloseTo(firstLat, 12)
    expect(vehicle.altitude).toBeCloseTo(firstAlt, 12)
  })

  test('clears an active route when manual velocity is set', () => {
    const vehicle = new AirVehicle(0, 0, 0, new Cartesian3(), new Cartesian3(), undefined, epoch, 'Route-ManualOverride')
    vehicle.setWaypointRoute({
      startTime: epoch,
      waypoints: [
        { lat: 0, lon: 0, alt: 0 },
        { lat: 0, lon: 1, alt: 0, offsetSec: 20 },
      ]
    }, epoch)

    const overrideTime = JulianDate.addSeconds(epoch, 10, new JulianDate())
    vehicle.update(overrideTime, {})
    const lonAtOverride = vehicle.longitude

    vehicle.velocityNed = new Cartesian3(50, 0, 0)
    expect(vehicle.hasWaypointRoute).toBe(false)
    expect(vehicle.longitude).toBeCloseTo(lonAtOverride, 12)

    vehicle.update(JulianDate.addSeconds(overrideTime, 10, new JulianDate()), {})
    expect(vehicle.latitude).toBeGreaterThan(0)
  })
})
