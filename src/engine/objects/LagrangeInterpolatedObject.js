import { JulianDate } from 'cesium'
import { lagrange } from '../dynamics/lagrange.js'
import SimObject from './SimObject.js'
import Universe from '../Universe.js'

/**
 * A class representing a Lagrange interpolated object.
 * @extends SimObject
 */
class LagrangeInterpolatedObject extends SimObject {
  /**
   * Create a LagrangeInterpolatedObject.
   * @param {Object} object - The object to interpolate.
   */
  constructor(object) {
    super(object.name, object.referenceFrame)
    this._object = object
    this._times = []
    this._positions = []
    this._interval = (this.period / 60.0) ?? 100
    this._epoch = new JulianDate()
  }

  /**
   * The period of the object.
   * @type {Number}
   */
  get period() {
    return this._object.period
  }

  /**
   * The eccentricity of the object.
   * @type {Number}
   */
  get eccentricity() {
    return this._object.eccentricity
  }

  /**
   * Update the object's position.
   * @param {JulianDate} time - The time to update the position for.
   * @param {Universe} universe - The universe object.
   * @override
   */
  _update(time, universe) {
    const that = this
    const f = function(t) {
      that._object.update(t, universe)
      return that._object.position
    }

    lagrange(this._times, this._positions, this._epoch, time, f, this._position, this._interval)
  }
}

export default LagrangeInterpolatedObject
