import { vallado, rv2period, rv2ecc } from '../dynamics/twobody.js'
import { Cartesian3, JulianDate, ReferenceFrame } from 'cesium'
import { Math as CMath } from 'cesium'
import SimObject from './SimObject.js'

const K = CMath.GRAVITATIONALPARAMETER

/**
 * Represents a two-body satellite object.
 * @extends SimObject
 */
class TwoBodySatellite extends SimObject {
  /**
   * Creates a new TwoBodySatellite object.
   * @param {Cartesian3} position - The initial position of the satellite in meters.
   * @param {Cartesian3} velocity - The initial velocity of the satellite in meters per second.
   * @param {JulianDate} time - The initial time of the satellite.
   * @param {string} orientation - The orientation of the satellite.
   * @param {string} name - The name of the satellite.
   */
  constructor(position, velocity, time, orientation, name='TwoBodySatellite') {
    super(name, ReferenceFrame.INERTIAL)
    position = Cartesian3.clone(position)
    velocity = Cartesian3.clone(velocity)
    time - JulianDate.clone(time)
    this._epoch = { position, velocity, time }
    this._period = rv2period(K, position, velocity)
    this._eccentricity = rv2ecc(K, position, velocity)
    this.orientation = orientation //TODO
  }

  /**
   * Updates the position and velocity of the satellite at the given time.
   * @param {JulianDate} time - The time to update the satellite to.
   * @param {Universe} universe - The universe object containing gravitational constants and other parameters.
   * @override
   */
  _update(time, universe) {
    let deltaSec = JulianDate.secondsDifference(time, this._epoch.time)
    let rv = vallado(K, this._epoch.position, this._epoch.velocity, deltaSec, 350)

    Cartesian3.clone(rv.position, this._position)
    Cartesian3.clone(rv.velocity, this._velocity)
  }
}

export default TwoBodySatellite
