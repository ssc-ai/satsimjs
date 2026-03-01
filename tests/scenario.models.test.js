import { jest } from '@jest/globals'
import { JulianDate } from 'cesium'
import { addScenarioObject } from '../src/scenario/index.js'

describe('scenario generic model support', () => {
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
      addTwoBodySatellite: jest.fn().mockImplementation((name) => ({
        name,
        period: 7200,
        eccentricity: 0.01,
      })),
      addSGP4Satellite: jest.fn().mockImplementation((name) => ({
        name,
        period: 7200,
        eccentricity: 0.01,
      })),
    }
  })

  test('applies model options to two-body satellites', () => {
    addScenarioObject(universe, viewer, {
      type: 'TwoBodySatellite',
      name: 'TwoBody-Model',
      position: [7000000, 0, 0],
      velocity: [0, 7800, 0],
      epoch: '2024-01-01T00:00:00Z',
      model: './Satellite.glb',
    })

    expect(viewer.addObjectVisualizer).toHaveBeenCalledTimes(1)
    const options = viewer.addObjectVisualizer.mock.calls[0][2]
    expect(options.model.uri).toBe('./Satellite.glb')
    expect(options.model.minimumPixelSize).toBe(64)
    expect(options.model.maximumScale).toBe(20000)
  })

  test('applies model aliases to SGP4 satellites', () => {
    addScenarioObject(universe, viewer, {
      type: 'SGP4Satellite',
      name: 'SGP4-Model',
      tle1: '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753',
      tle2: '2 00005  34.2682 348.7242 1849677 331.7664  19.3264 10.82419157413667',
      model: {
        path: './Sgp4Sat.glb',
        scale: 1.2,
      },
    })

    expect(viewer.addObjectVisualizer).toHaveBeenCalledTimes(1)
    const options = viewer.addObjectVisualizer.mock.calls[0][2]
    expect(options.model.uri).toBe('./Sgp4Sat.glb')
    expect(options.model.path).toBeUndefined()
    expect(options.model.scale).toBeCloseTo(1.2, 8)
    expect(options.model.minimumPixelSize).toBe(64)
    expect(options.model.maximumScale).toBe(20000)
  })

  test('applies catalog-level model to TLE catalog entries', () => {
    addScenarioObject(universe, viewer, {
      type: 'TLECatalog',
      data: [
        'CatalogSat',
        '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753',
        '2 00005  34.2682 348.7242 1849677 331.7664  19.3264 10.82419157413667',
      ].join('\n'),
      model: './CatalogSat.glb',
      limit: 1,
    })

    expect(viewer.addObjectVisualizer).toHaveBeenCalledTimes(1)
    const options = viewer.addObjectVisualizer.mock.calls[0][2]
    expect(options.model.uri).toBe('./CatalogSat.glb')
    expect(options.model.minimumPixelSize).toBe(64)
    expect(options.model.maximumScale).toBe(20000)
  })
})
