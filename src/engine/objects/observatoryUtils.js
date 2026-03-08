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
 * Snake_case and camelCase aliases are accepted so scenario input, runtime
 * configuration, and direct sensor construction can all share one parser.
 *
 * @param {Object|undefined} input
 * @returns {{min_x_fov?: number, max_x_fov?: number, min_y_fov?: number, max_y_fov?: number, initial_zoom_level?: number}|undefined}
 */
function normalizeSensorZoomConfig(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }

  const out = {}
  const mappings = [
    ['min_x_fov', ['min_x_fov', 'minXFov']],
    ['max_x_fov', ['max_x_fov', 'maxXFov']],
    ['min_y_fov', ['min_y_fov', 'minYFov']],
    ['max_y_fov', ['max_y_fov', 'maxYFov']],
    ['initial_zoom_level', ['initial_zoom_level', 'initialZoomLevel']]
  ]

  mappings.forEach(([canonicalKey, aliases]) => {
    for (let i = 0; i < aliases.length; i++) {
      const value = Number(input[aliases[i]])
      if (Number.isFinite(value)) {
        out[canonicalKey] = value
        break
      }
    }
  })

  return Object.keys(out).length > 0 ? out : undefined
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
  getObservatorySensors,
  normalizeSensorZoomConfig,
  isSensorVisible
}
