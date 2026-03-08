jest.mock('cesium', () => ({
  JulianDate: class JulianDate {}
}))

jest.mock('../src/engine/objects/SimObject.js', () => {
  return jest.fn().mockImplementation(function MockSimObject(name) {
    this.name = name || 'MockSimObject'
    this._referenceFrame = null
    this.position = { x: 0, y: 0, z: 0 }
    this.velocity = { x: 0, y: 0, z: 0 }
    this.visualizer = {}
    this.updateListeners = []
    this.update = jest.fn()
    this._update = jest.fn()
  })
})

import { JulianDate } from 'cesium'
import ElectroOpicalSensor from '../src/engine/objects/ElectroOpticalSensor.js'
import Laser from '../src/engine/objects/Laser.js'

describe('Laser', () => {
  test('constructs as an EO-style placeholder with laser metadata', () => {
    const fieldOfRegard = [{ clock: [0, 360], elevation: [10, 90] }]
    const laser = new Laser({
      name: 'HSV HEL',
      beam_diameter: 0.05,
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
    expect(laser.beamDiameter).toBe(0.05)
    expect(laser.power).toBe(50000)
    expect(laser.active).toBe(true)
    expect(laser.maxRange).toBe(6000)
    expect(laser.beamLength).toBe(0)
    expect(laser.isColliding).toBe(false)
    expect(laser.color).toBe('#ff0000')
  })

  test('uses the same placeholder update behavior as the EO sensor', () => {
    const laser = new Laser({ max_range: 6000, active: true })
    const time = new JulianDate()

    expect(() => laser._update(time, {})).not.toThrow()
    expect(laser.beamLength).toBe(0)
    expect(laser.isColliding).toBe(false)
  })

  test('uses EO defaults when optional placeholder fields are omitted', () => {
    const laser = new Laser()

    expect(laser.name).toBe('Laser')
    expect(laser.x_fov).toBe(0.001)
    expect(laser.y_fov).toBe(0.001)
    expect(laser.field_of_regard).toEqual([])
    expect(laser.height).toBe(100)
    expect(laser.width).toBe(100)
    expect(laser.active).toBe(false)
  })
})
