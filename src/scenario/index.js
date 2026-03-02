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

import {
  CallbackProperty,
  Cartesian3,
  Color,
  defined,
  JulianDate,
  Matrix3,
  Matrix4,
  Quaternion,
  Transforms,
  Viewer
} from 'cesium'
import Universe from '../engine/Universe.js'

const DEFAULT_MODEL_MINIMUM_PIXEL_SIZE = 64
const DEFAULT_MODEL_MAXIMUM_SCALE = 20000

const _scratchEnuToFixedTransform = new Matrix4()
const _scratchEnuToFixedRotation = new Matrix3()
const _scratchBodyToEnuRotation = new Matrix3()
const _scratchBodyOffsetRotation = new Matrix3()
const _scratchRotX = new Matrix3()
const _scratchRotY = new Matrix3()
const _scratchBodyToFixedRotation = new Matrix3()

function resolveScenarioColor(input) {
  if (Array.isArray(input) && input.length === 3) {
    const components = input.map((value) => Number(value))
    if (components.every((value) => Number.isFinite(value))) {
      const useByteScale = components.some((value) => Math.abs(value) > 1)
      const rgbBytes = components
        .map((value) => (useByteScale ? value : value * 255))
        .map((value) => Math.max(0, Math.min(255, Math.round(value))))
      return Color.fromBytes(rgbBytes[0], rgbBytes[1], rgbBytes[2], 255)
    }
  }

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed || trimmed.toLowerCase() === 'random') {
      return Color.fromRandom({ alpha: 1.0 })
    }

    const cssColor = Color.fromCssColorString(trimmed)
    if (cssColor) {
      cssColor.alpha = 1.0
      return cssColor
    }
  }

  return Color.fromRandom({ alpha: 1.0 })
}

function numberOr(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function resolveGimbalAxisSlewRate(entry) {
  let maxRateDegPerSec
  let maxAccelDegPerSec2

  if (typeof entry === 'number' || typeof entry === 'string') {
    maxRateDegPerSec = Number(entry)
  } else if (defined(entry) && typeof entry === 'object') {
    maxRateDegPerSec = Number(
      entry.max_rate ??
      entry.maxRate ??
      entry.maxRateDegPerSec ??
      entry.max_rate_deg_per_sec ??
      entry.max_rate_deg_s ??
      entry.rate ??
      entry.slew_rate_deg_per_sec
    )
    maxAccelDegPerSec2 = Number(
      entry.max_accel ??
      entry.maxAccel ??
      entry.maxAccelDegPerSec2 ??
      entry.max_accel_deg_per_sec2 ??
      entry.max_accel_deg_s2 ??
      entry.accel ??
      entry.acceleration_deg_per_sec2
    )
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

function resolveGimbalSlewRates(input) {
  if (!defined(input) || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }
  const out = {}
  Object.keys(input).forEach((axisName) => {
    const axis = String(axisName).trim()
    if (!axis) return
    const axisRate = resolveGimbalAxisSlewRate(input[axisName])
    if (axisRate) {
      out[axis] = axisRate
    }
  })
  return Object.keys(out).length > 0 ? out : undefined
}

function resolveSensorMaxDistance(input) {
  const meters = Number(
    input.sensor_max_distance ??
    input.sensorMaxDistance ??
    input.max_sensor_distance ??
    input.maxSensorDistance ??
    input.max_distance ??
    input.maxDistance ??
    input.sensor_range ??
    input.sensorRange ??
    input.range
  )
  return (Number.isFinite(meters) && meters > 0) ? meters : undefined
}

function resolveVector3(value, fallback = [0, 0, 0]) {
  if (value instanceof Cartesian3) {
    return Cartesian3.clone(value)
  }
  if (Array.isArray(value) && value.length >= 3) {
    return new Cartesian3(numberOr(value[0]), numberOr(value[1]), numberOr(value[2]))
  }
  if (defined(value) && typeof value === 'object') {
    return new Cartesian3(numberOr(value.x), numberOr(value.y), numberOr(value.z))
  }
  return new Cartesian3(numberOr(fallback[0]), numberOr(fallback[1]), numberOr(fallback[2]))
}

function resolveVelocityNed(entry, headingDeg) {
  const vNedInput = entry.velocity_ned ?? entry.velocityNed ?? entry.velocity
  if (defined(vNedInput)) {
    return resolveVector3(vNedInput)
  }

  const vEnuInput = entry.velocity_enu ?? entry.velocityEnu
  if (defined(vEnuInput)) {
    const vEnu = resolveVector3(vEnuInput)
    return new Cartesian3(vEnu.y, vEnu.x, -vEnu.z)
  }

  const speed = numberOr(entry.speed ?? entry.horizontal_speed ?? entry.ground_speed)
  const headingRad = numberOr(headingDeg) * Math.PI / 180
  const verticalSpeed = numberOr(entry.vertical_speed ?? entry.climb_rate)
  const vn = speed * Math.cos(headingRad)
  const ve = speed * Math.sin(headingRad)
  const vd = -verticalSpeed
  return new Cartesian3(vn, ve, vd)
}

function resolveAccelerationNed(entry) {
  const aNedInput = entry.acceleration_ned ?? entry.accelerationNed ?? entry.acceleration
  if (defined(aNedInput)) {
    return resolveVector3(aNedInput)
  }

  const aEnuInput = entry.acceleration_enu ?? entry.accelerationEnu
  if (defined(aEnuInput)) {
    const aEnu = resolveVector3(aEnuInput)
    return new Cartesian3(aEnu.y, aEnu.x, -aEnu.z)
  }

  return new Cartesian3()
}

function resolveModelOffset(value) {
  if (!defined(value)) {
    return new Cartesian3()
  }

  if (value instanceof Cartesian3) {
    return Cartesian3.clone(value)
  }

  if (Array.isArray(value) && value.length >= 3) {
    return new Cartesian3(numberOr(value[0]), numberOr(value[1]), numberOr(value[2]))
  }

  if (typeof value === 'object') {
    return new Cartesian3(numberOr(value.x), numberOr(value.y), numberOr(value.z))
  }

  return new Cartesian3()
}

function isNonZeroVector3(v) {
  return defined(v) && (v.x !== 0 || v.y !== 0 || v.z !== 0)
}

function resolveScenarioModel(input) {
  const fallback = {
    modelGraphics: undefined,
    headingOffset: 0,
    pitchOffset: 0,
    rollOffset: 0,
    modelOffset: new Cartesian3()
  }
  if (!defined(input)) {
    return fallback
  }

  if (typeof input === 'string') {
    const uri = input.trim()
    if (!uri) {
      return fallback
    }
    return {
      modelGraphics: {
        uri,
        minimumPixelSize: DEFAULT_MODEL_MINIMUM_PIXEL_SIZE,
        maximumScale: DEFAULT_MODEL_MAXIMUM_SCALE
      },
      headingOffset: 0,
      pitchOffset: 0,
      rollOffset: 0,
      modelOffset: new Cartesian3()
    }
  }

  if (typeof input !== 'object') {
    return fallback
  }

  const modelGraphics = { ...input }
  const uriInput = modelGraphics.uri
  const uri = defined(uriInput) ? String(uriInput).trim() : ''
  if (!uri) {
    return fallback
  }
  modelGraphics.uri = uri

  const headingOffset = numberOr(modelGraphics.heading_offset)
  const pitchOffset = numberOr(modelGraphics.pitch_offset)
  const rollOffset = numberOr(modelGraphics.roll_offset)
  const modelOffset = resolveModelOffset(modelGraphics.offset)

  const minPixSize = numberOr(
    modelGraphics.min_pix_size,
    DEFAULT_MODEL_MINIMUM_PIXEL_SIZE
  )
  const maxScale = numberOr(
    modelGraphics.max_scale,
    DEFAULT_MODEL_MAXIMUM_SCALE
  )

  modelGraphics.minimumPixelSize = minPixSize
  modelGraphics.maximumScale = maxScale

  delete modelGraphics.min_pix_size
  delete modelGraphics.max_scale

  delete modelGraphics.heading_offset
  delete modelGraphics.pitch_offset
  delete modelGraphics.roll_offset
  delete modelGraphics.offset

  return { modelGraphics, headingOffset, pitchOffset, rollOffset, modelOffset }
}

function resolveScenarioModelVisualizerOptions(input) {
  const resolved = resolveScenarioModel(input)
  if (!defined(resolved.modelGraphics)) {
    return { ...resolved, visualizerModelOptions: undefined }
  }

  const visualizerModelOptions = { model: resolved.modelGraphics }
  if (isNonZeroVector3(resolved.modelOffset)) {
    visualizerModelOptions.offset = Cartesian3.clone(resolved.modelOffset)
  }
  return { ...resolved, visualizerModelOptions }
}

function createAirVehicleModelOrientationProperty(vehicle, universe, headingOffset = 0, pitchOffset = 0, rollOffset = 0) {
  return new CallbackProperty((time, result) => {
    vehicle.update(time, universe)
    const position = vehicle.position
    if (!defined(position)) {
      return Quaternion.clone(Quaternion.IDENTITY, result)
    }

    // Vehicle heading is defined clockwise from north. Build a right-handed
    // body frame in ENU where +X is forward, +Y is left, and +Z is up.
    const headingRad = numberOr(vehicle.heading + headingOffset) * Math.PI / 180
    const sinHeading = Math.sin(headingRad)
    const cosHeading = Math.cos(headingRad)
    _scratchBodyToEnuRotation[0] = sinHeading
    _scratchBodyToEnuRotation[1] = cosHeading
    _scratchBodyToEnuRotation[2] = 0
    _scratchBodyToEnuRotation[3] = -cosHeading
    _scratchBodyToEnuRotation[4] = sinHeading
    _scratchBodyToEnuRotation[5] = 0
    _scratchBodyToEnuRotation[6] = 0
    _scratchBodyToEnuRotation[7] = 0
    _scratchBodyToEnuRotation[8] = 1

    const pitchOffsetRad = numberOr(pitchOffset) * Math.PI / 180
    const rollOffsetRad = numberOr(rollOffset) * Math.PI / 180
    Matrix3.fromRotationY(pitchOffsetRad, _scratchRotY)
    Matrix3.fromRotationX(rollOffsetRad, _scratchRotX)
    Matrix3.multiply(_scratchRotY, _scratchRotX, _scratchBodyOffsetRotation)
    Matrix3.multiply(_scratchBodyToEnuRotation, _scratchBodyOffsetRotation, _scratchBodyToEnuRotation)

    const enuToFixedTransform = Transforms.eastNorthUpToFixedFrame(position, undefined, _scratchEnuToFixedTransform)
    const enuToFixedRotation = Matrix4.getMatrix3(enuToFixedTransform, _scratchEnuToFixedRotation)
    const bodyToFixedRotation = Matrix3.multiply(enuToFixedRotation, _scratchBodyToEnuRotation, _scratchBodyToFixedRotation)
    return Quaternion.fromRotationMatrix(bodyToFixedRotation, result)
  }, false)
}

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
 * @param {Object<string, number|Object>} [obs.gimbal_slew_rates] - Optional per-axis slew settings.
 * @param {number|string} [obs.sensor_max_distance] - Optional fallback sensor range in meters when idle.
 * @param {string|Object} [obs.model] - Optional 3D model URI or Cesium model options.
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
    obs.field_of_regard ?? [],
    resolveGimbalSlewRates(
      obs.gimbal_slew_rates ??
      obs.gimbalSlewRates ??
      obs.slew_rates ??
      obs.slewRates
    ),
    resolveSensorMaxDistance(obs)
  )

  const desc = `<div><b>${obs.name}</b><br>` +
    `Latitude: ${obs.latitude} deg<br>` +
    `Longitude: ${obs.longitude} deg<br>` +
    `Altitude: ${obs.altitude ?? 0} m</div>`

  const { visualizerModelOptions } = resolveScenarioModelVisualizerOptions(obs.model)
  viewer.addObservatoryVisualizer(o, desc, visualizerModelOptions)
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
 * @param {string|Array<number>} [entry.color='random'] - Visualization color for the satellite.
 * @param {string|Object} [entry.model] - Optional 3D model URI or Cesium model options.
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

  const color = resolveScenarioColor(entry.color)
  const desc = `Two-body initial state @ ${entry.epoch || 'current'}<br>` +
    `r[m]=${JSON.stringify(r_m)}<br>v[m/s]=${JSON.stringify(v_m_s)}`
  const lead = (s && s.period) ? (s.period / 2) : 1800
  const trail = (s && s.period) ? (s.period / 2) : 1800
  const res = (s && s.period && s.eccentricity !== undefined) ? (s.period / (500 / (1 - s.eccentricity))) : 60
  const { visualizerModelOptions } = resolveScenarioModelVisualizerOptions(entry.model)

  viewer.addObjectVisualizer(s, desc, {
    path: { show: false, leadTime: lead, trailTime: trail, resolution: res, material: color, width: 1 },
    point: { show: true, pixelSize: 2, color: color, outlineColor: color },
    ...(visualizerModelOptions ?? {})
  })
}

/**
 * Add an air vehicle (drone/UAV) and attach a simple visualizer.
 *
 * @param {Universe} universe - The SatSim Universe instance.
 * @param {Viewer} viewer - The SatSim viewer.
 * @param {Object} entry - Air vehicle definition.
 * @param {string} [entry.name] - Object name.
 * @param {number|string} [entry.latitude] - Latitude in degrees.
 * @param {number|string} [entry.longitude] - Longitude in degrees.
 * @param {number|string} [entry.altitude=0] - Altitude in meters.
 * @param {Array<number>} [entry.velocity_ned] - Velocity [north,east,down] in m/s.
 * @param {Array<number>} [entry.acceleration_ned] - Acceleration [north,east,down] in m/s^2.
 * @param {number|string} [entry.heading] - Heading in degrees clockwise from north.
 * @param {string|Date} [entry.epoch] - Epoch as ISO string or Date.
 * @param {string|Array<number>} [entry.color='random'] - Visualization color.
 * @param {string|Object} [entry.model] - Optional 3D model URI or Cesium model options.
 */
export function addAirVehicle(universe, viewer, entry, idx = 0) {
  const name = entry.name || `AirVehicle-${idx + 1}`
  if (universe.hasObject && universe.hasObject(name)) {
    console.log(`Air vehicle with name ${name} already exists, skipping creation.`)
    return
  }

  const latitude = numberOr(entry.latitude ?? entry.lat, NaN)
  const longitude = numberOr(entry.longitude ?? entry.lon ?? entry.lng, NaN)
  const altitude = numberOr(entry.altitude ?? entry.alt)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    console.log(`Skipping air vehicle ${name}: invalid latitude/longitude.`)
    return
  }

  const headingInput = entry.heading ?? entry.direction
  const heading = headingInput == null ? undefined : numberOr(headingInput)
  const velocityNed = resolveVelocityNed(entry, heading ?? 0)
  const accelerationNed = resolveAccelerationNed(entry)
  const epoch = entry.epoch ? JulianDate.fromDate(new Date(entry.epoch)) : viewer.clock.currentTime.clone()
  const {
    modelGraphics,
    headingOffset,
    pitchOffset,
    rollOffset,
    visualizerModelOptions
  } = resolveScenarioModelVisualizerOptions(entry.model)

  const v = universe.addAirVehicle(
    name,
    latitude,
    longitude,
    altitude,
    velocityNed,
    accelerationNed,
    heading,
    epoch,
    true
  )

  const color = resolveScenarioColor(entry.color)
  const headingDisplay = numberOr(heading, defined(v) ? v.heading : 0)
  const desc = `Air vehicle initial state @ ${entry.epoch || 'current'}<br>` +
    `lat=${latitude.toFixed(6)} deg, lon=${longitude.toFixed(6)} deg, alt=${altitude.toFixed(1)} m<br>` +
    `v_ned[m/s]=${JSON.stringify([velocityNed.x, velocityNed.y, velocityNed.z])}<br>` +
    `a_ned[m/s^2]=${JSON.stringify([accelerationNed.x, accelerationNed.y, accelerationNed.z])}<br>` +
    `heading=${headingDisplay.toFixed(2)} deg`

  const visualizerOptions = {
    path: { show: false, leadTime: 600, trailTime: 600, resolution: 5, material: color, width: 1 },
    point: { show: true, pixelSize: 4, color: color, outlineColor: color },
    ...(visualizerModelOptions ?? {})
  }
  if (defined(modelGraphics)) {
    visualizerOptions.orientation = createAirVehicleModelOrientationProperty(v, universe, headingOffset, pitchOffset, rollOffset)
  }
  viewer.addObjectVisualizer(v, desc, visualizerOptions)
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
 * @param {string|Array<number>} [color='random'] - Visualization color for the satellite.
 * @param {string|Object} [modelInput] - Optional 3D model URI or Cesium model options.
 */
export function addSatelliteFromTLE(universe, viewer, name, tle1, tle2, orientation = 'nadir', colorInput, modelInput) {
  const s = universe.addSGP4Satellite(name, tle1, tle2, orientation || 'nadir', true)
  const color = resolveScenarioColor(colorInput)
  const lead = (s && s.period) ? (s.period / 2) : 1800
  const trail = (s && s.period) ? (s.period / 2) : 1800
  const res = (s && s.period && s.eccentricity !== undefined) ? (s.period / (500 / (1 - s.eccentricity))) : 60
  const { visualizerModelOptions } = resolveScenarioModelVisualizerOptions(modelInput)
  
  viewer.addObjectVisualizer(s, 'TLE', {
    path: { show: false, leadTime: lead, trailTime: trail, resolution: res, material: color, width: 1 },
    point: { show: true, pixelSize: 2, color: color, outlineColor: color },
    ...(visualizerModelOptions ?? {})
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
 * - model: Optional 3D model URI or Cesium model options applied to each catalog object.
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
    addSatelliteFromTLE(universe, viewer, sat.name, sat.l1, sat.l2, obj.orientation, obj.color, obj.model)
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
 * TwoBodySatellite (and aliases), AirVehicle (and aliases).
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
        gimbal_slew_rates: (obj.gimbal_slew_rates != null ? obj.gimbal_slew_rates : obj.gimbalSlewRates),
        sensor_max_distance: (
          obj.sensor_max_distance != null
            ? obj.sensor_max_distance
            : (obj.sensorMaxDistance != null ? obj.sensorMaxDistance : obj.max_sensor_distance)
        ),
        model: obj.model,
      })
      break
    }
    case 'sgp4satellite':
    case 'sgp4': {
      addSatelliteFromTLE(universe, viewer, obj.name || String(obj.tle1 || '').trim(), obj.tle1, obj.tle2, obj.orientation, obj.color, obj.model)
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
        color: obj.color,
        model: obj.model,
      }, obj.__index)
      break
    }
    case 'airvehicle':
    case 'drone':
    case 'uav': {
      addAirVehicle(universe, viewer, {
        name: obj.name,
        latitude: (obj.latitude != null ? obj.latitude : obj.lat),
        longitude: (obj.longitude != null ? obj.longitude : (obj.lon != null ? obj.lon : obj.lng)),
        altitude: (obj.altitude != null ? obj.altitude : obj.alt),
        velocity_ned: (obj.velocity_ned != null ? obj.velocity_ned : (obj.velocityNed != null ? obj.velocityNed : obj.velocity)),
        acceleration_ned: (obj.acceleration_ned != null ? obj.acceleration_ned : (obj.accelerationNed != null ? obj.accelerationNed : obj.acceleration)),
        heading: obj.heading,
        direction: obj.direction,
        speed: obj.speed,
        vertical_speed: obj.vertical_speed,
        climb_rate: obj.climb_rate,
        epoch: obj.epoch,
        color: obj.color,
        model: obj.model,
      }, obj.__index)
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
 * - type: 'stepGimbalAxes' with {observer, axes:{axisName:deltaDeg}}
 *   Steps one or more gimbal axis targets by delta degrees.
 * - type: 'setGimbalAxes' with {observer, axes:{axisName:targetDeg}}
 *   Sets one or more gimbal axis targets in degrees.
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
