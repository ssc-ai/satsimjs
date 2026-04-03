/**
 * Return the concrete payload list for an observatory, preserving support for
 * both legacy single-sensor observatories and multi-payload observatories.
 *
 * Undefined sensor entries are filtered out so callers can safely iterate the
 * returned list without additional guards.
 *
 * @param {import('./Observatory.js').default|Object|undefined} observatory
 * @returns {Array<Object>}
 */
function getObservatorySensors(observatory) {
  if (observatory == null) {
    return []
  }
  if (Array.isArray(observatory.sensors)) {
    return observatory.sensors.filter((sensor) => sensor != null)
  }
  return observatory.sensor != null ? [observatory.sensor] : []
}

/**
 * Normalize optional optical zoom configuration into canonical sensor keys.
 *
 * @param {Object|undefined} input
 * @returns {{min_x_fov?: number, max_x_fov?: number, min_y_fov?: number, max_y_fov?: number, initial_zoom_level?: number}|undefined}
 */
function normalizeSensorZoomConfig(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }

  const out = {}
  const keys = ['min_x_fov', 'max_x_fov', 'min_y_fov', 'max_y_fov', 'initial_zoom_level']
  keys.forEach((key) => {
    const value = Number(input[key])
    if (Number.isFinite(value)) {
      out[key] = value
    }
  })

  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Normalize a single per-axis slew-rate entry into the runtime shape used by
 * gimbals and fast steering mirrors.
 *
 * @param {number|string|Object|undefined} entry
 * @returns {{maxRateDegPerSec:number, maxAccelDegPerSec2?:number}|undefined}
 */
function normalizeAxisSlewRateEntry(entry) {
  let maxRateDegPerSec
  let maxAccelDegPerSec2

  if (typeof entry === 'number' || typeof entry === 'string') {
    maxRateDegPerSec = Number(entry)
  } else if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
    maxRateDegPerSec = Number(entry.maxRateDegPerSec)
    maxAccelDegPerSec2 = Number(entry.maxAccelDegPerSec2)
  }

  if (!(Number.isFinite(maxRateDegPerSec) && maxRateDegPerSec > 0)) {
    return undefined
  }

  const out = { maxRateDegPerSec }
  if (Number.isFinite(maxAccelDegPerSec2) && maxAccelDegPerSec2 > 0) {
    out.maxAccelDegPerSec2 = maxAccelDegPerSec2
  }
  return out
}

/**
 * Normalize a dictionary of per-axis slew-rate settings.
 *
 * @param {Object|undefined} input
 * @returns {Object<string, {maxRateDegPerSec:number, maxAccelDegPerSec2?:number}>|undefined}
 */
function normalizeAxisSlewRates(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }

  const out = {}
  Object.keys(input).forEach((axisName) => {
    const axis = String(axisName).trim()
    if (!axis) return
    const normalized = normalizeAxisSlewRateEntry(input[axisName])
    if (normalized) {
      out[axis] = normalized
    }
  })
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Normalize an observatory payload type.
 *
 * @param {string|undefined} payloadType
 * @returns {string|undefined}
 */
function normalizeObservatoryPayloadType(payloadType) {
  const normalized = String(payloadType ?? '').trim().toLowerCase()
  if (!normalized) return undefined
  return normalized === 'laser' ? 'Laser' : 'ElectroOpticalSensor'
}

/**
 * Generate a default payload name for an observatory payload slot.
 *
 * @param {string} observatoryName
 * @param {number} [sensorIndex=0]
 * @param {string|undefined} [payloadType]
 * @returns {string}
 */
function defaultObservatorySensorName(observatoryName, sensorIndex = 0, payloadType = undefined) {
  const baseName = String(observatoryName ?? '').trim()
  const payloadBase = payloadType === 'Laser'
    ? (baseName ? `${baseName} Laser` : 'Laser')
    : (baseName ? `${baseName} Sensor` : 'Sensor')
  return sensorIndex === 0 ? payloadBase : `${payloadBase} ${sensorIndex + 1}`
}

/**
 * Generate a default fast steering mirror name for an observatory.
 *
 * @param {string} observatoryName
 * @returns {string}
 */
function defaultObservatoryFsmName(observatoryName) {
  const baseName = String(observatoryName ?? '').trim()
  return baseName ? `${baseName} FSM` : 'FastSteeringMirror'
}

/**
 * Normalize fast steering mirror config into canonical runtime keys.
 *
 * FSM angle inputs intentionally use the plain axis names `tip` and `tilt` to
 * match the runtime object and event axes.
 *
 * @param {Object|undefined} input
 * @param {string} observatoryName
 * @returns {{name:string, tip?:number, tilt?:number, slewRates?:Object}|undefined}
 */
function normalizeObservatoryFsmConfig(input, observatoryName) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }

  const name = String(input.name ?? '').trim() || defaultObservatoryFsmName(observatoryName)
  const tip = Number(input.tip)
  const tilt = Number(input.tilt)
  const slewRates = normalizeAxisSlewRates(input.slewRates)

  return {
    name,
    ...(Number.isFinite(tip) ? { tip } : {}),
    ...(Number.isFinite(tilt) ? { tilt } : {}),
    ...(slewRates ? { slewRates } : {})
  }
}

/**
 * Determine whether a single sensor can see an azimuth/elevation point based on
 * its field-of-regard definition.
 *
 * @param {Object|undefined} sensor
 * @param {number} az
 * @param {number} el
 * @returns {boolean}
 */
function isSensorVisible(sensor, az, el) {
  const field_of_regard = sensor?.field_of_regard
  if (!Array.isArray(field_of_regard)) {
    return false
  }
  for (let i = 0; i < field_of_regard.length; i++) {
    const f = field_of_regard[i]
    if (az > f.clock[0] && az < f.clock[1] && el > f.elevation[0] && el < f.elevation[1]) {
      return true
    }
  }
  return false
}

export {
  defaultObservatoryFsmName,
  defaultObservatorySensorName,
  getObservatorySensors,
  normalizeAxisSlewRateEntry,
  normalizeAxisSlewRates,
  normalizeObservatoryFsmConfig,
  normalizeObservatoryPayloadType,
  normalizeSensorZoomConfig,
  isSensorVisible
}
