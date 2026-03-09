import { Color, CallbackProperty, Cartesian3, Math as CMath } from 'cesium'
import { createObjectPositionProperty, createObjectOrientationProperty } from './utils.js'
import CompountElementVisualizer from './CompoundElementVisualizer.js'

class LaserBeam extends CompountElementVisualizer {
  constructor(viewer, laser, universe, color) {
    super(color ?? Color.GREEN, 0.25, 0.5)
    this._laser = laser
    this._beamEllipsoid = undefined

    const e = viewer.entities.add({
      name: laser.name + ' Beam',
      position: createObjectPositionProperty(laser, universe, viewer),
      orientation: createObjectOrientationProperty(laser, universe),
      ellipsoid: {
        show: new CallbackProperty((time) => {
          laser.update(time, universe)
          return this._show && laser.active === true && laser.beamLength > 0
        }, false),
        radii: new CallbackProperty((time, result) => {
          laser.update(time, universe)
          const range = laser.beamLength > 0 ? laser.beamLength : 1.0
          return Cartesian3.clone(new Cartesian3(range, range, range), result)
        }, false),
        innerRadii: new Cartesian3(CMath.EPSILON1, CMath.EPSILON1, CMath.EPSILON1),
        minimumClock: new CallbackProperty(() => CMath.toRadians(-resolveBeamDivergenceDeg(laser, laser.x_fov) / 2), false),
        maximumClock: new CallbackProperty(() => CMath.toRadians(resolveBeamDivergenceDeg(laser, laser.x_fov) / 2), false),
        minimumCone: new CallbackProperty(() => CMath.toRadians(90 - resolveBeamDivergenceDeg(laser, laser.y_fov) / 2), false),
        maximumCone: new CallbackProperty(() => CMath.toRadians(90 + resolveBeamDivergenceDeg(laser, laser.y_fov) / 2), false),
        material: this._color.withAlpha(0.25),
        outlineColor: this._color.withAlpha(0.5),
        outline: true,
        slicePartitions: 3,
        stackPartitions: 3
      },
      simObjectRef: laser,
      allowPicking: false
    })

    this._beamEllipsoid = e.ellipsoid
    this._entities.push(e.ellipsoid)
  }

  get show() {
    return this._show
  }

  set show(value) {
    this._show = Boolean(value)
  }
}

function resolveBeamDivergenceDeg(laser, fallbackFov) {
  const beamDivergence = Number(laser?.beamDivergence ?? laser?.beam_divergence)
  if (Number.isFinite(beamDivergence) && beamDivergence > 0) {
    return beamDivergence
  }

  const fov = Number(fallbackFov)
  return (Number.isFinite(fov) && fov > 0) ? fov : 0.001
}

export default LaserBeam
