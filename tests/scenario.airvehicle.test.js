import { jest } from '@jest/globals'
import { Cartesian3, Color, JulianDate } from 'cesium'
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
      addAirVehicle: jest.fn().mockImplementation((name, latitude, longitude, altitude, velocityNed, accelerationNed, heading) => ({
        name,
        latitude,
        longitude,
        altitude,
        velocityNed,
        accelerationNed,
        heading,
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

  test('skips invalid air vehicle definitions without coordinates', () => {
    addScenarioObject(universe, viewer, {
      type: 'uav',
      name: 'BadDrone',
      velocity_ned: [10, 0, 0],
    })

    expect(universe.addAirVehicle).not.toHaveBeenCalled()
    expect(viewer.addObjectVisualizer).not.toHaveBeenCalled()
  })
})
