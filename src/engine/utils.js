import { Cartesian3, JulianDate, defined } from 'cesium'

/**
 * Shared engine-level coercion and normalization helpers.
 *
 * These utilities are dependency-light so they can be reused by objects,
 * dynamics modules, scenario loading, and event handling without coupling
 * those modules to one another.
 */

/**
 * Convert a value to a finite number or fall back to a default.
 *
 * @param {*} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function numberOr(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

/**
 * Convert a value to a finite number when possible.
 *
 * @param {*} value
 * @returns {number|undefined}
 */
export function numberOrUndefined(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

/**
 * Convert a value to a finite positive number or fall back to a default.
 *
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
export function positiveNumberOr(value, fallback) {
  const number = Number(value)
  return (Number.isFinite(number) && number > 0) ? number : fallback
}

/**
 * Convert a value to a finite positive number when possible.
 *
 * @param {*} value
 * @returns {number|undefined}
 */
export function positiveNumberOrUndefined(value) {
  const number = numberOrUndefined(value)
  return (Number.isFinite(number) && number > 0) ? number : undefined
}

/**
 * Convert a value to a boolean, preserving explicit string forms for `true`
 * and `false`.
 *
 * @param {*} value
 * @param {boolean} [fallback=false]
 * @returns {boolean}
 */
export function booleanOr(value, fallback = false) {
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
 * Clamp a numeric value into an inclusive range.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Clamp a numeric value into a symmetric range around zero.
 *
 * @param {number} value
 * @param {number} maxAbs
 * @returns {number}
 */
export function clampSymmetric(value, maxAbs) {
  return clamp(value, -maxAbs, maxAbs)
}

/**
 * Clamp a geodetic latitude in degrees to a safe open interval around the poles.
 *
 * @param {*} deg
 * @returns {number}
 */
export function clampLatitude(deg) {
  return clamp(Number(deg) || 0, -89.999999, 89.999999)
}

/**
 * Wrap a longitude in degrees into the `[-180, 180]` range.
 *
 * @param {*} deg
 * @returns {number}
 */
export function normalizeLongitude(deg) {
  let longitude = Number(deg)
  if (!Number.isFinite(longitude)) return 0
  while (longitude > 180) longitude -= 360
  while (longitude < -180) longitude += 360
  return longitude
}

/**
 * Wrap a heading in degrees into the `[0, 360)` range.
 *
 * @param {*} deg
 * @returns {number}
 */
export function normalizeHeading(deg) {
  let heading = Number(deg)
  if (!Number.isFinite(heading)) return 0
  heading %= 360
  if (heading < 0) heading += 360
  return heading
}

/**
 * Convert common vector-like inputs into a Cartesian3, defaulting to zero.
 *
 * Supported inputs:
 * - `Cartesian3`
 * - `[x, y, z]`
 * - `{ x, y, z }`
 *
 * @param {*} value
 * @returns {Cartesian3}
 */
export function toCartesian3(value) {
  if (value instanceof Cartesian3) return Cartesian3.clone(value)
  if (Array.isArray(value) && value.length >= 3) {
    return new Cartesian3(numberOr(value[0]), numberOr(value[1]), numberOr(value[2]))
  }
  if (defined(value) && typeof value === 'object') {
    return new Cartesian3(numberOr(value.x), numberOr(value.y), numberOr(value.z))
  }
  return new Cartesian3()
}

/**
 * Convert common vector-like inputs into a Cartesian3 when valid.
 *
 * @param {*} value
 * @returns {Cartesian3|undefined}
 */
export function toCartesian3OrUndefined(value) {
  if (value instanceof Cartesian3) return Cartesian3.clone(value)
  if (Array.isArray(value) && value.length >= 3) {
    return new Cartesian3(numberOr(value[0]), numberOr(value[1]), numberOr(value[2]))
  }
  if (defined(value) && typeof value === 'object') {
    return new Cartesian3(numberOr(value.x), numberOr(value.y), numberOr(value.z))
  }
  return undefined
}

/**
 * Normalize supported date/time inputs into a cloned JulianDate.
 *
 * @param {JulianDate|Date|string|*} value
 * @returns {JulianDate|undefined}
 */
export function resolveJulianDateInput(value) {
  if (value instanceof JulianDate) {
    return JulianDate.clone(value, new JulianDate())
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? JulianDate.fromDate(value) : undefined
  }
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? JulianDate.fromDate(date) : undefined
  }
  return undefined
}
