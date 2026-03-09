import { Cartesian3, JulianDate, ReferenceFrame, Math as CMath, Ellipsoid, defined } from 'cesium'
import { cloneWaypointRoute, compileWaypointRoute, evaluateWaypointRouteState } from '../dynamics/waypoint.js'
import { clampLatitude, normalizeHeading, normalizeLongitude, resolveJulianDateInput, toCartesian3 } from '../utils.js'
import SimObject from './SimObject.js'

const WGS84_ELLIPSOID = Ellipsoid.WGS84
const EARTH_SEMI_MAJOR_AXIS = WGS84_ELLIPSOID.maximumRadius
const EARTH_SEMI_MINOR_AXIS = WGS84_ELLIPSOID.minimumRadius
const EARTH_ECCENTRICITY_SQ = 1.0 - ((EARTH_SEMI_MINOR_AXIS * EARTH_SEMI_MINOR_AXIS) / (EARTH_SEMI_MAJOR_AXIS * EARTH_SEMI_MAJOR_AXIS))
const EARTH_ANGULAR_SPEED = 7.292115146706979e-5
const POLAR_COS_EPSILON = 1e-9
const _omegaEarth = new Cartesian3(0, 0, EARTH_ANGULAR_SPEED)
const _scratchCross = new Cartesian3()
const _scratchInertialVelocity = new Cartesian3()
const _zeroCartesian = new Cartesian3()

/**
 * A simple Earth-fixed air vehicle model (e.g. drone/UAV).
 *
 * State is propagated in geodetic coordinates using local NED kinematics.
 * NED convention:
 * - x: north (m/s)
 * - y: east (m/s)
 * - z: down (m/s)
 *
 * @extends SimObject
 */
class AirVehicle extends SimObject {
  /**
   * Create a new AirVehicle.
   *
   * @param {number} latitude - Initial latitude in degrees.
   * @param {number} longitude - Initial longitude in degrees.
   * @param {number} [altitude=0] - Initial altitude in meters.
   * @param {Cartesian3|Array<number>|Object} [velocityNed] - Initial velocity in NED (m/s).
   * @param {Cartesian3|Array<number>|Object} [accelerationNed] - Constant acceleration in NED (m/s^2).
   * @param {number} [heading] - Heading in degrees (clockwise from north). If omitted, heading auto-follows velocity.
   * @param {JulianDate} [time=JulianDate.now()] - Epoch time for the initial state.
   * @param {string} [name='AirVehicle'] - Object name.
   */
  constructor(latitude, longitude, altitude = 0, velocityNed, accelerationNed, heading, time = JulianDate.now(), name = 'AirVehicle') {
    super(name, ReferenceFrame.FIXED)

    this._latitude = clampLatitude(Number(latitude) || 0)
    this._longitude = normalizeLongitude(Number(longitude) || 0)
    this._altitude = Number(altitude) || 0

    this._velocityNed = toCartesian3(velocityNed)
    this._accelerationNed = toCartesian3(accelerationNed)

    this._autoHeading = !Number.isFinite(Number(heading))
    this._heading = this._autoHeading ? 0 : normalizeHeading(Number(heading))

    this._epoch = {
      time: JulianDate.clone(time),
      latitude: this._latitude,
      longitude: this._longitude,
      altitude: this._altitude,
      velocityNed: Cartesian3.clone(this._velocityNed),
      accelerationNed: Cartesian3.clone(this._accelerationNed),
    }
    this._waypointRoute = undefined
    this._hasDynamicUpdate = false
    this._period = Number.POSITIVE_INFINITY
    this._eccentricity = 0

    this._syncCartesianState()
    this._updateAutoHeading()
    JulianDate.clone(time, this._lastUpdate)
  }

  /**
   * Latitude in degrees.
   */
  get latitude() {
    return this._latitude
  }

  /**
   * Longitude in degrees.
   */
  get longitude() {
    return this._longitude
  }

  /**
   * Altitude in meters.
   */
  get altitude() {
    return this._altitude
  }

  /**
   * Heading in degrees clockwise from north.
   */
  get heading() {
    return this._heading
  }

  set heading(value) {
    this._prepareManualOverride(this._lastUpdate)
    this._autoHeading = false
    this._heading = normalizeHeading(value)
  }

  /**
   * Local NED velocity in m/s.
   */
  get velocityNed() {
    return this._velocityNed
  }

  set velocityNed(value) {
    this._prepareManualOverride(this._lastUpdate)
    Cartesian3.clone(toCartesian3(value), this._velocityNed)
    Cartesian3.clone(this._velocityNed, this._epoch.velocityNed)
    this._updateAutoHeading()
    this._syncFixedVelocityFromNed()
  }

  /**
   * Local NED acceleration in m/s^2.
   */
  get accelerationNed() {
    return this._accelerationNed
  }

  set accelerationNed(value) {
    this._prepareManualOverride(this._lastUpdate)
    Cartesian3.clone(toCartesian3(value), this._accelerationNed)
    Cartesian3.clone(this._accelerationNed, this._epoch.accelerationNed)
  }

  /**
   * Read-only clone of the active waypoint route, if one is installed.
   *
   * The returned object contains the normalized public route definition, not the
   * internal compiled segment cache used during propagation.
   *
   * @returns {Object|undefined} Public waypoint route clone.
   */
  get waypointRoute() {
    return cloneWaypointRoute(this._waypointRoute?.publicRoute)
  }

  /**
   * Whether the vehicle is currently being propagated by a waypoint route.
   *
   * @returns {boolean} `true` when waypoint routing is active.
   */
  get hasWaypointRoute() {
    return defined(this._waypointRoute)
  }

  /**
   * Install a waypoint route and immediately evaluate it at the effective time.
   *
   * The first waypoint is authoritative. If continuity from the current live
   * state is required, callers should include the current state as waypoint 0.
   *
   * @param {Object} route - Waypoint route definition.
   * @param {JulianDate|Date|string} [atTime=this.time] - Time at which the route becomes active.
   * @returns {AirVehicle} The current vehicle instance.
   */
  setWaypointRoute(route, atTime = this.time) {
    const effectiveTime = this._resolveEffectiveTime(atTime)
    const compiled = compileWaypointRoute(route, effectiveTime)
    this._waypointRoute = compiled
    this._applyWaypointRouteState(compiled, effectiveTime)
    this.setTranslation(this._position)
    JulianDate.clone(effectiveTime, this._lastUpdate)
    return this
  }

  /**
   * Remove the active waypoint route and capture the current routed state as the
   * new manual propagation epoch.
   *
   * @param {JulianDate|Date|string} [atTime=this.time] - Time at which to freeze the routed state.
   * @returns {AirVehicle} The current vehicle instance.
   */
  clearWaypointRoute(atTime = this.time) {
    if (!this.hasWaypointRoute) {
      return this
    }
    this._captureWaypointStateAsEpoch(this._resolveEffectiveTime(atTime))
    this._waypointRoute = undefined
    this._hasDynamicUpdate = false
    this.setTranslation(this._position)
    return this
  }

  /**
   * Gets the ECI velocity of the air vehicle.
   * Includes both local motion in fixed frame and Earth rotation.
   */
  get worldVelocity() {
    if (!defined(this.parent) || !defined(this.parent.transformVectorToWorld)) {
      return Cartesian3.clone(this._velocity)
    }
    const vw_x_r = Cartesian3.cross(_omegaEarth, this._position, _scratchCross)
    Cartesian3.add(this._velocity, vw_x_r, _scratchInertialVelocity)
    return this.parent.transformVectorToWorld(_scratchInertialVelocity, new Cartesian3())
  }

  /**
   * Propagate the geodetic state using a simple constant-acceleration NED model.
   *
   * @param {JulianDate} time - Current simulation time.
   * @param {Universe} universe - Universe object.
   * @override
   */
  _update(time, universe) {
    if (this.hasWaypointRoute) {
      this._applyWaypointRouteState(this._waypointRoute, time)
      this._hasDynamicUpdate = true
      return
    }

    const dt = JulianDate.secondsDifference(time, this._epoch.time)
    const vn0 = this._epoch.velocityNed.x
    const ve0 = this._epoch.velocityNed.y
    const vd0 = this._epoch.velocityNed.z
    const an = this._epoch.accelerationNed.x
    const ae = this._epoch.accelerationNed.y
    const ad = this._epoch.accelerationNed.z

    this._velocityNed.x = vn0 + an * dt
    this._velocityNed.y = ve0 + ae * dt
    this._velocityNed.z = vd0 + ad * dt

    const northDisplacement = vn0 * dt + 0.5 * an * dt * dt
    const eastDisplacement = ve0 * dt + 0.5 * ae * dt * dt
    const downDisplacement = vd0 * dt + 0.5 * ad * dt * dt

    const lat0 = this._epoch.latitude
    const lon0 = this._epoch.longitude
    const alt0 = this._epoch.altitude

    const latRad = lat0 * CMath.RADIANS_PER_DEGREE
    const sinLat = Math.sin(latRad)
    const cosLat = Math.cos(latRad)

    const denom = Math.sqrt(1.0 - EARTH_ECCENTRICITY_SQ * sinLat * sinLat)
    const n = EARTH_SEMI_MAJOR_AXIS / denom
    const m = EARTH_SEMI_MAJOR_AXIS * (1.0 - EARTH_ECCENTRICITY_SQ) / (denom * denom * denom)

    const dLat = northDisplacement / (m + alt0)
    let dLon = 0
    if (Math.abs(cosLat) > POLAR_COS_EPSILON) {
      dLon = eastDisplacement / ((n + alt0) * cosLat)
    }
    const altitude = alt0 - downDisplacement

    this._latitude = clampLatitude(lat0 + dLat * CMath.DEGREES_PER_RADIAN)
    this._longitude = normalizeLongitude(lon0 + dLon * CMath.DEGREES_PER_RADIAN)
    this._altitude = altitude

    this._updateAutoHeading()
    this._syncCartesianState()
    this._hasDynamicUpdate = true
  }

  _captureCurrentAsEpoch() {
    const epochTime = this._hasDynamicUpdate ? this._lastUpdate : this._epoch.time
    JulianDate.clone(epochTime, this._epoch.time)
    this._epoch.latitude = this._latitude
    this._epoch.longitude = this._longitude
    this._epoch.altitude = this._altitude
    Cartesian3.clone(this._velocityNed, this._epoch.velocityNed)
    Cartesian3.clone(this._accelerationNed, this._epoch.accelerationNed)
  }

  _prepareManualOverride(atTime) {
    if (this.hasWaypointRoute) {
      this._captureWaypointStateAsEpoch(this._resolveEffectiveTime(atTime))
      this._waypointRoute = undefined
      this._hasDynamicUpdate = false
      return
    }
    this._captureCurrentAsEpoch()
  }

  _resolveEffectiveTime(atTime) {
    const resolved = resolveJulianDateInput(atTime)
    if (resolved) {
      return resolved
    }
    return JulianDate.clone(this._epoch.time, new JulianDate())
  }

  _captureWaypointStateAsEpoch(time) {
    if (!JulianDate.equals(time, this._lastUpdate)) {
      this._applyWaypointRouteState(this._waypointRoute, time)
    }
    JulianDate.clone(time, this._epoch.time)
    this._epoch.latitude = this._latitude
    this._epoch.longitude = this._longitude
    this._epoch.altitude = this._altitude
    Cartesian3.clone(this._velocityNed, this._epoch.velocityNed)
    Cartesian3.clone(_zeroCartesian, this._accelerationNed)
    Cartesian3.clone(this._accelerationNed, this._epoch.accelerationNed)
    JulianDate.clone(time, this._lastUpdate)
  }

  _applyWaypointRouteState(route, time) {
    const state = evaluateWaypointRouteState(route, time)
    this._latitude = state.latitude
    this._longitude = state.longitude
    this._altitude = state.altitude
    this._velocityNed.x = state.velocityNed.x
    this._velocityNed.y = state.velocityNed.y
    this._velocityNed.z = state.velocityNed.z
    Cartesian3.clone(_zeroCartesian, this._accelerationNed)
    this._updateAutoHeading()
    this._syncCartesianState()
  }

  _updateAutoHeading() {
    if (!this._autoHeading) return
    const vn = this._velocityNed.x
    const ve = this._velocityNed.y
    if (Math.abs(vn) < 1e-9 && Math.abs(ve) < 1e-9) return
    const headingRad = Math.atan2(ve, vn)
    this._heading = normalizeHeading(headingRad * CMath.DEGREES_PER_RADIAN)
  }

  _syncCartesianState() {
    Cartesian3.fromDegrees(this._longitude, this._latitude, this._altitude, WGS84_ELLIPSOID, this._position)
    this._syncFixedVelocityFromNed()
  }

  _syncFixedVelocityFromNed() {
    const latRad = this._latitude * CMath.RADIANS_PER_DEGREE
    const lonRad = this._longitude * CMath.RADIANS_PER_DEGREE
    const sinLat = Math.sin(latRad)
    const cosLat = Math.cos(latRad)
    const sinLon = Math.sin(lonRad)
    const cosLon = Math.cos(lonRad)

    const vn = this._velocityNed.x
    const ve = this._velocityNed.y
    const vd = this._velocityNed.z

    this._velocity.x = (-sinLat * cosLon) * vn + (-sinLon) * ve + (-cosLat * cosLon) * vd
    this._velocity.y = (-sinLat * sinLon) * vn + (cosLon) * ve + (-cosLat * sinLon) * vd
    this._velocity.z = (cosLat) * vn + (-sinLat) * vd
  }
}

export default AirVehicle
