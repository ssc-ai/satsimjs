import { jest } from '@jest/globals'
import { Cartesian3 } from 'cesium'
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
      sensors: [{ name: 'Sensor' }],
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

  test('accepts object model entries with canonical keys and preserves Cesium model keys', () => {
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
        uri: './GroundVehicle.glb',
        scale: 1.25,
        min_pix_size: 0,
        offset: [0, 0, 1.5],
      },
    })

    expect(viewer.addObservatoryVisualizer).toHaveBeenCalledTimes(1)
    const options = viewer.addObservatoryVisualizer.mock.calls[0][2]
    expect(options.model.uri).toBe('./GroundVehicle.glb')
    expect(options.model.offset).toBeUndefined()
    expect(options.model.scale).toBeCloseTo(1.25, 8)
    expect(options.model.minimumPixelSize).toBe(0)
    expect(options.model.maximumScale).toBe(20000)
    expect(options.model.min_pix_size).toBeUndefined()
    expect(options.offset).toEqual(new Cartesian3(0, 0, 1.5))
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

  test('forwards gimbal_slew_rates into observatory creation', () => {
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
      gimbal_slew_rates: {
        az: { maxRateDegPerSec: 8, maxAccelDegPerSec2: 24 },
        el: 6
      }
    })

    expect(universe.addGroundElectroOpticalObservatory).toHaveBeenCalledTimes(1)
    const [config] = universe.addGroundElectroOpticalObservatory.mock.calls[0]
    expect(config.gimbalSlewRates).toEqual({
      az: { maxRateDegPerSec: 8, maxAccelDegPerSec2: 24 },
      el: { maxRateDegPerSec: 6 }
    })
  })

  test('forwards sensor_max_distance into observatory creation', () => {
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
      sensor_max_distance: 7500
    })

    expect(universe.addGroundElectroOpticalObservatory).toHaveBeenCalledTimes(1)
    const [config] = universe.addGroundElectroOpticalObservatory.mock.calls[0]
    expect(config.sensorMaxDistance).toBe(7500)
  })

  test('normalizes optional FSM config and aliases into observatory creation', () => {
    addScenarioObject(universe, viewer, {
      type: 'GroundEOObservatory',
      name: 'HSV Laser Test Range',
      latitude: 34.6707,
      longitude: -86.6508,
      altitude: 5,
      fsm: {
        tip: 1.5,
        tilt: -2.5,
        slewRates: {
          tip: { maxRateDegPerSec: 20 },
          tilt: { maxRateDegPerSec: 30, maxAccelDegPerSec2: 60 }
        }
      }
    })

    const [config] = universe.addGroundElectroOpticalObservatory.mock.calls[0]
    expect(config.fsm).toEqual({
      name: 'HSV Laser Test Range FSM',
      tip: 1.5,
      tilt: -2.5,
      slewRates: {
        tip: { maxRateDegPerSec: 20 },
        tilt: { maxRateDegPerSec: 30, maxAccelDegPerSec2: 60 }
      }
    })
  })

  test('normalizes single-sensor zoom config aliases into observatory creation', () => {
    addScenarioObject(universe, viewer, {
      type: 'GroundEOObservatory',
      name: 'HSV Laser Test Range',
      latitude: 34.6707,
      longitude: -86.6508,
      altitude: 5,
      height: 2048,
      width: 2048,
      y_fov: 5,
      x_fov: 5,
      zoom: {
        min_x_fov: 0.05,
        max_x_fov: 5,
        min_y_fov: 0.05,
        max_y_fov: 5,
        initial_zoom_level: 0.25
      }
    })

    const [config] = universe.addGroundElectroOpticalObservatory.mock.calls[0]
    expect(config.zoom).toEqual({
      min_x_fov: 0.05,
      max_x_fov: 5,
      min_y_fov: 0.05,
      max_y_fov: 5,
      initial_zoom_level: 0.25
    })
  })

  test('forwards sensors array into observatory creation and preserves legacy aliases', () => {
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
      sensors: [
        {
          name: 'HSV Narrow',
          height: 2048,
          width: 2048,
          y_fov: 1,
          x_fov: 1,
          field_of_regard: [],
          zoom: { min_x_fov: 0.05, max_x_fov: 1, min_y_fov: 0.05, max_y_fov: 1 }
        },
        { name: 'HSV Wide', sensor_height: 1024, sensor_width: 1024, y_fov: 8, x_fov: 8, field_of_regard: [], color: '#ff0000' }
      ]
    })

    const [config] = universe.addGroundElectroOpticalObservatory.mock.calls[0]
    expect(config.height).toBe(2048)
    expect(config.width).toBe(2048)
    expect(config.sensors).toEqual([
      {
        name: 'HSV Narrow',
        type: 'ElectroOpticalSensor',
        height: 2048,
        width: 2048,
        y_fov: 1,
        x_fov: 1,
        field_of_regard: [],
        zoom: { min_x_fov: 0.05, max_x_fov: 1, min_y_fov: 0.05, max_y_fov: 1 }
      },
      { name: 'HSV Wide', type: 'ElectroOpticalSensor', height: 1024, width: 1024, y_fov: 8, x_fov: 8, field_of_regard: [], color: '#ff0000' }
    ])
  })

  test('normalizes laser payload entries inside observatory sensors', () => {
    addScenarioObject(universe, viewer, {
      type: 'GroundEOObservatory',
      name: 'HSV Laser Test Range',
      latitude: 34.6707,
      longitude: -86.6508,
      altitude: 5,
      sensors: [
        {
          type: 'Laser',
          name: 'HSV HEL',
          beam_divergence: 0.05,
          power: 50000,
          active: true,
          max_range: 6000,
          color: '#ff0000'
        }
      ]
    })

    const [config] = universe.addGroundElectroOpticalObservatory.mock.calls[0]
    expect(config.sensors).toEqual([
      {
        type: 'Laser',
        name: 'HSV HEL',
        beamDivergence: 0.05,
        power: 50000,
        active: true,
        maxRange: 6000,
        y_fov: 0.01,
        x_fov: 0.01,
        field_of_regard: [],
        color: '#ff0000'
      }
    ])
  })

  test('does not map deprecated vertical_offset_m to offset', () => {
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
      model: {
        uri: './GroundVehicle.glb',
        vertical_offset_m: 2.5,
      }
    })

    const options = viewer.addObservatoryVisualizer.mock.calls[0][2]
    expect(options.model.vertical_offset_m).toBe(2.5)
    expect(options.offset).toBeUndefined()
  })
})
