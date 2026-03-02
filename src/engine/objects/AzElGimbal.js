import Gimbal from './Gimbal.js';
import { southEastZenithToAzEl } from '../dynamics/gimbal.js';
import { Math as CMath } from 'cesium';

function normalizeAzimuthDeg(azDeg) {
  let wrapped = Number(azDeg) % 360.0
  if (wrapped < 0) wrapped += 360.0
  return wrapped
}

function shortestAzimuthErrorDeg(targetAzDeg, currentAzDeg) {
  let err = normalizeAzimuthDeg(targetAzDeg) - normalizeAzimuthDeg(currentAzDeg)
  if (err > 180.0) err -= 360.0
  if (err < -180.0) err += 360.0
  return err
}

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
    let targetAz = this.getAxisTarget('az')
    let targetEl = this.getAxisTarget('el')
    if (!Number.isFinite(targetAz)) targetAz = this.az
    if (!Number.isFinite(targetEl)) targetEl = this.el

    const localVector = this._trackToLocalVector(time, universe)
    if (localVector !== null) {
      [targetAz, targetEl, this._range] = southEastZenithToAzEl(localVector)
    }

    const dtSec = this._consumeSlewDeltaTime(time)
    this.az = this._slewAxis('az', this.az, targetAz, dtSec, {
      computeErrorDeg: shortestAzimuthErrorDeg,
      normalizePositionDeg: normalizeAzimuthDeg,
      normalizeTargetDeg: normalizeAzimuthDeg
    })
    this.el = this._slewAxis('el', this.el, targetEl, dtSec, {
      computeErrorDeg: (targetDeg, currentDeg) => targetDeg - currentDeg
    })

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
