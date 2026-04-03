import FastSteeringMirror from '../src/engine/objects/FastSteeringMirror.js'
import Gimbal from '../src/engine/objects/Gimbal.js'
import SimObject from '../src/engine/objects/SimObject.js'
import Universe from '../src/engine/Universe.js'
import { JulianDate, Math as CMath } from 'cesium'

jest.mock('../src/engine/Universe.js')

describe('FastSteeringMirror', () => {
  let fsm
  let mockUniverse
  let testTime

  beforeEach(() => {
    fsm = new FastSteeringMirror()
    mockUniverse = new Universe()
    testTime = new JulianDate()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('creates a FastSteeringMirror with defaults', () => {
      expect(fsm.name).toBe('FastSteeringMirror')
      expect(fsm.type).toBe('FastSteeringMirror')
      expect(fsm.tip).toBe(0)
      expect(fsm.tilt).toBe(0)
      expect(fsm).toBeInstanceOf(Gimbal)
      expect(fsm).toBeInstanceOf(SimObject)
    })

    it('accepts a custom name', () => {
      expect(new FastSteeringMirror('OBS FSM').name).toBe('OBS FSM')
    })
  })

  describe('_update', () => {
    beforeEach(() => {
      fsm.reset = jest.fn()
      fsm.rotateY = jest.fn()
      fsm.rotateX = jest.fn()
    })

    it('applies doubled optical deflection to tip and tilt', () => {
      fsm.tip = 1.5
      fsm.tilt = -2

      fsm._update(testTime, mockUniverse)

      expect(fsm.reset).toHaveBeenCalled()
      expect(fsm.rotateY).toHaveBeenCalledWith(-3 * CMath.RADIANS_PER_DEGREE)
      expect(fsm.rotateX).toHaveBeenCalledWith(-4 * CMath.RADIANS_PER_DEGREE)
    })

    it('uses axis targets when present', () => {
      fsm.setAxisTarget('tip', 2)
      fsm.setAxisTarget('tilt', 3)

      fsm._update(testTime, mockUniverse)

      expect(fsm.tip).toBe(2)
      expect(fsm.tilt).toBe(3)
      expect(fsm.rotateY).toHaveBeenCalledWith(-4 * CMath.RADIANS_PER_DEGREE)
      expect(fsm.rotateX).toHaveBeenCalledWith(6 * CMath.RADIANS_PER_DEGREE)
    })

    it('slews toward commanded axes when slew rates are configured', () => {
      fsm.setAxisSlewRates({
        tip: { maxRateDegPerSec: 10, maxAccelDegPerSec2: 20 },
        tilt: { maxRateDegPerSec: 10, maxAccelDegPerSec2: 20 }
      })
      fsm.tip = 0
      fsm.tilt = 0
      fsm.setAxisTarget('tip', 20)
      fsm.setAxisTarget('tilt', -20)

      fsm._update(testTime, mockUniverse)
      const t2 = JulianDate.addSeconds(testTime, 1, new JulianDate())
      fsm._update(t2, mockUniverse)

      expect(fsm.tip).toBeGreaterThan(0)
      expect(fsm.tip).toBeLessThan(20)
      expect(fsm.tilt).toBeLessThan(0)
      expect(fsm.tilt).toBeGreaterThan(-20)
    })
  })
})
