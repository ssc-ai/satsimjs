/**
 * Return the concrete sensor list for an observatory, preserving support for
 * both legacy single-sensor observatories and multi-sensor observatories.
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
  isSensorVisible
}
