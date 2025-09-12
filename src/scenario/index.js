/**
 * @TODO prototype warning, will be refactored
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

import { Color, Cartesian3, JulianDate, Viewer, defined } from 'cesium'
import Universe from '../engine/Universe.js'

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
  if (universe.hasObject && universe.hasObject(obs.name)) {
    console.log(`Observatory with name ${obs.name} already exists, skipping creation.`)
    return
  }

  const o = universe.addGroundElectroOpticalObservatory(
    String(obs.name),
    Number(obs.latitude),
    Number(obs.longitude),
    Number(obs.altitude ?? 0),
    'AzElGimbal',
    Number(obs.height),
    Number(obs.width),
    Number(obs.y_fov ?? 5),
    Number(obs.x_fov ?? 5),
    obs.field_of_regard ?? []
  )

  const desc = `<div><b>${obs.name}</b><br>` +
    `Latitude: ${obs.latitude} deg<br>` +
    `Longitude: ${obs.longitude} deg<br>` +
    `Altitude: ${obs.altitude ?? 0} m</div>`

  viewer.addObservatoryVisualizer(o, desc)
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
  if (universe.hasObject && universe.hasObject(name)) {
    console.log(`Satellite with name ${name} already exists, skipping creation.`)
    return
  }

  const r = entry.position
  const v = entry.velocity
  let r_m = r
  let v_m_s = v

  const R = new Cartesian3(Number(r_m[0]), Number(r_m[1]), Number(r_m[2]))
  const V = new Cartesian3(Number(v_m_s[0]), Number(v_m_s[1]), Number(v_m_s[2]))
  const t = JulianDate.fromDate(new Date(entry.epoch))
  const orientation = entry.orientation || 'nadir'

  const s = universe.addTwoBodySatellite(name, R, V, t || viewer.clock.currentTime.clone(), orientation, false, true)

  const color = Color.fromRandom({ alpha: 1.0 })
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
  const color = Color.fromRandom({ alpha: 1.0 })
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
 * - limit: Maximum satellites to add (default 500000).
 * - orientation: Optional orientation strategy (e.g., 'nadir').
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer.
 * @param {Object} obj - TLE catalog descriptor.
 */
export async function addTleCatalog(universe, viewer, obj) {
  const limit = Number(obj.limit ?? 500000)
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
 * @param {{start_time?: string, end_time?: string, time_step?: number, clock_step?: string, clock_range?: string, current_time?: string, playback_state?: string}} params - Parameters.
 */
export function applySimulationParameters(viewer, params) {
  if (defined(params.start_time)) {
    const start = JulianDate.fromDate(new Date(params.start_time))
    const stop = params.end_time ? JulianDate.fromDate(new Date(params.end_time)) : JulianDate.addSeconds(start, 24 * 3600, new JulianDate())
    const current = params.current_time ? JulianDate.fromDate(new Date(params.current_time)) : start.clone()
    viewer.clock.startTime = start.clone()
    viewer.clock.currentTime = current.clone()
    viewer.clock.stopTime = stop.clone()
  }
  if (defined(params.time_step)) viewer.clock.multiplier = Number(params.time_step)
  if (defined(params.clock_step)) {
    const clockStepValue = String(params.clock_step).toLowerCase()
    switch (clockStepValue) {
      case 'tick_dependent':
        viewer.clock.clockStep = 0
        break
      case 'system_clock_multiplier':
        viewer.clock.clockStep = 1
        break
      case 'system_clock':
        viewer.clock.clockStep = 2
        break
      default:
        viewer.clock.clockStep = Number(params.clock_step)
        break
    }
  }
  if (defined(params.clock_range)) {
    const clockRangeValue = String(params.clock_range).toLowerCase()
    switch (clockRangeValue) {
      case 'unbounded':
        viewer.clock.clockRange = 0
        break
      case 'clamped':
        viewer.clock.clockRange = 1
        break
      case 'loop_stop':
        viewer.clock.clockRange = 2
        break
      default:
        viewer.clock.clockRange = Number(params.clock_range)
        break
    }
  }
  if (defined(params.playback_state)) {
    const state = String(params.playback_state).toLowerCase()
    switch (state) {
      case 'play':
        viewer.clock.shouldAnimate = true
        break
      case 'pause':
      case 'stop':
        viewer.clock.shouldAnimate = false
        break
      default:
        viewer.clock.shouldAnimate = Boolean(params.playback_state)
        break
    }
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
  if (!obj || !obj.type) {
    console.log('Skipping scenario object with no type', obj)
    return
  }
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
  if (!Array.isArray(events) || events.length === 0) return

  // Convert scenario event times to absolute JulianDate and enqueue
  events.forEach((ev) => {
    const t = ev.time
    let jd
    if (typeof t === 'number') {
      // relative seconds from scenario start
      jd = JulianDate.addSeconds(viewer.clock.startTime, t, new JulianDate())
    } else if (typeof t === 'string') {
      jd = JulianDate.fromDate(new Date(t))
    } else if (t && t.toString) {
      try { jd = JulianDate.fromDate(new Date(String(t))) } catch (_) { /* ignore */ }
    }
    if (!jd) return

    const type = String(ev.type || '').toLowerCase()
    const data = { ...ev }
    delete data.time
    delete data.type

    // Enqueue using the universe event queue (handlers registered in Universe)
    universe.scheduleEvent({ time: jd, type, data })
  })
}

/**
 * Apply a full scenario object: simulation parameters, objects, and events.
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer.
 * @param {Object} config - Parsed scenario JSON.
 */
export function loadScenario(universe, viewer, config) {
  if (config.simulationParameters) applySimulationParameters(viewer, config.simulationParameters)
  if (Array.isArray(config.objects)) config.objects.forEach((o, i) => addScenarioObject(universe, viewer, { ...o, __index: i }))
  if (Array.isArray(config.events)) scheduleScenarioEvents(universe, viewer, config.events)
}

/**
 * Parse scenario JSON text and apply it.
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer.
 * @param {string} text - Scenario JSON as a string.
 */
export function loadScenarioFromText(universe, viewer, text) {
  const cfg = JSON.parse(text || '{}')
  loadScenario(universe, viewer, cfg)
}
