/**
 * @ TODO prototype warning, will be refactored
 * 
 * Scenario utilities for SatSimJS.
 *
 * This module provides helpers to apply a scenario configuration to a
 * running SatSim Universe + Viewer pair. It centralizes creation of objects
 * (observatories, satellites), application of simulation parameters, and
 * scheduling of simple time-based events.
 *
 * None of these utilities mutate global state; callers pass in their Universe
 * and Viewer instances explicitly. Functions are structured to be usable from
 * browser UIs, notebooks, and apps embedding SatSimJS.
 */

import { Color, Cartesian3, JulianDate } from 'cesium'

/**
 * Create a ground EO observatory and attach a visualizer.
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer (with addObservatoryVisualizer).
 * @param {Object} obs - Observatory config.
 * @param {string} obs.name - Unique name for the observatory.
 * @param {number|string} obs.latitude - Latitude in degrees.
 * @param {number|string} obs.longitude - Longitude in degrees.
 * @param {number|string} [obs.altitude=0] - Altitude in meters.
 * @param {number|string} [obs.height=100] - Sensor height (m).
 * @param {number|string} [obs.width=100] - Sensor width (m).
 * @param {number|string} [obs.y_fov=5] - Sensor FOV in Y (deg).
 * @param {number|string} [obs.x_fov=5] - Sensor FOV in X (deg).
 * @param {Array} [obs.field_of_regard=[]] - Optional field of regard.
 */
export function addObservatory(universe, viewer, obs) {
  if (!obs || !obs.name) return
  if (universe.hasObject && universe.hasObject(obs.name)) return

  const o = universe.addGroundElectroOpticalObservatory(
    String(obs.name),
    Number(obs.latitude),
    Number(obs.longitude),
    Number(obs.altitude ?? 0),
    'AzElGimbal',
    Number(obs.height ?? obs.sensor_height ?? 100),
    Number(obs.width ?? obs.sensor_width ?? 100),
    Number(obs.y_fov ?? 5),
    Number(obs.x_fov ?? 5),
    obs.field_of_regard || []
  )

  const desc = `<div><b>${obs.name}</b><br>` +
    `Latitude: ${obs.latitude} deg<br>` +
    `Longitude: ${obs.longitude} deg<br>` +
    `Altitude: ${obs.altitude ?? 0} m</div>`

  try { viewer.addObservatoryVisualizer(o, desc) } catch (e) { /* no-op */ }
}

/**
 * Add a two-body satellite and attach a simple visualizer.
 *
 * Entry supports several field aliases; vectors are normalized to meters and m/s.
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer (with addObjectVisualizer).
 * @param {Object} entry - Two-body definition.
 * @param {string} [entry.name] - Object name.
 * @param {Array<number>} [entry.position] - ECI position vector.
 * @param {Array<number>} [entry.velocity] - ECI velocity vector.
 * @param {Array<number>} [entry.r] - Alias for position.
 * @param {Array<number>} [entry.v] - Alias for velocity.
 * @param {Array<number>} [entry.r_km] - Position in kilometers.
 * @param {Array<number>} [entry.v_km_s] - Velocity in km/s.
 * @param {string|Date} [entry.epoch] - Epoch as ISO string or Date.
 * @param {string} [entry.orientation='nadir'] - Orientation strategy.
 */
export function addTwoBody(universe, viewer, entry, idx = 0) {
  const name = entry.name || `TwoBody-${idx + 1}`
  if (universe.hasObject && universe.hasObject(name)) return

  const r = entry.position ?? entry.r_m ?? entry.r ?? entry.r_km ?? entry.position_km
  const v = entry.velocity ?? entry.v_m_s ?? entry.v ?? entry.v_km_s ?? entry.velocity_km_s
  let r_m = r
  let v_m_s = v

  const posUnits = (entry.position_units || entry.r_units || '').toLowerCase()
  const velUnits = (entry.velocity_units || entry.v_units || '').toLowerCase()

  if (Array.isArray(entry.r_km) || Array.isArray(entry.position_km) || posUnits.includes('km')) {
    r_m = [r[0] * 1000, r[1] * 1000, r[2] * 1000]
  }
  if (Array.isArray(entry.v_km_s) || Array.isArray(entry.velocity_km_s) || velUnits.includes('km')) {
    v_m_s = [v[0] * 1000, v[1] * 1000, v[2] * 1000]
  }
  if (!Array.isArray(r_m) || !Array.isArray(v_m_s)) return

  const R = new Cartesian3(Number(r_m[0]), Number(r_m[1]), Number(r_m[2]))
  const V = new Cartesian3(Number(v_m_s[0]), Number(v_m_s[1]), Number(v_m_s[2]))
  const t = entry.epoch ? JulianDate.fromDate(new Date(entry.epoch)) : undefined
  const orientation = entry.orientation || 'nadir'

  const s = universe.addTwoBodySatellite(name, R, V, t || viewer.clock.currentTime.clone(), orientation, false, true)

  const color = Color && Color.fromRandom ? new Color.fromRandom({ alpha: 1.0 }) : undefined
  const desc = `Two-body initial state @ ${entry.epoch || 'current'}<br>` +
    `r[m]=${JSON.stringify(r_m)}<br>v[m/s]=${JSON.stringify(v_m_s)}`
  const lead = (s && s.period) ? (s.period / 2) : 1800
  const trail = (s && s.period) ? (s.period / 2) : 1800
  const res = (s && s.period && s.eccentricity !== undefined) ? (s.period / (500 / (1 - s.eccentricity))) : 60

  viewer.addObjectVisualizer(s, desc, {
    path: { show: false, leadTime: lead, trailTime: trail, resolution: res, material: color, width: 1 },
    point: { show: true, pixelSize: 5, color: color, outlineColor: color }
  })
}

/**
 * Add an SGP4 satellite from TLE and attach a simple visualizer.
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer (with addObjectVisualizer).
 * @param {string} name - Satellite name/identifier.
 * @param {string} tle1 - Line 1.
 * @param {string} tle2 - Line 2.
 * @param {string} [orientation='nadir'] - Orientation strategy.
 */
export function addSatelliteFromTLE(universe, viewer, name, tle1, tle2, orientation = 'nadir') {
  const s = universe.addSGP4Satellite(name, tle1, tle2, orientation || 'nadir', true)
  const color = Color && Color.fromRandom ? new Color.fromRandom({ alpha: 1.0 }) : undefined
  const lead = (s && s.period) ? (s.period / 2) : 1800
  const trail = (s && s.period) ? (s.period / 2) : 1800
  const res = (s && s.period && s.eccentricity !== undefined) ? (s.period / (500 / (1 - s.eccentricity))) : 60
  viewer.addObjectVisualizer(s, 'TLE', {
    path: { show: false, leadTime: lead, trailTime: trail, resolution: res, material: color, width: 1 },
    point: { show: true, pixelSize: 5, color: color, outlineColor: color }
  })
}

/**
 * Parse TLE text into an array of entries.
 *
 * Supports both 2-line (no name line) and 3-line (name line present)
 * formats, with basic robustness to blank lines and whitespace.
 *
 * @param {string} text - Raw TLE text.
 * @param {number} [limit=Infinity] - Optional cap on entries.
 * @returns {Array<{name: string, l1: string, l2: string}>}
 */
export function parseTleCatalogText(text, limit = Infinity) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)

  const list = []
  for (let i = 0; i < lines.length && list.length < limit; ) {
    const a = lines[i]
    const b = lines[i + 1] || ''
    const c = lines[i + 2] || ''
    if (/^1\s/.test(a) && /^2\s/.test(b)) {
      // 2-line format
      const name = (a.substring(2, 7) || 'SAT').trim()
      list.push({ name, l1: a, l2: b })
      i += 2
    } else if (a && /^1\s/.test(b) && /^2\s/.test(c)) {
      // 3-line format with name
      list.push({ name: a, l1: b, l2: c })
      i += 3
    } else {
      i += 1
    }
  }
  return list
}

/**
 * Add a set of TLE satellites described by an object.
 *
 * Object fields:
 * - data|text: Inline TLE catalog text.
 * - url|path: URL to fetch TLE text from when no inline data is provided.
 * - limit: Maximum satellites to add (default 50).
 * - orientation: Optional orientation strategy (e.g., 'nadir').
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer.
 * @param {Object} obj - TLE catalog descriptor.
 */
export async function addTleCatalog(universe, viewer, obj) {
  const limit = Number(obj.limit ?? 50)
  let text = obj.data || obj.text || null
  if (!text) {
    const url = obj.url || obj.path
    if (!url) return
    const res = await fetch(url)
    text = await res.text()
  }
  const list = parseTleCatalogText(text, limit)
  list.slice(0, limit).forEach((sat) => {
    addSatelliteFromTLE(universe, viewer, sat.name, sat.l1, sat.l2, obj.orientation)
  })
}

/**
 * Apply simulation parameters to the viewer clock.
 *
 * @param {Viewer} viewer - The SatSim viewer.
 * @param {{start_time?: string, end_time?: string, time_step?: number}} params - Parameters.
 */
export function applySimulationParameters(viewer, params) {
  if (!params) return
  const start = params.start_time ? JulianDate.fromDate(new Date(params.start_time)) : viewer.clock.startTime
  const stop = params.end_time ? JulianDate.fromDate(new Date(params.end_time)) : JulianDate.addSeconds(start, 24 * 3600, new JulianDate())
  viewer.clock.startTime = start.clone()
  viewer.clock.currentTime = start.clone()
  viewer.clock.stopTime = stop.clone()
  if (params.time_step) {
    const step = Number(params.time_step)
    if (!Number.isNaN(step)) viewer.clock.multiplier = step
  }
}

/**
 * Add an object described by a scenario entry.
 *
 * Supported types: GroundEOObservatory (and aliases), SGP4Satellite, TLECatalog,
 * TwoBodySatellite (and aliases).
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer.
 * @param {Object} obj - Scenario object entry.
 */
export function addScenarioObject(universe, viewer, obj) {
  if (!obj || !obj.type) return
  switch (String(obj.type || '').toLowerCase()) {
    case 'groundeoobservatory':
    case 'groundeo':
    case 'observatory': {
      addObservatory(universe, viewer, {
        name: obj.name,
        latitude: obj.latitude,
        longitude: obj.longitude,
        altitude: obj.altitude,
        height: (obj.height != null ? obj.height : obj.sensor_height),
        width: (obj.width != null ? obj.width : obj.sensor_width),
        y_fov: obj.y_fov,
        x_fov: obj.x_fov,
        field_of_regard: obj.field_of_regard,
      })
      break
    }
    case 'sgp4satellite':
    case 'sgp4': {
      addSatelliteFromTLE(universe, viewer, obj.name || String(obj.tle1 || '').trim(), obj.tle1, obj.tle2, obj.orientation)
      break
    }
    case 'tlecatalog':
    case 'tles':
    case 'tlelist': {
      addTleCatalog(universe, viewer, obj)
      break
    }
    case 'twobodysatellite':
    case 'twobody': {
      addTwoBody(universe, viewer, {
        name: obj.name,
        position: (obj.position != null ? obj.position : obj.initial_position),
        velocity: (obj.velocity != null ? obj.velocity : obj.initial_velocity),
        epoch: obj.epoch,
        orientation: obj.orientation,
      })
      break
    }
  }
}

/**
 * Schedule simple time-based scenario events.
 *
 * Currently supports:
 * - type: 'trackObject' with {observer, target} fields
 *   Switches the observer's gimbal to rate tracking of the target at event time.
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer.
 * @param {Array<Object>} events - Array of events with `time` and `type`.
 */
export function scheduleScenarioEvents(universe, viewer, events) {
  if (!Array.isArray(events) || !events.length) return
  const scheduled = events.map((ev) => {
    const t = ev.time
    let jd
    if (typeof t === 'number') {
      jd = JulianDate.addSeconds(viewer.clock.startTime, t, new JulianDate())
    } else if (typeof t === 'string') {
      jd = JulianDate.fromDate(new Date(t))
    }
    return { type: ev.type, jd, observer: ev.observer, target: ev.target, fired: false }
  }).filter(e => e.jd)

  if (!scheduled.length) return
  viewer.scene.preUpdate.addEventListener(function (_scene, time) {
    scheduled.forEach(function (ev) {
      if (ev.fired) return
      if (JulianDate.lessThan(ev.jd, time) || JulianDate.equals(ev.jd, time)) {
        try {
          if (String(ev.type || '').toLowerCase() === 'trackobject') {
            const site = universe.getObject && universe.getObject(ev.observer)
            const target = universe.getObject && universe.getObject(ev.target)
            let obs = null
            if (site) {
              const arr = universe._observatories || []
              for (let i = 0; i < arr.length; i++) {
                if (arr[i].site && arr[i].site.name === ev.observer) { obs = arr[i]; break }
              }
            }
            if (obs && target) {
              obs.gimbal.trackMode = 'rate'
              obs.gimbal.trackObject = target
            }
          }
        } catch (_) { /* no-op */ }
        ev.fired = true
      }
    })
  })
}

/**
 * Apply a full scenario object: simulation parameters, objects, and events.
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer.
 * @param {Object} config - Parsed scenario JSON.
 * @returns {boolean} True if applied without parse errors.
 */
export function loadScenario(universe, viewer, config) {
  if (!config || typeof config !== 'object') return false
  try {
    if (config.simulationParameters) applySimulationParameters(viewer, config.simulationParameters)
    if (Array.isArray(config.objects)) config.objects.forEach((o, i) => addScenarioObject(universe, viewer, { ...o, __index: i }))
    if (Array.isArray(config.events)) scheduleScenarioEvents(universe, viewer, config.events)
    return true
  } catch (_) {
    return false
  }
}

/**
 * Parse scenario JSON text and apply it.
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer.
 * @param {string} text - Scenario JSON as a string.
 * @returns {boolean} True if applied successfully.
 */
export function loadScenarioFromText(universe, viewer, text) {
  try {
    const cfg = JSON.parse(text || '{}')
    return loadScenario(universe, viewer, cfg)
  } catch (_) {
    return false
  }
}

