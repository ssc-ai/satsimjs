import { jest } from '@jest/globals'
import { addScenarioObject } from '../src/scenario/index.js'

describe('scenario observatory model support', () => {
  let viewer
  let universe
  let observatory

  beforeEach(() => {
    observatory = {
      site: { name: 'HSV Laser Test Range' },
      gimbal: { name: 'Gimbal' },
      sensor: { name: 'Sensor' },
    }

    viewer = {
      addObservatoryVisualizer: jest.fn(),
    }

    universe = {
      hasObject: jest.fn().mockReturnValue(false),
      addGroundElectroOpticalObservatory: jest.fn().mockReturnValue(observatory),
    }
  })

  test('accepts string model entries and applies default model options', () => {
    addScenarioObject(universe, viewer, {
      type: 'GroundEOObservatory',
      name: 'HSV Laser Test Range',
      latitude: 34.6707,
      longitude: -86.6508,
      altitude: 5,
      height: 2048,
      width: 2048,
      y_fov: 1,
      x_fov: 1,
      model: './GroundVehicle.glb',
    })

    expect(viewer.addObservatoryVisualizer).toHaveBeenCalledTimes(1)
    const options = viewer.addObservatoryVisualizer.mock.calls[0][2]
    expect(options.model.uri).toBe('./GroundVehicle.glb')
    expect(options.model.minimumPixelSize).toBe(64)
    expect(options.model.maximumScale).toBe(20000)
  })

  test('accepts object model entries with aliases and preserves Cesium model keys', () => {
    addScenarioObject(universe, viewer, {
      type: 'observatory',
      name: 'HSV Laser Test Range',
      latitude: 34.6707,
      longitude: -86.6508,
      altitude: 5,
      height: 2048,
      width: 2048,
      y_fov: 1,
      x_fov: 1,
      model: {
        path: './GroundVehicle.glb',
        scale: 1.25,
        minimumPixelSize: 0,
        vertical_offset_m: 1.5,
      },
    })

    expect(viewer.addObservatoryVisualizer).toHaveBeenCalledTimes(1)
    const options = viewer.addObservatoryVisualizer.mock.calls[0][2]
    expect(options.model.uri).toBe('./GroundVehicle.glb')
    expect(options.model.path).toBeUndefined()
    expect(options.model.vertical_offset_m).toBeUndefined()
    expect(options.model.scale).toBeCloseTo(1.25, 8)
    expect(options.model.minimumPixelSize).toBe(0)
    expect(options.model.maximumScale).toBe(20000)
    expect(options.modelVerticalOffsetMeters).toBeCloseTo(1.5, 8)
  })

  test('keeps non-modeled observatory behavior unchanged', () => {
    addScenarioObject(universe, viewer, {
      type: 'groundeo',
      name: 'HSV Laser Test Range',
      latitude: 34.6707,
      longitude: -86.6508,
      altitude: 5,
      height: 2048,
      width: 2048,
      y_fov: 1,
      x_fov: 1,
    })

    expect(viewer.addObservatoryVisualizer).toHaveBeenCalledTimes(1)
    expect(viewer.addObservatoryVisualizer.mock.calls[0][2]).toBeUndefined()
  })
})
