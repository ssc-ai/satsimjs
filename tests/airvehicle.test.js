import { jest } from '@jest/globals'
import { Cartesian3, JulianDate, ReferenceFrame } from 'cesium'
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
})
