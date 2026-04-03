import Earth from "./objects/Earth.js";
import Sun from "./objects/Sun.js";
import SGP4Satellite from "./objects/SGP4Satellite.js";
import EarthGroundStation from "./objects/EarthGroundStation.js";
import AzElGimbal from "./objects/AzElGimbal.js";
import ElectroOpicalSensor from "./objects/ElectroOpticalSensor.js";
import FastSteeringMirror from "./objects/FastSteeringMirror.js";
import Laser from "./objects/Laser.js";
import LagrangeInterpolatedObject from "./objects/LagrangeInterpolatedObject.js";
import TwoBodySatellite from "./objects/TwoBodySatellite.js";
import AirVehicle from "./objects/AirVehicle.js";
import SimObject from "./objects/SimObject.js";
import Observatory from "./objects/Observatory.js";
import {
  defaultObservatorySensorName,
  getObservatorySensors,
  normalizeAxisSlewRates,
  normalizeObservatoryFsmConfig,
  normalizeObservatoryPayloadType,
  normalizeSensorZoomConfig
} from "./objects/observatoryUtils.js";
import { Cartesian3, JulianDate, defined } from "cesium";
import EventQueue from "./event/EventQueue.js";
import { booleanOr, numberOr, toCartesian3OrUndefined } from "./utils.js";

function resolveVelocityNedFromEventData(data, fallbackHeadingDeg = 0) {
  const vNedInput = data.velocity_ned ?? data.velocityNed ?? data.velocity
  if (defined(vNedInput)) {
    return toCartesian3OrUndefined(vNedInput)
  }

  const vEnuInput = data.velocity_enu ?? data.velocityEnu
  if (defined(vEnuInput)) {
    const vEnu = toCartesian3OrUndefined(vEnuInput)
    if (!defined(vEnu)) return undefined
    return new Cartesian3(vEnu.y, vEnu.x, -vEnu.z)
  }

  if (
    defined(data.speed) ||
    defined(data.horizontal_speed) ||
    defined(data.ground_speed) ||
    defined(data.vertical_speed) ||
    defined(data.climb_rate)
  ) {
    const speed = numberOr(data.speed ?? data.horizontal_speed ?? data.ground_speed)
    const headingDeg = numberOr(data.heading ?? data.direction, fallbackHeadingDeg)
    const headingRad = headingDeg * Math.PI / 180
    const verticalSpeed = numberOr(data.vertical_speed ?? data.climb_rate)
    const vn = speed * Math.cos(headingRad)
    const ve = speed * Math.sin(headingRad)
    const vd = -verticalSpeed
    return new Cartesian3(vn, ve, vd)
  }

  return undefined
}

function resolveAccelerationNedFromEventData(data) {
  const aNedInput = data.acceleration_ned ?? data.accelerationNed ?? data.acceleration
  if (defined(aNedInput)) {
    return toCartesian3OrUndefined(aNedInput)
  }

  const aEnuInput = data.acceleration_enu ?? data.accelerationEnu
  if (defined(aEnuInput)) {
    const aEnu = toCartesian3OrUndefined(aEnuInput)
    if (!defined(aEnu)) return undefined
    return new Cartesian3(aEnu.y, aEnu.x, -aEnu.z)
  }

  return undefined
}

function resolveEventObjectName(ev) {
  const data = ev?.data ?? {}
  return data.object ?? data.vehicle ?? data.name ?? data.target ?? ev?.object ?? ev?.vehicle ?? ev?.name ?? ev?.target
}

function resolveAirVehicleForEvent(universe, ev) {
  const objectName = resolveEventObjectName(ev)
  if (!defined(objectName) || !universe.getObject) return undefined
  const obj = universe.getObject(objectName)
  if (!defined(obj)) return undefined
  if (obj instanceof AirVehicle) return obj
  if ('velocityNed' in obj || 'accelerationNed' in obj || 'heading' in obj) return obj
  return undefined
}

/**
 * Find an observatory by its site name.
 *
 * @param {Universe} universe
 * @param {string} observerName
 * @returns {Observatory|undefined}
 */
function findObservatoryByName(universe, observerName) {
  if (!defined(observerName)) return undefined
  const arr = universe?._observatories || []
  for (let i = 0; i < arr.length; i++) {
    const obs = arr[i]
    if (obs?.site?.name === observerName) return obs
  }
  return undefined
}

/**
 * Resolve a target payload within an observatory.
 *
 * When no payload name is provided, the primary payload is returned to preserve
 * legacy single-sensor event behavior.
 *
 * @param {Observatory|Object|undefined} observatory
 * @param {string|undefined} sensorName
 * @returns {Object|undefined}
 */
function findObservatorySensor(observatory, sensorName) {
  const sensors = getObservatorySensors(observatory)
  const normalizedSensorName = String(sensorName ?? '').trim()
  if (!normalizedSensorName) {
    return observatory?.sensor ?? sensors[0]
  }
  for (let i = 0; i < sensors.length; i++) {
    if (sensors[i]?.name === normalizedSensorName) {
      return sensors[i]
    }
  }
  return undefined
}

function collectAxisValues(...sources) {
  const out = {}

  sources.forEach((source) => {
    if (!defined(source) || typeof source !== 'object' || Array.isArray(source)) {
      return
    }
    Object.keys(source).forEach((axisName) => {
      const axis = String(axisName).trim()
      if (!axis) return
      out[axis] = source[axisName]
    })
  })

  return out
}

function applyAxisTargets(controller, axisValues, getOptions = undefined) {
  Object.keys(axisValues).forEach((axisName) => {
    const axis = String(axisName)
    const targetDeg = Number(axisValues[axisName])
    if (!Number.isFinite(targetDeg)) return

    if (typeof controller.setAxisTarget === 'function') {
      controller.setAxisTarget(axis, targetDeg, getOptions?.(axis))
    } else if (Object.prototype.hasOwnProperty.call(controller, axis)) {
      controller[axis] = targetDeg
    }
  })
}

function applyAxisDeltas(controller, axisValues, getOptions = undefined) {
  Object.keys(axisValues).forEach((axisName) => {
    const axis = String(axisName)
    const deltaDeg = Number(axisValues[axisName])
    if (!Number.isFinite(deltaDeg) || deltaDeg === 0) return

    const currentDeg = numberOr(controller[axis], 0)
    if (typeof controller.stepAxisTarget === 'function') {
      controller.stepAxisTarget(axis, deltaDeg, currentDeg, getOptions?.(axis))
    } else if (Object.prototype.hasOwnProperty.call(controller, axis)) {
      controller[axis] = currentDeg + deltaDeg
    }
  })
}

function getGimbalAxisTargetOptions(axis) {
  if (String(axis).toLowerCase() !== 'az') {
    return undefined
  }

  return {
    normalizeTargetDeg: (azDeg) => {
      let wrapped = Number(azDeg) % 360.0
      if (wrapped < 0) wrapped += 360.0
      return wrapped
    }
  }
}

/**
 * Normalize a single observatory payload config into the canonical runtime
 * shape used by observatory construction.
 *
 * @param {Object|undefined} entry
 * @param {string} observatoryName
 * @param {number} [sensorIndex=0]
 * @returns {Object}
 */
function normalizeObservatorySensorConfig(entry, observatoryName, sensorIndex = 0) {
  const payloadType = normalizeObservatoryPayloadType(entry?.type)
  const sensorName = String(entry?.name ?? '').trim() || defaultObservatorySensorName(observatoryName, sensorIndex, payloadType)
  if (payloadType === 'Laser') {
    return {
      type: 'Laser',
      beamDivergence: Number(entry?.beamDivergence ?? entry?.beam_divergence),
      power: Number(entry?.power),
      active: booleanOr(entry?.active, false),
      maxRange: Number(entry?.maxRange ?? entry?.max_range),
      y_fov: Number(entry?.y_fov ?? 0.01),
      x_fov: Number(entry?.x_fov ?? 0.01),
      field_of_regard: entry?.field_of_regard ?? [],
      color: entry?.color,
      name: sensorName
    }
  }
  return {
    type: 'ElectroOpticalSensor',
    height: Number(entry?.height ?? entry?.sensor_height),
    width: Number(entry?.width ?? entry?.sensor_width),
    y_fov: Number(entry?.y_fov ?? 5),
    x_fov: Number(entry?.x_fov ?? 5),
    field_of_regard: entry?.field_of_regard ?? [],
    color: entry?.color,
    zoom: normalizeSensorZoomConfig(entry?.zoom),
    name: sensorName
  }
}

/**
 * Normalize legacy positional observatory arguments or an object-form
 * observatory config into a canonical runtime configuration.
 *
 * @param {string|Object} nameOrConfig
 * @param {number} [latitude]
 * @param {number} [longitude]
 * @param {number} [altitude]
 * @param {string} [gimbalType]
 * @param {number} [height]
 * @param {number} [width]
 * @param {number} [y_fov]
 * @param {number} [x_fov]
 * @param {Array} [field_of_regard]
 * @param {Object<string, number|Object>} [gimbalSlewRates]
 * @param {number} [sensorMaxDistance]
 * @returns {{name:string, latitude:number, longitude:number, altitude:number, gimbalType:string, gimbalSlewRates:Object|undefined, sensorMaxDistance:number|undefined, fsm:Object|undefined, sensors:Array<Object>}}
 */
function normalizeGroundObservatoryConfig(nameOrConfig, latitude, longitude, altitude, gimbalType, height, width, y_fov, x_fov, field_of_regard, gimbalSlewRates, sensorMaxDistance) {
  if (defined(nameOrConfig) && typeof nameOrConfig === 'object' && !Array.isArray(nameOrConfig)) {
    const config = nameOrConfig
    const name = String(config.name ?? '')
    const sensorsInput = Array.isArray(config.sensors) && config.sensors.length > 0
      ? config.sensors
      : [{
        height: config.height ?? config.sensor_height,
        width: config.width ?? config.sensor_width,
        y_fov: config.y_fov,
        x_fov: config.x_fov,
        field_of_regard: config.field_of_regard,
        zoom: config.zoom,
        name: config.sensor_name,
        type: config.type
      }]

    return {
      name,
      latitude: Number(config.latitude),
      longitude: Number(config.longitude),
      altitude: Number(config.altitude ?? 0),
      gimbalType: config.gimbalType ?? config.gimbal_type ?? 'AzElGimbal',
      gimbalSlewRates: normalizeAxisSlewRates(config.gimbalSlewRates ?? config.gimbal_slew_rates),
      sensorMaxDistance: config.sensorMaxDistance ?? config.sensor_max_distance,
      fsm: normalizeObservatoryFsmConfig(config.fsm, name),
      sensors: sensorsInput.map((sensor, index) => normalizeObservatorySensorConfig(sensor, name, index))
    }
  }

  const name = String(nameOrConfig ?? '')
  return {
    name,
    latitude: Number(latitude),
    longitude: Number(longitude),
    altitude: Number(altitude ?? 0),
    gimbalType,
    gimbalSlewRates: normalizeAxisSlewRates(gimbalSlewRates),
    sensorMaxDistance,
    fsm: undefined,
    sensors: [
      normalizeObservatorySensorConfig({
        height,
        width,
        y_fov,
        x_fov,
        field_of_regard
      }, name, 0)
    ]
  }
}

/**
 * Represents a universe containing ECI objects, ground stations, observatory
 * payloads, and gimbals.
 */
class Universe {
  constructor() {
    /**
     * The Earth object in the universe.
     * @type {Earth}
     * @private
     */
    this._earth = new Earth();
    /**
     * The Sun object in the universe.
     * @type {Sun}
     * @private
     */
    this._sun = new Sun();
    /**
     * The objects in the universe.
     * @type {Object.<string, SimObject>}
     * @private
     */
    this._objects = {}
    /**
     * The gimbals in the universe.
     * @type {Array.<AzElGimbal>}
     * @private
     */
    this._gimbals = []
    /**
     * The observatory payloads in the universe.
     * @type {Array.<ElectroOpicalSensor|Laser>}
     * @private
     */
    this._sensors = []
    /**
     * The fast steering mirrors in the universe.
     * @type {Array.<FastSteeringMirror>}
     * @private
     */
    this._fsms = []
    /**
     * The trackable objects in the universe.
     * @type {Array.<SimObject>}
     * @private
     */
    this._trackables = []
    /**
     * The non-trackable objects in the universe.
     * @type {Array.<SimObject>}
     * @private
     */
    this._nontrackables = []
    /**
     * The observatories in the universe.
     * @type {Array.<{Observatory}>}
     * @private
     */
    this._observatories = []

    /**
     * Event queue for time-based actions.
     * @type {EventQueue}
     * @private
     */
    this._events = new EventQueue()

    // Register default event handlers
    // - trackObject: { observer: siteName, target: objectName }
    // - setFsmAxes: { observer: siteName, axes: { tip, tilt } }
    // - stepFsmAxes: { observer: siteName, axes|deltas: { tip, tilt } }
    // - setSensorZoom: { observer: siteName, sensor?: sensorName, zoomLevel }
    // - stepSensorZoom: { observer: siteName, sensor?: sensorName, deltaZoomLevel }
    // - setDirectedEnergyActive: { observer: siteName, device|sensor: payloadName, active }
    this._events.registerHandler('trackObject', (universe, ev) => {
      const observerName = ev?.data?.observer ?? ev?.observer
      const dataHasTarget = ev?.data && Object.prototype.hasOwnProperty.call(ev.data, 'target')
      const eventHasTarget = Object.prototype.hasOwnProperty.call(ev ?? {}, 'target')
      const targetProvided = dataHasTarget || eventHasTarget
      const targetName = ev?.data?.target ?? ev?.target
      if (!observerName) return
      const target = (targetName !== null && targetName !== undefined) ? (universe.getObject && universe.getObject(targetName)) : undefined
      const obs = findObservatoryByName(universe, observerName)
      if (obs?.gimbal) {
        if (targetProvided && (targetName === null || targetName === undefined)) {
          obs.gimbal.trackObject = null
          obs.gimbal.trackMode = 'fixed'
          if (typeof obs.gimbal.clearAxisTargets === 'function') {
            obs.gimbal.clearAxisTargets(true)
          }
        } else if (target) {
          obs.gimbal.trackMode = 'rate'
          obs.gimbal.trackObject = target
        }
      }
    })

    this._events.registerHandler('stepGimbalAxes', (universe, ev) => {
      const data = ev?.data ?? {}
      const observerName = data.observer ?? ev?.observer
      if (!observerName) return

      const obs = findObservatoryByName(universe, observerName)
      if (!obs?.gimbal) return
      const gimbal = obs.gimbal
      const wasTracking = (gimbal.trackMode === 'rate') || defined(gimbal.trackObject)
      gimbal.trackObject = null
      gimbal.trackMode = 'fixed'
      if (wasTracking && typeof gimbal.clearAxisTargets === 'function') {
        gimbal.clearAxisTargets(true)
      }

      const deltas = collectAxisValues(data.axes ?? data.deltas, ev?.axes ?? ev?.deltas)
      applyAxisDeltas(gimbal, deltas, getGimbalAxisTargetOptions)
    })

    this._events.registerHandler('stepFsmAxes', (universe, ev) => {
      const data = ev?.data ?? {}
      const observerName = data.observer ?? ev?.observer
      if (!observerName) return

      const obs = findObservatoryByName(universe, observerName)
      const fsm = obs?.fsm
      if (!fsm) return

      const deltas = collectAxisValues(data.axes ?? data.deltas, ev?.axes ?? ev?.deltas)
      applyAxisDeltas(fsm, deltas)
    })

    this._events.registerHandler('setGimbalAxes', (universe, ev) => {
      const data = ev?.data ?? {}
      const observerName = data.observer ?? ev?.observer
      if (!observerName) return

      const obs = findObservatoryByName(universe, observerName)
      if (!obs?.gimbal) return
      const gimbal = obs.gimbal
      gimbal.trackObject = null
      gimbal.trackMode = 'fixed'

      applyAxisTargets(gimbal, collectAxisValues(data.axes, ev?.axes), getGimbalAxisTargetOptions)
    })

    this._events.registerHandler('setFsmAxes', (universe, ev) => {
      const data = ev?.data ?? {}
      const observerName = data.observer ?? ev?.observer
      if (!observerName) return

      const obs = findObservatoryByName(universe, observerName)
      const fsm = obs?.fsm
      if (!fsm) return

      applyAxisTargets(fsm, collectAxisValues(data.axes, ev?.axes))
    })

    this._events.registerHandler('setSensorZoom', (universe, ev) => {
      const data = ev?.data ?? {}
      const observerName = data.observer ?? ev?.observer
      if (!observerName) return

      const observatory = findObservatoryByName(universe, observerName)
      if (!observatory) return

      const sensorName = data.sensor ?? data.sensor_name ?? ev?.sensor ?? ev?.sensor_name
      const sensor = findObservatorySensor(observatory, sensorName)
      if (!sensor || typeof sensor.setZoomLevel !== 'function') return

      const zoomLevel = Number(data.zoomLevel ?? data.zoom_level ?? ev?.zoomLevel ?? ev?.zoom_level)
      if (!Number.isFinite(zoomLevel)) return
      sensor.setZoomLevel(zoomLevel)
    })

    this._events.registerHandler('stepSensorZoom', (universe, ev) => {
      const data = ev?.data ?? {}
      const observerName = data.observer ?? ev?.observer
      if (!observerName) return

      const observatory = findObservatoryByName(universe, observerName)
      if (!observatory) return

      const sensorName = data.sensor ?? data.sensor_name ?? ev?.sensor ?? ev?.sensor_name
      const sensor = findObservatorySensor(observatory, sensorName)
      if (!sensor || typeof sensor.stepZoomLevel !== 'function') return

      const deltaZoomLevel = Number(
        data.deltaZoomLevel ??
        data.delta_zoom_level ??
        ev?.deltaZoomLevel ??
        ev?.delta_zoom_level
      )
      if (!Number.isFinite(deltaZoomLevel) || deltaZoomLevel === 0) return
      sensor.stepZoomLevel(deltaZoomLevel)
    })

    this._events.registerHandler('setDirectedEnergyActive', (universe, ev) => {
      const data = ev?.data ?? {}
      const observerName = data.observer ?? ev?.observer
      if (!observerName) return

      const observatory = findObservatoryByName(universe, observerName)
      if (!observatory) return

      const deviceName = data.device ?? data.sensor ?? data.sensor_name ?? ev?.device ?? ev?.sensor ?? ev?.sensor_name
      const payload = findObservatorySensor(observatory, deviceName)
      if (!payload || payload.type !== 'Laser') return

      const activeValue = data.active ?? ev?.active
      if (activeValue === undefined) return
      payload.active = booleanOr(activeValue, false)
    })

    const applyAirVehicleManeuver = (universe, ev) => {
      const target = resolveAirVehicleForEvent(universe, ev)
      if (!target) return
      const data = ev?.data ?? {}

      if (typeof target.update === 'function') {
        target.update(ev.time, universe)
      }

      const velocityNed = resolveVelocityNedFromEventData(data, target.heading ?? 0)
      if (defined(velocityNed)) {
        target.velocityNed = velocityNed
      }

      const accelerationNed = resolveAccelerationNedFromEventData(data)
      if (defined(accelerationNed)) {
        target.accelerationNed = accelerationNed
      }

      if (
        Object.prototype.hasOwnProperty.call(data, 'heading') ||
        Object.prototype.hasOwnProperty.call(data, 'direction')
      ) {
        target.heading = numberOr(data.heading ?? data.direction)
      }
    }

    this._events.registerHandler('airvehiclemaneuver', applyAirVehicleManeuver)
    this._events.registerHandler('setairvehiclevelocityned', (universe, ev) => {
      const data = ev?.data ?? {}
      applyAirVehicleManeuver(universe, {
        ...ev,
        data: {
          object: resolveEventObjectName(ev),
          velocity_ned: data.velocity_ned ?? data.velocityNed ?? data.velocity,
          velocity_enu: data.velocity_enu ?? data.velocityEnu,
          speed: data.speed,
          horizontal_speed: data.horizontal_speed,
          ground_speed: data.ground_speed,
          vertical_speed: data.vertical_speed,
          climb_rate: data.climb_rate,
          heading: data.heading,
          direction: data.direction
        }
      })
    })
    this._events.registerHandler('setairvehicleaccelerationned', (universe, ev) => {
      const data = ev?.data ?? {}
      applyAirVehicleManeuver(universe, {
        ...ev,
        data: {
          object: resolveEventObjectName(ev),
          acceleration_ned: data.acceleration_ned ?? data.accelerationNed ?? data.acceleration,
          acceleration_enu: data.acceleration_enu ?? data.accelerationEnu
        }
      })
    })
    this._events.registerHandler('setairvehicleheading', (universe, ev) => {
      const data = ev?.data ?? {}
      applyAirVehicleManeuver(universe, {
        ...ev,
        data: {
          object: resolveEventObjectName(ev),
          heading: data.heading ?? data.direction
        }
      })
    })
  }

  /**
   * Checks if an object with the given name exists in the universe.
   * @param {string} name - The name of the object to check.
   * @returns {boolean} - True if an object with the given name exists in the universe, false otherwise.
   */
  hasObject(name) {
    return name in this._objects;
  }

  /**
   * Gets the object with the given name from the universe.
   * @param {string} name - The name of the object to get.
   * @returns {SimObject} - The object with the given name.
   */
  getObject(name) {
    return this._objects[name];
  }

  /**
   * Adds an object to the universe.
   * @param {SimObject} object - The object to add.
   * @param {boolean} [trackable=true] - Whether the object is trackable or not.
   * @returns {SimObject} - The added object.
   */
  addObject(object, trackable=true) {
    if (object.name in this._objects) {
      console.warn(`Object with name ${object.name} already exists in universe: {object}`);
    }
    this._objects[object.name] = object;
    if (trackable) {
      this._trackables.push(object);
    } else {
      this._nontrackables.push(object);
    }
    return object;
  }

  /**
   * Remove an object from the universe.
   * @param {SimObject} object - The object to remove.
   */
  removeObject(object) {
    if (object.name in this._objects) {
      delete this._objects[object.name];
    }
    const i = this._trackables.indexOf(object);
    if (i > -1) {
      this._trackables.splice(i, 1);
    }
    const j = this._nontrackables.indexOf(object);
    if (j > -1) {
      this._nontrackables.splice(j, 1);
    }
    if (defined(object.parent)) {
      object.parent.removeChild(object);
    }
  }

  /**
   * Adds a ground station to the universe.
   * @param {string} name - The name of the ground station.
   * @param {number} latitude - The latitude of the ground station in degrees.
   * @param {number} longitude - The longitude of the ground station in degrees.
   * @param {number} altitude - The altitude of the ground station in meters.
   * @param {boolean} [trackable=false] - Whether the ground station is trackable or not.
   * @returns {EarthGroundStation} - The added ground station.
   */
  addGroundSite(name, latitude, longitude, altitude, trackable=false) {
    const site = new EarthGroundStation(latitude, longitude, altitude, name)
    site.attach(this.earth)
    this.addObject(site, trackable)
    return site
  }

  /**
   * Adds an SGP4 satellite to the universe.
   * @param {string} name - The name of the satellite.
   * @param {string} line1 - The first line of the TLE for the satellite.
   * @param {string} line2 - The second line of the TLE for the satellite.
   * @param {string} orientation - The orientation of the satellite.
   * @param {boolean} [lagrangeInterpolated=false] - Whether the satellite is lagrange interpolated or not.
   * @param {boolean} [trackable=true] - Whether the satellite is trackable or not.
   * @returns {SGP4Satellite|LagrangeInterpolatedObject} - The added satellite.
   */
  addSGP4Satellite(name, line1, line2, orientation, lagrangeInterpolated=false, trackable=true) {
    let satellite = new SGP4Satellite(line1, line2, orientation, name);
    if (lagrangeInterpolated)
      satellite = this.addObject(new LagrangeInterpolatedObject(satellite), trackable);
    else
      satellite = this.addObject(satellite, trackable);
    return satellite;
  }

  /**
   * Adds a two-body satellite to the universe.
   * @param {string} name - The name of the satellite.
   * @param {Cartesian3} r0 - The initial position vector of the satellite in meters.
   * @param {Cartesian3} v0 - The initial velocity vector of the satellite in meters per second.
   * @param {JulianDate} t0 - The initial time of the satellite.
   * @param {string} orientation - The orientation of the satellite.
   * @param {boolean} [lagrangeInterpolated=false] - Whether the satellite is lagrange interpolated or not.
   * @param {boolean} [trackable=true] - Whether the satellite is trackable or not.
   * @returns {TwoBodySatellite|LagrangeInterpolatedObject} - The added satellite.
   */
  addTwoBodySatellite(name, r0, v0, t0, orientation, lagrangeInterpolated=false, trackable=true) {
    let satellite = new TwoBodySatellite(r0, v0, t0, orientation, name);
    if (lagrangeInterpolated)
      satellite = this.addObject(new LagrangeInterpolatedObject(satellite), trackable);
    else
      satellite = this.addObject(satellite, trackable);
    return satellite;
    }

  /**
   * Adds an air vehicle (e.g., UAV/drone) to the universe.
   * Velocity and acceleration are provided in local NED coordinates:
   * x=north, y=east, z=down.
   *
   * @param {string} name - The name of the air vehicle.
   * @param {number} latitude - Initial latitude in degrees.
   * @param {number} longitude - Initial longitude in degrees.
   * @param {number} [altitude=0] - Initial altitude in meters.
   * @param {Cartesian3} [velocityNed] - Initial velocity in local NED (m/s).
   * @param {Cartesian3} [accelerationNed] - Constant acceleration in local NED (m/s^2).
   * @param {number} [heading] - Heading in degrees clockwise from north.
   * @param {JulianDate} [t0=JulianDate.now()] - Initial epoch.
   * @param {boolean} [trackable=true] - Whether the vehicle is trackable.
   * @returns {AirVehicle} The added air vehicle.
   */
  addAirVehicle(name, latitude, longitude, altitude = 0, velocityNed = new Cartesian3(), accelerationNed = new Cartesian3(), heading = undefined, t0 = JulianDate.now(), trackable = true) {
    const vehicle = new AirVehicle(latitude, longitude, altitude, velocityNed, accelerationNed, heading, t0, name)
    vehicle.attach(this.earth)
    return this.addObject(vehicle, trackable)
  }

  /**
   * Adds a ground electro-optical observatory to the universe.
   *
   * Supported forms:
   * - Legacy positional arguments for a single EO sensor.
   * - Object config with `sensors[]` for a shared-gimbal multi-payload observatory.
   * - Optional `fsm` config using canonical `tip`, `tilt`, and `slewRates`.
   *
   * @param {string|Object} name - Observatory name, or an object config containing
   *   `name`, `latitude`, `longitude`, `altitude`, `gimbalSlewRates`,
   *   `sensorMaxDistance`, and either legacy single-sensor fields or `sensors[]`.
   * @param {number} [latitude] - The latitude of the observatory in degrees.
   * @param {number} [longitude] - The longitude of the observatory in degrees.
   * @param {number} [altitude] - The altitude of the observatory in meters.
   * @param {string} [gimbalType] - The type of gimbal used by the observatory.
   * @param {number} [height] - The height of the legacy single sensor in pixels.
   * @param {number} [width] - The width of the legacy single sensor in pixels.
   * @param {number} [y_fov] - The vertical field of view of the legacy single sensor in degrees.
   * @param {number} [x_fov] - The horizontal field of view of the legacy single sensor in degrees.
   * @param {Array<number>} [field_of_regard] - The field of regard of the legacy single sensor.
   * @param {Object<string, number|Object>} [gimbalSlewRates] - Optional per-axis slew settings.
   * @param {number} [sensorMaxDistance] - Optional fallback max sensor/gimbal range in meters when idle.
   * @returns {{site: EarthGroundStation, gimbal: AzElGimbal, sensor: ElectroOpicalSensor|Laser|undefined, sensors: Array<ElectroOpicalSensor|Laser>}} - The added observatory.
   */
  addGroundElectroOpticalObservatory(name, latitude, longitude, altitude, gimbalType, height, width, y_fov, x_fov, field_of_regard, gimbalSlewRates = undefined, sensorMaxDistance = undefined) {
    const config = normalizeGroundObservatoryConfig(
      name,
      latitude,
      longitude,
      altitude,
      gimbalType,
      height,
      width,
      y_fov,
      x_fov,
      field_of_regard,
      gimbalSlewRates,
      sensorMaxDistance
    )

    const site = new EarthGroundStation(config.latitude, config.longitude, config.altitude, config.name)
    site.attach(this.earth)

    const gimbal = new AzElGimbal(config.name + ' Gimbal')
    const maxRangeMeters = Number(config.sensorMaxDistance)
    if (Number.isFinite(maxRangeMeters) && maxRangeMeters > 0) {
      gimbal.maxRange = maxRangeMeters
    }
    if (defined(config.gimbalSlewRates) && typeof gimbal.setAxisSlewRates === 'function') {
      gimbal.setAxisSlewRates(config.gimbalSlewRates)
    }
    gimbal.attach(site)
    this.addObject(gimbal, false)

    let fsm
    if (defined(config.fsm)) {
      fsm = new FastSteeringMirror(config.fsm.name)
      if (Number.isFinite(config.fsm.tip)) {
        fsm.tip = config.fsm.tip
      }
      if (Number.isFinite(config.fsm.tilt)) {
        fsm.tilt = config.fsm.tilt
      }
      if (defined(config.fsm.slewRates) && typeof fsm.setAxisSlewRates === 'function') {
        fsm.setAxisSlewRates(config.fsm.slewRates)
      }
      fsm.attach(gimbal)
      this.addObject(fsm, false)
      this._fsms.push(fsm)
    }

    const payloadParent = fsm ?? gimbal

    const sensors = config.sensors.map((sensorConfig) => {
      if (sensorConfig.type === 'Laser') {
        const laser = new Laser({
          name: sensorConfig.name,
          beamDivergence: sensorConfig.beamDivergence,
          power: sensorConfig.power,
          active: sensorConfig.active,
          maxRange: sensorConfig.maxRange,
          y_fov: sensorConfig.y_fov,
          x_fov: sensorConfig.x_fov,
          field_of_regard: sensorConfig.field_of_regard,
          color: sensorConfig.color
        })
        const laserMaxRange = Number(sensorConfig.maxRange ?? config.sensorMaxDistance ?? gimbal.maxRange)
        if (Number.isFinite(laserMaxRange) && laserMaxRange > 0) {
          laser.maxRange = laserMaxRange
        }
        if (defined(sensorConfig.color)) {
          laser.color = sensorConfig.color
        }
        laser.attach(payloadParent)
        this.addObject(laser, false)
        this._sensors.push(laser)
        return laser
      }

      const sensorArgs = [
        sensorConfig.height,
        sensorConfig.width,
        sensorConfig.y_fov,
        sensorConfig.x_fov,
        sensorConfig.field_of_regard,
        sensorConfig.name
      ]
      const sensor = defined(sensorConfig.zoom)
        ? new ElectroOpicalSensor(...sensorArgs, { zoom: sensorConfig.zoom })
        : new ElectroOpicalSensor(...sensorArgs)
      sensor.maxRange = gimbal.maxRange
      if (defined(sensorConfig.color)) {
        sensor.color = sensorConfig.color
      }
      sensor.attach(payloadParent)
      this.addObject(sensor, false)
      this._sensors.push(sensor)
      return sensor
    })

    this._objects[config.name] = site
    this._gimbals.push(gimbal)

    const observatory = new Observatory(site, gimbal, sensors, fsm)
    observatory.name = config.name
    this._observatories.push(observatory)


    return observatory
  }

  /**
   * Gets the Earth object in the universe.
   * @type {Earth}
   */
  get earth() {
    return this._earth;
  }

  /**
   * Gets the Sun object in the universe.
   */
  get sun() {
    return this._sun;
  }

  /**
   * Gets the gimbals in the universe.
   * @type {Array.<Gimbal>}
   */
  get gimbals() {
    return this._gimbals;
  }

  /**
   * Gets the sensors in the universe.
   * @type {Array.<ElectroOpicalSensor>}
   */
  get sensors() {
    return this._sensors;
  }

  /**
   * Gets the fast steering mirrors in the universe.
   * @type {Array.<FastSteeringMirror>}
   */
  get fsms() {
    return this._fsms;
  }

  /**
   * Gets the objects in the universe.
   * @type {Object.<string, SimObject>}
   */
  get objects() {
    return this._objects
  }

  /**
   * Gets the trackable objects in the universe.
   * @type {Array.<SimObject>}
   */
  get trackables() {
    return this._trackables
  }

  /**
   * Access the universe event queue.
   * @type {EventQueue}
   */
  get events() {
    return this._events
  }

  /**
   * Convenience method to schedule an event.
   * @param {{ time: JulianDate|string|Date, type?: string, data?: any, handler?: Function }} evt
   * @returns {string} Event id
   */
  scheduleEvent(evt) {
    return this._events.add(evt)
  }

  /**
   * Updates the universe to the given time.
   * @param {JulianDate} time - The time to update the universe to.
   */
  update(time, forceUpdate = false) {
    // Process due events before state updates
    this._events.process(time, this)
    // TODO replace this with graph traversal
    this._earth.update(time, this, forceUpdate)
    this._sun.update(time, this, forceUpdate)
    this._trackables.forEach((o) => {
      o.update(time, this, forceUpdate)
    })
    this._nontrackables.forEach((o) => {
      o.update(time, this, forceUpdate)
    })
    this._observatories.forEach((o) => {
      o.site.update(time, this, forceUpdate)
      o.gimbal.update(time, this, forceUpdate)
      o.fsm?.update?.(time, this, forceUpdate)
      getObservatorySensors(o).forEach((sensor) => {
        sensor?.update?.(time, this, forceUpdate)
      })
    })
  }
}

export default Universe;
