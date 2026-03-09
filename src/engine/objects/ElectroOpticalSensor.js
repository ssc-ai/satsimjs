import { JulianDate } from 'cesium'
import SimObject from './SimObject.js'
import { normalizeSensorZoomConfig } from './observatoryUtils.js'
import { clamp, numberOr } from '../utils.js'

/**
 * Resolve an ordered pair of zoom bounds, falling back to the fixed sensor FOV.
 *
 * @param {number|undefined} minValue
 * @param {number|undefined} maxValue
 * @param {number} fallbackValue
 * @returns {{min:number, max:number}}
 */
function normalizeZoomBounds(minValue, maxValue, fallbackValue) {
  const a = numberOr(minValue, fallbackValue)
  const b = numberOr(maxValue, fallbackValue)
  return {
    min: Math.min(a, b),
    max: Math.max(a, b)
  }
}

/**
 * Derive a normalized zoom level from a concrete FOV inside configured bounds.
 *
 * @param {number} currentFov
 * @param {number} minFov
 * @param {number} maxFov
 * @returns {number|undefined}
 */
function zoomLevelFromFov(currentFov, minFov, maxFov) {
  const span = maxFov - minFov
  if (!Number.isFinite(currentFov) || !Number.isFinite(span) || span <= 0) {
    return undefined
  }
  return clamp((maxFov - currentFov) / span, 0, 1)
}

/**
 * Interpolate the active sensor FOV for one axis from the current zoom level.
 *
 * @param {ElectroOpicalSensor} sensor
 * @param {number} minFov
 * @param {number} maxFov
 * @returns {number}
 */
function resolveZoomFov(sensor, minFov, maxFov) {
  if (!sensor.canZoom || maxFov === minFov) {
    return maxFov
  }
  return maxFov - ((maxFov - minFov) * sensor.zoomLevel)
}

/**
 * Apply a new normalized zoom level and recompute dependent FOV/IFOV values.
 *
 * @param {ElectroOpicalSensor} sensor
 * @param {number} level
 * @returns {number}
 */
function applyZoomLevel(sensor, level) {
  const nextLevel = sensor.canZoom ? clamp(numberOr(level, sensor.zoomLevel), 0, 1) : 0
  sensor.zoomLevel = nextLevel
  sensor.x_fov = resolveZoomFov(sensor, sensor.zoom.min_x_fov, sensor.zoom.max_x_fov)
  sensor.y_fov = resolveZoomFov(sensor, sensor.zoom.min_y_fov, sensor.zoom.max_y_fov)
  sensor.x_ifov = sensor.x_fov / sensor.width
  sensor.y_ifov = sensor.y_fov / sensor.height
  return sensor.zoomLevel
}

/**
 * A class representing an electro-optical sensor.
 * @extends SimObject
 */
class ElectroOpicalSensor extends SimObject {
  /**
   * Create an electro-optical sensor.
   * @param {number} height - The height of the sensor in pixels.
   * @param {number} width - The width of the sensor in pixels.
   * @param {number} y_fov - The vertical field of view of the sensor in degrees.
   * @param {number} x_fov - The horizontal field of view of the sensor in degrees.
   * @param {Array} field_of_regard - An array of objects representing the field of regard of the sensor.
   * @param {string} name - The name of the sensor.
   * @param {{zoom?: {min_x_fov?: number, max_x_fov?: number, minXFov?: number, maxXFov?: number, min_y_fov?: number, max_y_fov?: number, minYFov?: number, maxYFov?: number, initial_zoom_level?: number, initialZoomLevel?: number}}} [options] - Optional zoom configuration.
   */
  constructor(height, width, y_fov, x_fov, field_of_regard=[], name='ElectroOpticalSensor', options = undefined) {
    super(name)
    this.height = height
    this.width = width
    this.field_of_regard = field_of_regard
    this.zoomLevel = 0

    const zoom = normalizeSensorZoomConfig(options?.zoom)
    const xBounds = normalizeZoomBounds(
      zoom?.min_x_fov,
      zoom?.max_x_fov,
      x_fov
    )
    const yBounds = normalizeZoomBounds(
      zoom?.min_y_fov,
      zoom?.max_y_fov,
      y_fov
    )

    const derivedZoomLevel = (() => {
      const xLevel = zoomLevelFromFov(x_fov, xBounds.min, xBounds.max)
      if (Number.isFinite(xLevel)) {
        return xLevel
      }
      return zoomLevelFromFov(y_fov, yBounds.min, yBounds.max)
    })()
    const initialZoomLevel = zoom?.initial_zoom_level

    this.zoom = {
      min_x_fov: xBounds.min,
      max_x_fov: xBounds.max,
      min_y_fov: yBounds.min,
      max_y_fov: yBounds.max,
      initial_zoom_level: clamp(numberOr(initialZoomLevel, derivedZoomLevel ?? 0), 0, 1)
    }
    this.canZoom = (
      this.zoom.max_x_fov > this.zoom.min_x_fov ||
      this.zoom.max_y_fov > this.zoom.min_y_fov
    )

    applyZoomLevel(this, this.zoom.initial_zoom_level)
  }

  /**
   * Set the normalized optical zoom level.
   *
   * A value of `0` selects the widest configured FOV and `1` selects the
   * narrowest configured FOV.
   *
   * @param {number} level
   * @returns {number} The applied, clamped zoom level.
   */
  setZoomLevel(level) {
    return applyZoomLevel(this, level)
  }

  /**
   * Increment the normalized optical zoom level by a delta.
   *
   * @param {number} delta
   * @returns {number} The applied, clamped zoom level.
   */
  stepZoomLevel(delta) {
    const change = Number(delta)
    if (!Number.isFinite(change) || change === 0) {
      return this.zoomLevel
    }
    return this.setZoomLevel(this.zoomLevel + change)
  }

  /**
   * Update the state of the sensor.
   * @param {JulianDate} time - The current simulation time.
   * @param {Universe} universe - The universe in which the sensor exists.
   * @override
   */
  _update(time, universe) {
    // TODO do nothing for now
  }

}

export default ElectroOpicalSensor
