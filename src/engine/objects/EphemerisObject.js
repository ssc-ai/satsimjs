import { rv2p, rv2ecc } from '../dynamics/twobody.js'
import { JulianDate, ReferenceFrame, Math as CMath} from 'cesium'
import { lagrange_fast } from '../dynamics/lagrange'
import SimObject from './SimObject'

const K = CMath.GRAVITATIONALPARAMETER

/**
 * Represents an object with ephemeris data.
 * @extends SimObject
 */
class EphemerisObject extends SimObject {
  /**
   * Creates an instance of EphemerisObject.
   * @param {JulianDate[]} times - Array of JulianDate objects representing the times of the state vectors.
   * @param {Cartesian3[]} positions - Array of Cartesian3 objects representing the positions of the state vectors.
   * @param {Cartesian3[]} velocities - Array of Cartesian3 objects representing the velocities of the state vectors.
   * @param {string} [name='EphemerisObject'] - Name of the object.
   * @param {ReferenceFrame} [referenceFrame=ReferenceFrame.INERTIAL] - Reference frame of the object.
   */
  constructor(times, positions, velocities, name='EphemerisObject', referenceFrame=ReferenceFrame.INERTIAL) {
    super(name, referenceFrame)

    this._stateVectors = []
    for(let i = 0; i < times.length; i++) {
      this._stateVectors.push({
        time: times[i],
        position: positions[i],
        velocity: velocities[i]
      })
    }
    this._stateVectors.sort((a, b) => JulianDate.compare(a.time, b.time))    

    this._times = []
    this._positions = []
    this._epoch = new JulianDate(this._stateVectors[0].time)

    for(let i = 0; i < this._stateVectors.length; i++) {
      this._times.push(JulianDate.secondsDifference(this._stateVectors[0].time, this._stateVectors[i].time))
      this._positions.push(this._stateVectors[i].position.x)
      this._positions.push(this._stateVectors[i].position.y)
      this._positions.push(this._stateVectors[i].position.z)
    }

    //TODO this needs to be updated when the state vectors are changed
    this._period = rv2p(K, this._stateVectors[0].position, this._stateVectors[0].velocity)
    this._eccentricity = rv2ecc(K, this._stateVectors[0].position, this._stateVectors[0].velocity)
  }

  /**
   * Updates the position of the object at the given time.
   * @param {JulianDate} time - The time to update the position to.
   * @param {Universe} universe - The universe object containing gravitational constants and other data.
   * @override
   */
  _update(time, universe) {
    const delta = JulianDate.secondsDifference(time, this._epoch)
    lagrange_fast(this._times, this._positions, delta, this._position)
  }
}

export default EphemerisObject
