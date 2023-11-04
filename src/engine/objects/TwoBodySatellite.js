import { vallado, rv2p, rv2ecc } from '../dynamics/twobody.js'
import { Cartesian3, JulianDate, ReferenceFrame } from 'cesium'
import { Math as CMath } from 'cesium'
import SimObject from './SimObject.js'

const K_KM = CMath.GRAVITATIONALPARAMETER / 1e9

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
    const positionKm = Cartesian3.multiplyByScalar(position, 1e-3, new Cartesian3())
    const velocityKm = Cartesian3.multiplyByScalar(velocity, 1e-3, new Cartesian3())
    this._epoch = { positionKm, velocityKm, time }
    this._period = rv2p(K_KM, positionKm, velocityKm)
    this._eccentricity = rv2ecc(K_KM, positionKm, velocityKm)
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
    let positionAndVelocity = vallado(K_KM, this._epoch.positionKm, this._epoch.velocityKm, deltaSec, 350)

    Cartesian3.multiplyByScalar(positionAndVelocity.position, 1000.0, this._position)
    Cartesian3.multiplyByScalar(positionAndVelocity.velocity, 1000.0, this._velocity)
  }
}

export default TwoBodySatellite
