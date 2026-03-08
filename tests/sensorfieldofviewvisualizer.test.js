import { jest } from '@jest/globals'

jest.mock('cesium', () => {
  function makeColor(label) {
    return {
      label,
      withAlpha: jest.fn(function withAlpha(alpha) {
        return { label, alpha, withAlpha: this.withAlpha }
      })
    }
  }

  class CallbackProperty {
    constructor(callback, isConstant) {
      this._callback = callback
      this.isConstant = isConstant
    }

    getValue(time, result) {
      return this._callback(time, result)
    }
  }

  class Cartesian3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }

    static clone(value, result) {
      const out = result ?? new Cartesian3()
      out.x = value?.x ?? 0
      out.y = value?.y ?? 0
      out.z = value?.z ?? 0
      return out
    }
  }

  return {
    Color: {
      GREEN: makeColor('green'),
      GRAY: makeColor('gray')
    },
    CallbackProperty,
    Cartesian3,
    Math: {
      toRadians: (value) => value * Math.PI / 180,
      EPSILON1: 0.1
    },
    defined: (value) => value !== undefined && value !== null
  }
})

jest.mock('../src/engine/cesium/utils.js', () => ({
  createObjectPositionProperty: jest.fn(() => ({})),
  createObjectOrientationProperty: jest.fn(() => ({}))
}))

import SensorFieldOfViewVisualizer from '../src/engine/cesium/SensorFieldOfVIewVisualizer.js'

describe('SensorFieldOfViewVisualizer', () => {
  test('reacts to sensor zoom changes through callback-backed ellipsoid angles', () => {
    const viewer = {
      entities: {
        add: jest.fn((value) => value)
      }
    }
    const gimbal = {
      range: 1000,
      update: jest.fn(),
      trackObject: { name: 'Tracked Object' }
    }
    const sensor = {
      name: 'HSV Zoom Sensor',
      x_fov: 5,
      y_fov: 5
    }

    new SensorFieldOfViewVisualizer(viewer, {}, gimbal, sensor, {})

    const entity = viewer.entities.add.mock.calls[0][0]
    const ellipsoid = entity.ellipsoid
    const initialMinimumClock = ellipsoid.minimumClock.getValue()
    const initialMaximumCone = ellipsoid.maximumCone.getValue()

    sensor.x_fov = 0.05
    sensor.y_fov = 0.05

    expect(Math.abs(ellipsoid.minimumClock.getValue())).toBeLessThan(Math.abs(initialMinimumClock))
    expect(ellipsoid.maximumCone.getValue()).toBeLessThan(initialMaximumCone)
  })
})
