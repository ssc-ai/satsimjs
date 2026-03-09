import { Cartesian3, JulianDate, Math as CMath, defined, Cartographic, EllipsoidGeodesic } from 'cesium'
import { clampLatitude, normalizeLongitude, numberOrUndefined, positiveNumberOrUndefined, resolveJulianDateInput } from '../utils.js'

/**
 * Waypoint route compilation and evaluation helpers for geodetic moving objects.
 *
 * The helpers in this module normalize scenario/runtime waypoint input into a
 * deterministic segment list, then evaluate position and NED velocity at any
 * requested time. They are currently used by `AirVehicle`, but are kept in the
 * dynamics layer so the propagation logic is reusable outside the object class.
 */

const ROUTE_DISTANCE_EPSILON_M = 1e-6
const ROUTE_ALTITUDE_EPSILON_M = 1e-6
const ROUTE_HEADING_SAMPLE_MIN_M = 0.1
const ROUTE_HEADING_SAMPLE_MAX_M = 10.0
const TWO_PI = Math.PI * 2

const _scratchCartographic0 = new Cartographic()
const _scratchCartographic1 = new Cartographic()
const _zeroCartesian = new Cartesian3()

function normalizeRouteMode(value, loopValue) {
  const mode = String(value ?? '').trim().toLowerCase()
  if (!mode) {
    return loopValue === true ? 'loop' : 'once'
  }
  if (mode === 'once' || mode === 'loop' || mode === 'pingpong') {
    return mode
  }
  throw new Error(`Unsupported waypoint route mode: ${value}`)
}

function normalizeRadians(rad) {
  let angle = Number(rad)
  if (!Number.isFinite(angle)) return 0
  angle %= TWO_PI
  if (angle < 0) angle += TWO_PI
  return angle
}

function computeHeadingRadBetweenCartographics(start, end) {
  const dLon = end.longitude - start.longitude
  const y = Math.sin(dLon) * Math.cos(end.latitude)
  const x = Math.cos(start.latitude) * Math.sin(end.latitude) -
    Math.sin(start.latitude) * Math.cos(end.latitude) * Math.cos(dLon)
  return normalizeRadians(Math.atan2(y, x))
}

function createWaypointSegment(startWaypoint, endWaypoint, durationSec, startRelTime) {
  const geodesic = new EllipsoidGeodesic(startWaypoint.cartographic, endWaypoint.cartographic)
  const surfaceDistance = Number.isFinite(geodesic.surfaceDistance) ? geodesic.surfaceDistance : 0
  const groundSpeedMps = surfaceDistance > ROUTE_DISTANCE_EPSILON_M ? surfaceDistance / durationSec : 0
  const verticalRateMps = (endWaypoint.altitude - startWaypoint.altitude) / durationSec
  return {
    startWaypoint,
    endWaypoint,
    durationSec,
    startRelTime,
    endRelTime: startRelTime + durationSec,
    geodesic,
    surfaceDistance,
    groundSpeedMps,
    verticalRateMps
  }
}

function resolveWaypointHeadingRad(segment, distanceAlongLeg) {
  if (!(segment.surfaceDistance > ROUTE_DISTANCE_EPSILON_M)) {
    return undefined
  }

  const sampleDistance = Math.min(
    ROUTE_HEADING_SAMPLE_MAX_M,
    Math.max(ROUTE_HEADING_SAMPLE_MIN_M, segment.surfaceDistance * 1e-5, segment.surfaceDistance * 0.5)
  )
  const d0 = Math.max(0, distanceAlongLeg - sampleDistance)
  const d1 = Math.min(segment.surfaceDistance, distanceAlongLeg + sampleDistance)

  if (d1 - d0 <= ROUTE_DISTANCE_EPSILON_M) {
    if (distanceAlongLeg <= ROUTE_DISTANCE_EPSILON_M) {
      return normalizeRadians(segment.geodesic.startHeading)
    }
    if (distanceAlongLeg >= segment.surfaceDistance - ROUTE_DISTANCE_EPSILON_M) {
      return normalizeRadians(segment.geodesic.endHeading)
    }
  }

  const c0 = segment.geodesic.interpolateUsingSurfaceDistance(d0, _scratchCartographic0)
  const c1 = segment.geodesic.interpolateUsingSurfaceDistance(d1, _scratchCartographic1)
  return computeHeadingRadBetweenCartographics(c0, c1)
}

function sampleWaypointSegment(segment, routeTimeSec) {
  const elapsedSec = Math.max(0, Math.min(segment.durationSec, routeTimeSec - segment.startRelTime))
  const fraction = segment.durationSec > 0 ? (elapsedSec / segment.durationSec) : 1
  let latitude = segment.startWaypoint.latitude
  let longitude = segment.startWaypoint.longitude
  let altitude = segment.startWaypoint.altitude + (segment.endWaypoint.altitude - segment.startWaypoint.altitude) * fraction
  const velocityNed = new Cartesian3(0, 0, -segment.verticalRateMps)

  if (segment.surfaceDistance > ROUTE_DISTANCE_EPSILON_M) {
    const distanceAlongLeg = segment.surfaceDistance * fraction
    const cartographic = segment.geodesic.interpolateUsingSurfaceDistance(distanceAlongLeg, _scratchCartographic0)
    latitude = clampLatitude(cartographic.latitude * CMath.DEGREES_PER_RADIAN)
    longitude = normalizeLongitude(cartographic.longitude * CMath.DEGREES_PER_RADIAN)
    const headingRad = resolveWaypointHeadingRad(segment, distanceAlongLeg)
    if (Number.isFinite(headingRad)) {
      velocityNed.x = segment.groundSpeedMps * Math.cos(headingRad)
      velocityNed.y = segment.groundSpeedMps * Math.sin(headingRad)
    }
  } else {
    latitude = segment.startWaypoint.latitude + (segment.endWaypoint.latitude - segment.startWaypoint.latitude) * fraction
    longitude = normalizeLongitude(segment.startWaypoint.longitude + (segment.endWaypoint.longitude - segment.startWaypoint.longitude) * fraction)
    velocityNed.x = 0
    velocityNed.y = 0
  }

  return { latitude, longitude, altitude, velocityNed }
}

/**
 * Clone a public waypoint route description.
 *
 * Use this when returning route state to callers so the compiled route internals
 * remain encapsulated and callers cannot mutate the active route in place.
 *
 * @param {Object|undefined} route - Public waypoint route object.
 * @returns {Object|undefined} Deep clone of the supplied public route.
 */
export function cloneWaypointRoute(route) {
  if (!route) return undefined
  return {
    mode: route.mode,
    loop: route.loop,
    ...(route.startTime ? { startTime: JulianDate.clone(route.startTime, new JulianDate()) } : {}),
    ...(route.defaultSpeedMps !== undefined ? { defaultSpeedMps: route.defaultSpeedMps } : {}),
    ...(route.loopSpeedMps !== undefined ? { loopSpeedMps: route.loopSpeedMps } : {}),
    waypoints: route.waypoints.map((waypoint) => ({
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
      altitude: waypoint.altitude,
      ...(waypoint.time ? { time: JulianDate.clone(waypoint.time, new JulianDate()) } : {}),
      ...(waypoint.offsetSec !== undefined ? { offsetSec: waypoint.offsetSec } : {}),
      ...(waypoint.speedMps !== undefined ? { speedMps: waypoint.speedMps } : {}),
    }))
  }
}

/**
 * Compile a waypoint route into a time-resolved sequence of geodesic segments.
 *
 * Supported route modes are:
 * - `once`: fly the forward route once and hold at the final waypoint
 * - `loop`: repeat the route, adding a closing leg back to waypoint 0 when needed
 * - `pingpong`: traverse the route forward and then reverse back through the same legs
 *
 * Waypoint timing is resolved sequentially with precedence `time`, `offsetSec`,
 * inbound `speedMps`, then route-level `defaultSpeedMps`.
 *
 * @param {Object} route - Route definition with `waypoints` and optional timing/mode fields.
 * @param {JulianDate|Date|string} [atTime] - Fallback epoch for the first waypoint when the route does not provide `startTime`.
 * @returns {Object} Compiled waypoint route with public metadata and internal segment state.
 * @throws {Error} Throws when the route cannot be normalized into a valid monotonic segment list.
 */
export function compileWaypointRoute(route, atTime) {
  if (!defined(route) || typeof route !== 'object' || Array.isArray(route)) {
    throw new Error('Waypoint route must be an object.')
  }

  const mode = normalizeRouteMode(route.mode, route.loop === true)
  const defaultSpeedMps = positiveNumberOrUndefined(route.defaultSpeedMps ?? route.default_speed_mps)
  const loopSpeedMps = positiveNumberOrUndefined(route.loopSpeedMps ?? route.loop_speed_mps)
  const startTime = resolveJulianDateInput(route.startTime ?? route.start_time)
  const waypointInputs = Array.isArray(route.waypoints) ? route.waypoints : undefined

  if (defined(route.startTime ?? route.start_time) && !startTime) {
    throw new Error('Waypoint route has an invalid startTime.')
  }
  if (
    (defined(route.defaultSpeedMps) || defined(route.default_speed_mps)) &&
    !(Number.isFinite(defaultSpeedMps) && defaultSpeedMps > 0)
  ) {
    throw new Error('Waypoint route has an invalid defaultSpeedMps.')
  }
  if (
    (defined(route.loopSpeedMps) || defined(route.loop_speed_mps)) &&
    !(Number.isFinite(loopSpeedMps) && loopSpeedMps > 0)
  ) {
    throw new Error('Waypoint route has an invalid loopSpeedMps.')
  }

  if (!(Array.isArray(waypointInputs) && waypointInputs.length >= 2)) {
    throw new Error('Waypoint route requires at least two waypoints.')
  }

  const waypoints = waypointInputs.map((entry, index) => {
    if (!defined(entry) || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Waypoint ${index} must be an object.`)
    }

    const latitude = numberOrUndefined(entry.latitude ?? entry.lat)
    const longitude = numberOrUndefined(entry.longitude ?? entry.lon ?? entry.lng)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error(`Waypoint ${index} is missing latitude/longitude.`)
    }

    const altitude = numberOrUndefined(entry.altitude ?? entry.alt) ?? 0
    const offsetSec = numberOrUndefined(entry.offsetSec ?? entry.offset_sec)
    const speedMps = positiveNumberOrUndefined(entry.speedMps ?? entry.speed_mps)
    const time = resolveJulianDateInput(entry.time)
    if (defined(entry.time) && !time) {
      throw new Error(`Waypoint ${index} has an invalid time.`)
    }
    if (
      (defined(entry.speedMps) || defined(entry.speed_mps)) &&
      !(Number.isFinite(speedMps) && speedMps > 0)
    ) {
      throw new Error(`Waypoint ${index} has an invalid speed.`)
    }

    return {
      latitude: clampLatitude(latitude),
      longitude: normalizeLongitude(longitude),
      altitude,
      time,
      offsetSec,
      speedMps,
      cartographic: Cartographic.fromDegrees(normalizeLongitude(longitude), clampLatitude(latitude), altitude)
    }
  })

  const resolvedWaypoints = []
  const forwardSegments = []
  const routeBaseTime = startTime ?? resolveJulianDateInput(atTime) ?? JulianDate.now()
  let previousWaypoint = undefined
  let previousTime = undefined

  for (let i = 0; i < waypoints.length; i++) {
    const waypoint = waypoints[i]
    let arrivalTime
    if (waypoint.time) {
      arrivalTime = JulianDate.clone(waypoint.time, new JulianDate())
    } else if (Number.isFinite(waypoint.offsetSec)) {
      const offsetBase = previousTime ?? routeBaseTime
      arrivalTime = JulianDate.addSeconds(offsetBase, waypoint.offsetSec, new JulianDate())
    } else if (i === 0) {
      arrivalTime = JulianDate.clone(routeBaseTime, new JulianDate())
    } else {
      const speedMps = waypoint.speedMps ?? defaultSpeedMps
      if (!(Number.isFinite(speedMps) && speedMps > 0)) {
        throw new Error(`Waypoint ${i} cannot resolve its arrival time.`)
      }
      const legGeodesic = new EllipsoidGeodesic(previousWaypoint.cartographic, waypoint.cartographic)
      const legDistance = Number.isFinite(legGeodesic.surfaceDistance) ? legGeodesic.surfaceDistance : 0
      const durationSec = legDistance / speedMps
      if (!(Number.isFinite(durationSec) && durationSec > 0)) {
        throw new Error(`Waypoint ${i} cannot derive a positive leg duration from speed.`)
      }
      arrivalTime = JulianDate.addSeconds(previousTime, durationSec, new JulianDate())
    }

    if (previousTime) {
      const durationSec = JulianDate.secondsDifference(arrivalTime, previousTime)
      if (!(Number.isFinite(durationSec) && durationSec > 0)) {
        throw new Error(`Waypoint ${i} must occur after waypoint ${i - 1}.`)
      }
      forwardSegments.push(createWaypointSegment(previousWaypoint, waypoint, durationSec, forwardSegments.length > 0 ? forwardSegments[forwardSegments.length - 1].endRelTime : 0))
    }

    const resolvedWaypoint = {
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
      altitude: waypoint.altitude,
      time: JulianDate.clone(arrivalTime, new JulianDate()),
      ...(Number.isFinite(waypoint.offsetSec) ? { offsetSec: waypoint.offsetSec } : {}),
      ...(Number.isFinite(waypoint.speedMps) ? { speedMps: waypoint.speedMps } : {}),
      cartographic: Cartographic.fromDegrees(waypoint.longitude, waypoint.latitude, waypoint.altitude)
    }
    resolvedWaypoints.push(resolvedWaypoint)
    previousWaypoint = resolvedWaypoint
    previousTime = arrivalTime
  }

  const forwardDurationSec = forwardSegments.length > 0 ? forwardSegments[forwardSegments.length - 1].endRelTime : 0
  let cycleSegments = forwardSegments.slice()
  let cycleDurationSec = forwardDurationSec

  if (mode === 'pingpong') {
    const reverseSegments = []
    let reverseStart = forwardDurationSec
    for (let i = forwardSegments.length - 1; i >= 0; i--) {
      const segment = forwardSegments[i]
      const reversed = createWaypointSegment(segment.endWaypoint, segment.startWaypoint, segment.durationSec, reverseStart)
      reverseSegments.push(reversed)
      reverseStart = reversed.endRelTime
    }
    cycleSegments = cycleSegments.concat(reverseSegments)
    cycleDurationSec = reverseSegments.length > 0 ? reverseSegments[reverseSegments.length - 1].endRelTime : forwardDurationSec
  } else if (mode === 'loop') {
    const firstWaypoint = resolvedWaypoints[0]
    const lastWaypoint = resolvedWaypoints[resolvedWaypoints.length - 1]
    const closeDistance = new EllipsoidGeodesic(lastWaypoint.cartographic, firstWaypoint.cartographic).surfaceDistance
    const altitudeDelta = Math.abs(firstWaypoint.altitude - lastWaypoint.altitude)
    const isAlreadyClosed = closeDistance <= ROUTE_DISTANCE_EPSILON_M && altitudeDelta <= ROUTE_ALTITUDE_EPSILON_M

    if (!isAlreadyClosed) {
      const fallbackLoopSpeed = forwardSegments.length > 0 ? forwardSegments[forwardSegments.length - 1].groundSpeedMps : undefined
      const closeSpeed = loopSpeedMps ?? defaultSpeedMps ?? fallbackLoopSpeed
      if (!(Number.isFinite(closeSpeed) && closeSpeed > 0)) {
        throw new Error('Loop routes require loopSpeedMps, defaultSpeedMps, or a resolvable last forward-leg speed.')
      }
      const closeDurationSec = closeDistance / closeSpeed
      if (!(Number.isFinite(closeDurationSec) && closeDurationSec > 0)) {
        throw new Error('Loop route could not resolve a positive closing-leg duration.')
      }
      const closingSegment = createWaypointSegment(lastWaypoint, firstWaypoint, closeDurationSec, forwardDurationSec)
      cycleSegments = cycleSegments.concat(closingSegment)
      cycleDurationSec = closingSegment.endRelTime
    }
  }

  const publicRoute = {
    mode,
    loop: mode === 'loop',
    startTime: JulianDate.clone(resolvedWaypoints[0].time, new JulianDate()),
    ...(defaultSpeedMps !== undefined ? { defaultSpeedMps } : {}),
    ...(loopSpeedMps !== undefined ? { loopSpeedMps } : {}),
    waypoints: resolvedWaypoints.map((waypoint) => ({
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
      altitude: waypoint.altitude,
      time: JulianDate.clone(waypoint.time, new JulianDate()),
      ...(waypoint.offsetSec !== undefined ? { offsetSec: waypoint.offsetSec } : {}),
      ...(waypoint.speedMps !== undefined ? { speedMps: waypoint.speedMps } : {})
    }))
  }

  return {
    mode,
    startTime: JulianDate.clone(resolvedWaypoints[0].time, new JulianDate()),
    defaultSpeedMps,
    loopSpeedMps,
    waypoints: resolvedWaypoints,
    forwardSegments,
    cycleSegments,
    forwardDurationSec,
    cycleDurationSec,
    publicRoute
  }
}

/**
 * Evaluate a compiled waypoint route at a specific time.
 *
 * The returned state contains geodetic position and local NED velocity derived
 * from the active leg's geodesic heading and vertical rate. Before route start,
 * the first waypoint is held. After completion in `once` mode, the last waypoint
 * is held with zero velocity.
 *
 * @param {Object} route - Route previously produced by `compileWaypointRoute`.
 * @param {JulianDate} time - Simulation time to sample.
 * @returns {{latitude:number, longitude:number, altitude:number, velocityNed:Cartesian3}} Sampled route state.
 */
export function evaluateWaypointRouteState(route, time) {
  const startWaypoint = route.waypoints[0]
  const endWaypoint = route.waypoints[route.waypoints.length - 1]
  const startDeltaSec = JulianDate.secondsDifference(time, route.startTime)

  if (startDeltaSec < 0) {
    return {
      latitude: startWaypoint.latitude,
      longitude: startWaypoint.longitude,
      altitude: startWaypoint.altitude,
      velocityNed: Cartesian3.clone(_zeroCartesian)
    }
  }

  if (route.mode === 'once' && startDeltaSec >= route.forwardDurationSec) {
    return {
      latitude: endWaypoint.latitude,
      longitude: endWaypoint.longitude,
      altitude: endWaypoint.altitude,
      velocityNed: Cartesian3.clone(_zeroCartesian)
    }
  }

  let routeTimeSec = startDeltaSec
  if (route.mode === 'loop' || route.mode === 'pingpong') {
    if (!(route.cycleDurationSec > 0)) {
      return {
        latitude: startWaypoint.latitude,
        longitude: startWaypoint.longitude,
        altitude: startWaypoint.altitude,
        velocityNed: Cartesian3.clone(_zeroCartesian)
      }
    }
    routeTimeSec %= route.cycleDurationSec
    if (routeTimeSec < 0) routeTimeSec += route.cycleDurationSec
  }

  const segments = route.mode === 'once' ? route.forwardSegments : route.cycleSegments
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (routeTimeSec < segment.endRelTime || i === segments.length - 1) {
      return sampleWaypointSegment(segment, routeTimeSec)
    }
  }

  return {
    latitude: endWaypoint.latitude,
    longitude: endWaypoint.longitude,
    altitude: endWaypoint.altitude,
    velocityNed: Cartesian3.clone(_zeroCartesian)
  }
}
