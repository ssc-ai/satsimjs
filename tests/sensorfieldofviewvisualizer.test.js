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
  Cartesian3.UNIT_X = new Cartesian3(1, 0, 0)
  Cartesian3.UNIT_Y = new Cartesian3(0, 1, 0)

  class ConstantPositionProperty {
    constructor(value, referenceFrame) {
      this.value = value
      this.referenceFrame = referenceFrame
    }
  }

  class ConstantProperty {
    constructor(value) {
      this.value = value
    }

    getValue() {
      return this.value
    }
  }

  class Matrix3 {
    constructor(...values) {
      values.forEach((value, index) => {
        this[index] = value
      })
    }
  }

  class Quaternion {
    static fromRotationMatrix(matrix, result = new Quaternion()) {
      result.matrix = matrix
      return result
    }
  }

  return {
    ArcType: {
      NONE: 'NONE'
    },
    Color: {
      GREEN: makeColor('green'),
      GRAY: makeColor('gray')
    },
    CallbackProperty,
    Cartesian3,
    ConstantPositionProperty,
    ConstantProperty,
    Math: {
      toRadians: (value) => value * Math.PI / 180,
      EPSILON1: 0.1
    },
    Matrix3,
    Quaternion,
    ReferenceFrame: {
      FIXED: 'FIXED'
    },
    defined: (value) => value !== undefined && value !== null
  }
})

jest.mock('../src/engine/cesium/utils.js', () => ({
  createObjectPositionProperty: jest.fn((sensor) => ({ kind: 'position', sensor })),
  createObjectOrientationProperty: jest.fn((sensor) => ({ kind: 'orientation', sensor }))
}))

import SensorFieldOfViewVisualizer from '../src/engine/cesium/SensorFieldOfVIewVisualizer.js'
import { Cartesian3 } from 'cesium'
import {
  createObjectOrientationProperty,
  createObjectPositionProperty
} from '../src/engine/cesium/utils.js'

describe('SensorFieldOfViewVisualizer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

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
      y_fov: 5,
      canZoom: true,
      zoom: {
        max_x_fov: 5,
        max_y_fov: 5
      }
    }

    new SensorFieldOfViewVisualizer(viewer, {}, gimbal, sensor, {})

    const entity = viewer.entities.add.mock.calls[0][0]
    const ellipsoid = entity.ellipsoid
    const initialMaximumClock = ellipsoid.maximumClock.getValue()
    const initialMaximumCone = ellipsoid.maximumCone.getValue()

    sensor.x_fov = 0.05
    sensor.y_fov = 0.05

    expect(ellipsoid.minimumClock.getValue()).toBeCloseTo(0.001 * Math.PI / 180)
    expect(ellipsoid.maximumClock.getValue()).toBeLessThan(initialMaximumClock)
    expect(ellipsoid.maximumCone.getValue()).toBeLessThan(initialMaximumCone)
  })

  test('uses tracked gimbal range and tracking color at runtime', () => {
    const viewer = {
      entities: {
        add: jest.fn((value) => value)
      }
    }
    const gimbal = {
      range: 1000,
      maxRange: 45000000,
      update: jest.fn(),
      trackObject: null
    }
    const sensor = {
      name: 'HSV Range Sensor',
      x_fov: 5,
      y_fov: 5,
      maxRange: 3000000
    }

    new SensorFieldOfViewVisualizer(viewer, {}, gimbal, sensor, {})

    const entity = viewer.entities.add.mock.calls[0][0]
    const radii = entity.ellipsoid.radii
    expect(radii.getValue('t0').x).toBe(3000000)
    expect(entity.ellipsoid.material.label).toBe('gray')

    gimbal.trackObject = { name: 'Tracked Object' }
    gimbal.range = 2500

    expect(radii.getValue('t1').x).toBe(2500)
    expect(entity.ellipsoid.material.label).toBe('green')
    expect(gimbal.update).toHaveBeenCalledWith('t1', {})
  })

  test('keeps pose callback-backed when a gimbal starts fixed', () => {
    const viewer = {
      entities: {
        add: jest.fn((value) => value)
      }
    }
    const gimbal = {
      trackMode: 'fixed',
      trackObject: null,
      range: 1000,
      update: jest.fn()
    }
    const sensor = {
      name: 'Later Tracked Sensor',
      x_fov: 5,
      y_fov: 5,
      parent: gimbal,
      referenceFrame: 'FIXED'
    }

    new SensorFieldOfViewVisualizer(viewer, {}, gimbal, sensor, {})

    const entity = viewer.entities.add.mock.calls[0][0]
    expect(createObjectPositionProperty).toHaveBeenCalledWith(sensor, {}, viewer)
    expect(createObjectOrientationProperty).toHaveBeenCalledWith(sensor, {})
    expect(entity.position).toEqual({ kind: 'position', sensor })
    expect(entity.orientation).toEqual({ kind: 'orientation', sensor })
  })

  test('defaults wide fixed field-of-view to dynamic range and pose', () => {
    const viewer = {
      entities: {
        add: jest.fn((value) => value)
      }
    }
    const gimbal = {
      range: 1000,
      maxRange: 45000000,
      update: jest.fn(),
      trackObject: null
    }
    const sensor = {
      name: 'Wide Survey Sensor',
      x_fov: 20,
      y_fov: 120,
      maxRange: 3000000,
      canZoom: false
    }

    new SensorFieldOfViewVisualizer(viewer, {}, gimbal, sensor, {})

    const entity = viewer.entities.add.mock.calls[0][0]
    const ellipsoid = entity.ellipsoid
    expect(ellipsoid.radii.getValue('t0').x).toBe(3000000)
    expect(typeof ellipsoid.minimumClock.getValue).toBe('undefined')
    expect(typeof ellipsoid.maximumCone.getValue).toBe('undefined')
    expect(ellipsoid.slicePartitions).toBe(8)
    expect(ellipsoid.stackPartitions).toBe(48)
    expect(ellipsoid.innerRadii.x).toBe(0.1)
    expect(ellipsoid.minimumClock).toBeCloseTo(0.001 * Math.PI / 180)
    expect(ellipsoid.maximumClock).toBeCloseTo(20.001 * Math.PI / 180)
    expect(ellipsoid.minimumCone).toBeCloseTo(Math.PI / 6)
    expect(ellipsoid.maximumCone).toBeCloseTo(5 * Math.PI / 6)
  })

  test('applies seam-safe clock geometry to dynamic sensor orientations', () => {
    const viewer = {
      entities: {
        add: jest.fn((value) => value)
      }
    }
    const universe = {
      earth: {
        update: jest.fn()
      }
    }
    const gimbal = {
      range: 1000,
      maxRange: 45000000,
      update: jest.fn(),
      trackObject: null
    }
    const sensor = {
      name: 'Dynamic Survey Sensor',
      x_fov: 20,
      y_fov: 120,
      maxRange: 3000000,
      canZoom: true,
      zoom: {
        max_x_fov: 20,
        max_y_fov: 120
      },
      update: jest.fn(),
      transformVectorTo: jest.fn((_target, vector) => vector)
    }

    new SensorFieldOfViewVisualizer(viewer, {}, gimbal, sensor, universe)

    const entity = viewer.entities.add.mock.calls[0][0]
    const ellipsoid = entity.ellipsoid
    expect(ellipsoid.minimumClock.getValue()).toBeCloseTo(0.001 * Math.PI / 180)
    expect(ellipsoid.maximumClock.getValue()).toBeCloseTo(20.001 * Math.PI / 180)
    expect(entity.orientation.getValue('t0').matrix[4]).toBeCloseTo(Math.cos(10.001 * Math.PI / 180))

    const outline = viewer.entities.add.mock.calls[1][0].polyline
    expect(ellipsoid.outline).toBe(false)
    expect(outline.positions.getValue).toBeInstanceOf(Function)

    sensor.x_fov = 10

    expect(ellipsoid.maximumClock.getValue()).toBeCloseTo(10.001 * Math.PI / 180)
    expect(entity.orientation.getValue('t1').matrix[4]).toBeCloseTo(Math.cos(5.001 * Math.PI / 180))
    expect(createObjectOrientationProperty).not.toHaveBeenCalledWith(sensor, universe)
  })

  test('uses static-fixed render mode for fixed survey sensors', () => {
    const viewer = {
      clock: {
        currentTime: 't0'
      },
      entities: {
        add: jest.fn((value) => value)
      }
    }
    const universe = {
      earth: {
        update: jest.fn()
      }
    }
    const gimbal = {
      range: 1000,
      maxRange: 45000000,
      update: jest.fn(),
      trackObject: null
    }
    const sensor = {
      name: 'Static Survey Sensor',
      x_fov: 20,
      y_fov: 120,
      maxRange: 3000000,
      canZoom: false,
      fieldOfViewRenderMode: 'static-fixed',
      position: new Cartesian3(1, 2, 3),
      update: jest.fn(),
      transformVectorTo: jest.fn((_target, vector) => vector)
    }

    const visualizer = new SensorFieldOfViewVisualizer(viewer, {}, gimbal, sensor, universe)

    expect(viewer.entities.add).toHaveBeenCalledTimes(2)
    const entity = viewer.entities.add.mock.calls[0][0]
    const outlineEntity = viewer.entities.add.mock.calls[1][0]
    const ellipsoid = entity.ellipsoid

    expect(typeof ellipsoid.radii.getValue).toBe('undefined')
    expect(typeof ellipsoid.minimumClock.getValue).toBe('undefined')
    expect(typeof ellipsoid.maximumCone.getValue).toBe('undefined')
    expect(ellipsoid.radii.x).toBe(3000000)
    expect(ellipsoid.innerRadii.x).toBe(300)
    expect(ellipsoid.slicePartitions).toBe(8)
    expect(ellipsoid.stackPartitions).toBe(48)
    expect(ellipsoid.outline).toBe(false)
    expect(ellipsoid.minimumCone).toBeCloseTo(Math.PI / 6)
    expect(ellipsoid.maximumCone).toBeCloseTo(5 * Math.PI / 6)
    expect(ellipsoid.minimumClock).toBeCloseTo(0.001 * Math.PI / 180)
    expect(ellipsoid.maximumClock).toBeCloseTo(20.001 * Math.PI / 180)
    expect(outlineEntity.polyline.positions.length).toBeGreaterThan(0)
    expect(outlineEntity.polyline.arcType).toBe('NONE')
    expect(entity.position.referenceFrame).toBe('FIXED')
    expect(entity.position.value).toEqual({ x: 1, y: 2, z: 3 })
    expect(typeof entity.orientation.getValue).toBe('function')
    expect(entity.orientation.getValue().matrix[4]).toBeCloseTo(Math.cos(10.001 * Math.PI / 180))

    visualizer.fill = false
    expect(ellipsoid.fill).toBe(false)
    visualizer.outline = false
    expect(outlineEntity.polyline.show).toBe(false)
    expect(createObjectPositionProperty).not.toHaveBeenCalledWith(sensor, universe, viewer)
    expect(createObjectOrientationProperty).not.toHaveBeenCalledWith(sensor, universe)
  })

  test('keeps static-fixed inner radii smaller than short ranges', () => {
    const viewer = {
      clock: {
        currentTime: 't0'
      },
      entities: {
        add: jest.fn((value) => value)
      }
    }
    const universe = {
      earth: {
        update: jest.fn()
      }
    }
    const sensor = {
      name: 'Short Range Static Sensor',
      x_fov: 20,
      y_fov: 20,
      maxRange: 1,
      fieldOfViewRenderMode: 'static-fixed',
      position: new Cartesian3(1, 2, 3),
      update: jest.fn(),
      transformVectorTo: jest.fn((_target, vector) => vector)
    }

    new SensorFieldOfViewVisualizer(viewer, {}, {}, sensor, universe)

    viewer.entities.add.mock.calls.filter(([entity]) => entity.ellipsoid).forEach(([entity]) => {
      expect(entity.ellipsoid.innerRadii.x).toBeLessThan(entity.ellipsoid.radii.x)
      expect(entity.ellipsoid.innerRadii.x).toBe(0.5)
    })
  })
})
