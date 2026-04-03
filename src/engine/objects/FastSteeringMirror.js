import Gimbal from './Gimbal.js'
import { Math as CMath } from 'cesium'

/**
 * Fast steering mirror modeled as a nested steerable node in the scene graph.
 *
 * V1 treats the mirror as a child transform under the coarse gimbal. Payloads
 * mounted below it inherit the mirror-adjusted pose directly.
 */
class FastSteeringMirror extends Gimbal {
  /**
   * @param {string} [name='FastSteeringMirror']
   */
  constructor(name = 'FastSteeringMirror') {
    super(name)
    this.type = 'FastSteeringMirror'
    this.tip = 0.0
    this.tilt = 0.0
  }

  /**
   * Update the mirror steering transform.
   *
   * Positive tip steers horizontally and positive tilt steers upward. The
   * outgoing child-facing transform uses doubled angles to approximate optical
   * mirror deflection.
   *
   * @param {import('cesium').JulianDate} time
   * @param {import('../Universe.js').default} universe
   * @override
   */
  _update(time, universe) { // eslint-disable-line no-unused-vars
    let targetTip = this.getAxisTarget('tip')
    let targetTilt = this.getAxisTarget('tilt')
    if (!Number.isFinite(targetTip)) targetTip = this.tip
    if (!Number.isFinite(targetTilt)) targetTilt = this.tilt

    const dtSec = this._consumeSlewDeltaTime(time)
    this.tip = this._slewAxis('tip', this.tip, targetTip, dtSec, {
      computeErrorDeg: (nextTargetDeg, currentDeg) => nextTargetDeg - currentDeg
    })
    this.tilt = this._slewAxis('tilt', this.tilt, targetTilt, dtSec, {
      computeErrorDeg: (nextTargetDeg, currentDeg) => nextTargetDeg - currentDeg
    })

    this.reset()
    this.rotateY(-2 * this.tip * CMath.RADIANS_PER_DEGREE)
    this.rotateX(2 * this.tilt * CMath.RADIANS_PER_DEGREE)
  }
}

export default FastSteeringMirror
