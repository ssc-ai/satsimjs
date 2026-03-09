jest.mock('cesium', () => {
  class JulianDate {}
  class Cartesian3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }
  }

  Cartesian3.ZERO = new Cartesian3(0, 0, 0)

  return {
    JulianDate,
    Cartesian3
  }
})

jest.mock('../src/engine/objects/SimObject.js', () => {
  return jest.fn().mockImplementation(function MockSimObject(name) {
    this.name = name || 'MockSimObject'
    this._referenceFrame = null
    this.position = { x: 0, y: 0, z: 0 }
    this.velocity = { x: 0, y: 0, z: 0 }
    this.visualizer = {}
    this.updateListeners = []
    this.update = jest.fn()
  })
})

import { JulianDate, Cartesian3 } from 'cesium'
import ElectroOpicalSensor from '../src/engine/objects/ElectroOpticalSensor.js'
import Laser from '../src/engine/objects/Laser.js'

describe('Laser', () => {
  function makeTarget(localPosition, collisionRadius) {
    const target = {
      update: jest.fn(),
      transformPointTo: jest.fn((destination, localPoint, result) => {
        result.x = localPosition.x
        result.y = localPosition.y
        result.z = localPosition.z
        return result
      })
    }

    if (collisionRadius !== undefined) {
      target.collisionRadius = collisionRadius
    }

    return target
  }

  test('constructs as an EO-style laser payload with metadata', () => {
    const fieldOfRegard = [{ clock: [0, 360], elevation: [10, 90] }]
    const laser = new Laser({
      name: 'HSV HEL',
      beam_divergence: 0.01,
      power: 50000,
      active: true,
      max_range: 6000,
      x_fov: 1,
      y_fov: 2,
      field_of_regard: fieldOfRegard,
      color: '#ff0000'
    })

    expect(laser).toBeInstanceOf(ElectroOpicalSensor)
    expect(laser.name).toBe('HSV HEL')
    expect(laser.type).toBe('Laser')
    expect(laser.height).toBe(100)
    expect(laser.width).toBe(100)
    expect(laser.x_fov).toBe(1)
    expect(laser.y_fov).toBe(2)
    expect(laser.field_of_regard).toBe(fieldOfRegard)
    expect(laser.beamDivergence).toBe(0.01)
    expect(laser.power).toBe(50000)
    expect(laser.active).toBe(true)
    expect(laser.maxRange).toBe(6000)
    expect(laser.beamLength).toBe(0)
    expect(laser.isColliding).toBe(false)
    expect(laser.color).toBe('#ff0000')
  })

  test('inactive laser hides beam state', () => {
    const laser = new Laser({ max_range: 6000, active: false })
    laser.parent = {}
    const time = new JulianDate()

    expect(() => laser._update(time, { trackables: [makeTarget(new Cartesian3(1, 0, -10), 2)] })).not.toThrow()
    expect(laser.beamLength).toBe(0)
    expect(laser.isColliding).toBe(false)
  })

  test('active hit uses the closest trackable collision in the universe list', () => {
    const laser = new Laser({ max_range: 6000, active: true })
    laser.parent = {}
    const fartherHit = makeTarget(new Cartesian3(1, 0, -20), 2)
    const nearerHit = makeTarget(new Cartesian3(1, 0, -10), 2)

    laser._update(new JulianDate(), { trackables: [fartherHit, nearerHit] })

    expect(laser.beamLength).toBeCloseTo(10 - Math.sqrt(3), 8)
    expect(laser.isColliding).toBe(true)
  })

  test('active miss extends beam to maxRange', () => {
    const laser = new Laser({ max_range: 6000, active: true })
    laser.parent = {}

    laser._update(new JulianDate(), { trackables: [makeTarget(new Cartesian3(3, 0, -10), 2)] })

    expect(laser.beamLength).toBe(6000)
    expect(laser.isColliding).toBe(false)
  })

  test('trackables without a positive collision sphere are ignored', () => {
    const laser = new Laser({ max_range: 6000, active: true })
    laser.parent = {}
    const ignored = makeTarget(new Cartesian3(0, 0, -5), 0)
    const hit = makeTarget(new Cartesian3(1, 0, -10), 2)

    laser._update(new JulianDate(), { trackables: [ignored, hit] })

    expect(laser.beamLength).toBeCloseTo(10 - Math.sqrt(3), 8)
    expect(laser.isColliding).toBe(true)
  })

  test('hits beyond maxRange are treated as misses', () => {
    const laser = new Laser({ max_range: 6000, active: true })
    laser.parent = {}

    laser._update(new JulianDate(), { trackables: [makeTarget(new Cartesian3(1, 0, -7000), 2)] })

    expect(laser.beamLength).toBe(6000)
    expect(laser.isColliding).toBe(false)
  })

  test('uses EO defaults when optional placeholder fields are omitted', () => {
    const laser = new Laser()

    expect(laser.name).toBe('Laser')
    expect(laser.x_fov).toBe(0.01)
    expect(laser.y_fov).toBe(0.01)
    expect(laser.field_of_regard).toEqual([])
    expect(laser.height).toBe(100)
    expect(laser.width).toBe(100)
    expect(laser.beamDivergence).toBe(0.01)
    expect(laser.active).toBe(false)
  })
})
