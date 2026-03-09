import { Cartesian3, JulianDate } from 'cesium'
import ElectroOpicalSensor from './ElectroOpticalSensor.js'
import { booleanOr, numberOr } from '../utils.js'

const _scratchTargetLocal = new Cartesian3()

/**
 * Laser payload with EO-aligned pointing and beam-state metadata.
 */
class Laser extends ElectroOpicalSensor {
  /**
   * @param {{
   *   name?: string,
   *   height?: number,
   *   width?: number,
   *   y_fov?: number,
   *   x_fov?: number,
   *   field_of_regard?: Array,
   *   zoom?: Object,
   *   beamDivergence?: number,
   *   beam_divergence?: number,
   *   power?: number,
   *   active?: boolean,
   *   maxRange?: number,
   *   max_range?: number,
   *   color?: any
   * }} [options]
   */
  constructor(options = undefined) {
    const config = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {}
    super(
      numberOr(config.height, 100),
      numberOr(config.width, 100),
      numberOr(config.y_fov, 0.01),
      numberOr(config.x_fov, 0.01),
      Array.isArray(config.field_of_regard) ? config.field_of_regard : [],
      String(config.name ?? 'Laser'),
      config.zoom ? { zoom: config.zoom } : undefined
    )

    this.type = 'Laser'
    this.beamDivergence = numberOr(
      config.beamDivergence ??
      config.beam_divergence ??
      numberOr(config.x_fov ?? config.y_fov, 0.01)
    )
    this.power = numberOr(config.power, 0)
    this.active = booleanOr(config.active, false)
    this.maxRange = numberOr(config.maxRange ?? config.max_range, 0)
    this.beamLength = 0
    this.isColliding = false
    if (config.color !== undefined) {
      this.color = config.color
    }
  }

  /**
   * @param {JulianDate} time
   * @param {Object} universe
   * @override
   */
  _update(time, universe) {
    super._update(time, universe)

    if (this.active !== true) {
      this.beamLength = 0
      this.isColliding = false
      return
    }

    const maxRange = numberOr(this.maxRange, 0)
    const gimbal = this.parent
    if (!gimbal) {
      this.beamLength = maxRange
      this.isColliding = false
      return
    }

    const trackables = Array.isArray(universe?.trackables)
      ? universe.trackables
      : Array.isArray(universe?.trackables)
        ? universe.trackables
        : []
    let closestHitDistance = undefined

    trackables.forEach((target) => {
      const collisionRadius = resolveCollisionRadius(target)
      if (!(Number.isFinite(collisionRadius) && collisionRadius > 0)) {
        return
      }
      if (typeof target?.transformPointTo !== 'function') {
        return
      }

      if (typeof target.update === 'function') {
        target.update(time, universe)
      }

      const targetLocal = target.transformPointTo(gimbal, Cartesian3.ZERO, _scratchTargetLocal)
      const hitDistance = resolveFirstSphereHitDistance(targetLocal, collisionRadius)
      if (!Number.isFinite(hitDistance) || hitDistance > maxRange) {
        return
      }
      if (!Number.isFinite(closestHitDistance) || hitDistance < closestHitDistance) {
        closestHitDistance = hitDistance
      }
    })

    if (Number.isFinite(closestHitDistance)) {
      this.beamLength = closestHitDistance
      this.isColliding = true
      return
    }

    this.beamLength = maxRange
    this.isColliding = false
  }
}

function resolveCollisionRadius(target) {
  const radius = Number(
    target?.collisionRadius ??
    target?.collision_radius_m ??
    target?.collisionRadiusM ??
    target?.collision_radius ??
    target?.collisionRadiusMeters
  )
  return (Number.isFinite(radius) && radius > 0) ? radius : undefined
}

function resolveFirstSphereHitDistance(targetLocal, collisionRadius) {
  if (!(targetLocal instanceof Cartesian3)) {
    return undefined
  }
  if (!(Number.isFinite(collisionRadius) && collisionRadius > 0)) {
    return undefined
  }

  const radialDistance = Math.hypot(targetLocal.x, targetLocal.y)
  if (radialDistance > collisionRadius) {
    return undefined
  }

  const centerDistanceAlongBoresight = -targetLocal.z
  if (!(Number.isFinite(centerDistanceAlongBoresight) && centerDistanceAlongBoresight >= 0)) {
    return undefined
  }

  const chordDepth = Math.sqrt(Math.max(0, (collisionRadius * collisionRadius) - (radialDistance * radialDistance)))
  const firstHitDistance = centerDistanceAlongBoresight - chordDepth
  return (Number.isFinite(firstHitDistance) && firstHitDistance >= 0) ? firstHitDistance : undefined
}

export default Laser
