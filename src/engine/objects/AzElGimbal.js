import Gimbal from './Gimbal.js';
import { southEastZenithToAzEl } from '../dynamics/gimbal.js';
import { Math as CMath, JulianDate } from 'cesium';

/**
 * Represents an Azimuth-Elevation Gimbal object that extends the Gimbal class.
 * @extends Gimbal
 */
class AzElGimbal extends Gimbal {
  /**
   * Creates an instance of AzElGimbal.
   * @param {string} [name='AzElGimbal'] - The name of the AzElGimbal object.
   */
  constructor(name='AzElGimbal') {
    super(name)
    this.az = 0.0
    this.el = 90.0
  }

  /**
   * Updates the AzElGimbal object's position and orientation based on the current time and universe.
   * @param {JulianDate} time - The current time.
   * @param {Universe} universe - The universe object.
   * @override
   */
  _update(time, universe) {
    const localVector = this._trackToLocalVector(time, universe)
    if (localVector !== null)
      [this.az, this.el, this._range] = southEastZenithToAzEl(localVector)

    // setup reference transform
    this.reset()
    this.rotateY(CMath.PI_OVER_TWO)
    this.rotateZ(CMath.PI_OVER_TWO)

    // move gimbals to position
    this.rotateY(-this.az * CMath.RADIANS_PER_DEGREE)
    this.rotateX(this.el * CMath.RADIANS_PER_DEGREE)
  }
}

export default AzElGimbal;
