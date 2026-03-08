import ElectroOpicalSensor from './ElectroOpticalSensor.js'

function numberOr(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function booleanOr(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return Boolean(value)
}

/**
 * Placeholder laser payload.
 *
 * v1 intentionally follows the EO sensor path so it renders and points exactly
 * like an electro-optical sensor while carrying laser-specific metadata for
 * later iterations.
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
   *   beamDiameter?: number,
   *   beam_diameter?: number,
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
    this.beamDiameter = numberOr(config.beamDiameter ?? config.beam_diameter, 0)
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
   * Keep v1 behavior identical to the EO sensor placeholder implementation.
   *
   * @param {JulianDate} time
   * @param {Universe} universe
   * @override
   */
  _update(time, universe) {
    super._update(time, universe)
  }
}

export default Laser
