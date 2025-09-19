import { jest } from '@jest/globals'
import { Color, JulianDate } from 'cesium'
import { addScenarioObject } from '../src/scenario/index.js'

describe('scenario satellite colors', () => {
  let viewer
  let universe

  beforeEach(() => {
    const now = JulianDate.fromDate(new Date())
    viewer = {
      clock: {
        currentTime: now,
        startTime: JulianDate.fromDate(new Date()),
        stopTime: JulianDate.addSeconds(now, 3600, new JulianDate()),
      },
      addObjectVisualizer: jest.fn(),
    }

    universe = {
      hasObject: jest.fn().mockReturnValue(false),
      addTwoBodySatellite: jest.fn().mockImplementation((name) => ({ name, period: 7200, eccentricity: 0.01 })),
      addSGP4Satellite: jest.fn().mockImplementation((name) => ({ name, period: 7200, eccentricity: 0.01 })),
    }
  })

  test('uses provided RGB array color for two-body satellites', () => {
    addScenarioObject(universe, viewer, {
      type: 'TwoBodySatellite',
      name: 'RGBSat',
      position: [7000000, 0, 0],
      velocity: [0, 7800, 0],
      epoch: '2024-01-01T00:00:00Z',
      color: [255, 128, 0],
    })

    expect(viewer.addObjectVisualizer).toHaveBeenCalledTimes(1)
    const { point, path } = viewer.addObjectVisualizer.mock.calls[0][2]
    const expected = Color.fromBytes(255, 128, 0, 255)
    expect(Color.equals(point.color, expected)).toBe(true)
    expect(Color.equals(point.outlineColor, expected)).toBe(true)
    expect(Color.equals(path.material, expected)).toBe(true)
  })

  test('uses provided CSS color string for SGP4 satellites', () => {
    addScenarioObject(universe, viewer, {
      type: 'SGP4Satellite',
      name: 'CssSat',
      tle1: '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753',
      tle2: '2 00005  34.2682 348.7242 1849677 331.7664  19.3264 10.82419157413667',
      color: '#336699',
    })

    expect(viewer.addObjectVisualizer).toHaveBeenCalledTimes(1)
    const { point, path } = viewer.addObjectVisualizer.mock.calls[0][2]
    const expected = Color.fromCssColorString('#336699')
    expected.alpha = 1.0
    expect(Color.equals(point.color, expected)).toBe(true)
    expect(Color.equals(path.material, expected)).toBe(true)
  })

  test('defaults to random color when none provided', () => {
    const randomColor = new Color(0.25, 0.5, 0.75, 1.0)
    const spy = jest.spyOn(Color, 'fromRandom').mockReturnValue(randomColor)

    try {
      addScenarioObject(universe, viewer, {
        type: 'SGP4Satellite',
        name: 'RandomSat',
        tle1: '1 00000U 00000A   00000.00000000  .00000000  00000-0  00000-0 0  0000',
        tle2: '2 00000   0.0000   0.0000 0000001   0.0000   0.0000  1.00000000    00',
      })

      expect(spy).toHaveBeenCalledTimes(1)
      expect(viewer.addObjectVisualizer).toHaveBeenCalledTimes(1)
      const { point, path } = viewer.addObjectVisualizer.mock.calls[0][2]
      expect(point.color).toBe(randomColor)
      expect(path.material).toBe(randomColor)
    } finally {
      spy.mockRestore()
    }
  })
})
