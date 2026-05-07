import { Cartesian3, JulianDate, ReferenceFrame } from 'cesium'

import { createObjectPositionProperty } from '../src/engine/cesium/utils.js'

function makeSampledObject(currentTime, listener) {
  const object = {
    position: new Cartesian3(),
    referenceFrame: ReferenceFrame.FIXED,
    lastUpdate: undefined,
    update: jest.fn((time, universe, forceUpdate, updateParent, notifyListeners = true) => {
      object.position.x = JulianDate.secondsDifference(time, currentTime)
      object.lastUpdate = JulianDate.clone(time, new JulianDate())
      if (notifyListeners) {
        listener.update(time, universe)
      }
    })
  }
  return object
}

describe('Cesium position helpers', () => {
  test('path samples do not move primitive listeners away from viewer clock time', () => {
    const currentTime = JulianDate.fromDate(new Date('2026-04-03T16:00:00Z'))
    const sampleTime = JulianDate.addSeconds(currentTime, 15, new JulianDate())
    const listener = { update: jest.fn() }
    const object = makeSampledObject(currentTime, listener)
    const universe = {}
    const viewer = {
      referenceFrameView: ReferenceFrame.FIXED,
      clock: { currentTime }
    }
    const position = createObjectPositionProperty(object, universe, viewer)

    const result = position.getValue(sampleTime)

    expect(result.x).toBeCloseTo(15, 9)
    expect(listener.update).not.toHaveBeenCalled()
    expect(object.update).toHaveBeenNthCalledWith(1, sampleTime, universe, false, true, false)
    expect(object.update).toHaveBeenNthCalledWith(2, currentTime, universe, true, true, false)
    expect(JulianDate.equals(object.lastUpdate, currentTime)).toBe(true)
  })

  test('current-time position samples keep the existing listener behavior', () => {
    const currentTime = JulianDate.fromDate(new Date('2026-04-03T16:00:00Z'))
    const listener = { update: jest.fn() }
    const object = makeSampledObject(currentTime, listener)
    const universe = {}
    const viewer = {
      referenceFrameView: ReferenceFrame.FIXED,
      clock: { currentTime }
    }
    const position = createObjectPositionProperty(object, universe, viewer)

    const result = position.getValue(currentTime)

    expect(result.x).toBeCloseTo(0, 9)
    expect(listener.update).toHaveBeenCalledTimes(1)
    expect(object.update).toHaveBeenCalledWith(currentTime, universe, false, true, true)
    expect(JulianDate.equals(object.lastUpdate, currentTime)).toBe(true)
  })
})
