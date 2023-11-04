import { sgp4, twoline2satrec } from 'satellite.js'
import { Cartesian3, JulianDate, defined, ReferenceFrame, Math as CMath} from 'cesium'
import SimObject from './SimObject.js'

/**
 * Represents a satellite object that uses the SGP4 model for propagation.
 * @extends SimObject
 */
class SGP4Satellite extends SimObject {
  /**
   * Creates a new SGP4Satellite object.
   * @param {string} tle1 - The first line of the TLE (Two-Line Element) set.
   * @param {string} tle2 - The second line of the TLE (Two-Line Element) set.
   * @param {string} orientation - The orientation of the satellite.
   * @param {string} name - The name of the satellite.
   */
  constructor(tle1, tle2, orientation, name='SGP4Satellite') {
    super(name, ReferenceFrame.INERTIAL)
    this._satrec = twoline2satrec(tle1, tle2)
    this._epoch = new JulianDate(this._satrec.jdsatepoch)
    this._period = CMath.TWO_PI / this._satrec.no * 60
    this._eccentricity = this._satrec.ecco
    this.orientation = orientation //TODO
  }

  /**
   * Updates the position and velocity of the satellite based on the current time and universe.
   * @param {JulianDate} time - The current time.
   * @param {Universe} universe - The universe object.
   * @override
   */
  _update(time, universe) {
    const deltaMin = JulianDate.secondsDifference(time, this._epoch) / 60.0
    const positionAndVelocity = sgp4(this._satrec, deltaMin)

    // check for bad sgp4 propagations
    if(!defined(positionAndVelocity.position) || positionAndVelocity.position === false) {
      positionAndVelocity.position = new Cartesian3()
      positionAndVelocity.velocity = new Cartesian3()
    } else {
      Cartesian3.multiplyByScalar(positionAndVelocity.position, 1000.0, this._position)
      Cartesian3.multiplyByScalar(positionAndVelocity.velocity, 1000.0, this._velocity)  
    }
  }
}

export default SGP4Satellite
