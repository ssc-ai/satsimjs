import Earth from "./objects/Earth.js";
import Sun from "./objects/Sun.js";
import SGP4Satellite from "./objects/SGP4Satellite.js";
import EarthGroundStation from "./objects/EarthGroundStation.js";
import AzElGimbal from "./objects/AzElGimbal.js";
import ElectroOpicalSensor from "./objects/ElectroOpticalSensor.js";
import LagrangeInterpolatedObject from "./objects/LagrangeInterpolatedObject.js";
import TwoBodySatellite from "./objects/TwoBodySatellite.js";
import AirVehicle from "./objects/AirVehicle.js";
import SimObject from "./objects/SimObject.js";
import Observatory from "./objects/Observatory.js";
import { Cartesian3, JulianDate, defined } from "cesium";
import Gimbal from "./objects/Gimbal.js";
import EventQueue from "./event/EventQueue.js";

function numberOr(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function resolveEventVector3(value) {
  if (value instanceof Cartesian3) {
    return Cartesian3.clone(value)
  }
  if (Array.isArray(value) && value.length >= 3) {
    return new Cartesian3(numberOr(value[0]), numberOr(value[1]), numberOr(value[2]))
  }
  if (defined(value) && typeof value === 'object') {
    return new Cartesian3(numberOr(value.x), numberOr(value.y), numberOr(value.z))
  }
  return undefined
}

function resolveVelocityNedFromEventData(data, fallbackHeadingDeg = 0) {
  const vNedInput = data.velocity_ned ?? data.velocityNed ?? data.velocity
  if (defined(vNedInput)) {
    return resolveEventVector3(vNedInput)
  }

  const vEnuInput = data.velocity_enu ?? data.velocityEnu
  if (defined(vEnuInput)) {
    const vEnu = resolveEventVector3(vEnuInput)
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
    return resolveEventVector3(aNedInput)
  }

  const aEnuInput = data.acceleration_enu ?? data.accelerationEnu
  if (defined(aEnuInput)) {
    const aEnu = resolveEventVector3(aEnuInput)
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
 * Represents a universe containing ECI objects, ground stations, sensors, and gimbals.
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
     * The sensors in the universe.
     * @type {Array.<ElectroOpicalSensor>}
     * @private
     */
    this._sensors = []
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
    this._events.registerHandler('trackObject', (universe, ev) => {
      const observerName = ev?.data?.observer ?? ev?.observer
      const dataHasTarget = ev?.data && Object.prototype.hasOwnProperty.call(ev.data, 'target')
      const eventHasTarget = Object.prototype.hasOwnProperty.call(ev ?? {}, 'target')
      const targetProvided = dataHasTarget || eventHasTarget
      const targetName = ev?.data?.target ?? ev?.target
      if (!observerName) return
      const target = (targetName !== null && targetName !== undefined) ? (universe.getObject && universe.getObject(targetName)) : undefined
      const arr = universe._observatories || []
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i]
        if (o?.site?.name === observerName && o?.gimbal) {
          if (targetProvided && (targetName === null || targetName === undefined)) {
            o.gimbal.trackObject = null
          } else if (target) {
            o.gimbal.trackMode = 'rate'
            o.gimbal.trackObject = target
          }
          break
        }
      }
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
   * @param {string} name - The name of the observatory.
   * @param {number} latitude - The latitude of the observatory in degrees.
   * @param {number} longitude - The longitude of the observatory in degrees.
   * @param {number} altitude - The altitude of the observatory in meters.
   * @param {string} gimbalType - The type of gimbal used by the observatory.
   * @param {number} height - The height of the sensor in pixels.
   * @param {number} width - The width of the sensor in pixels.
   * @param {number} y_fov - The vertical field of view of the sensor in degrees.
   * @param {number} x_fov - The horizontal field of view of the sensor in degrees.
   * @param {Array<number>} field_of_regard - The field of regard of the sensor.
   * @returns {{site: EarthGroundStation, gimbal: AzElGimbal, sensor: ElectroOpicalSensor}} - The added observatory.
   */
  addGroundElectroOpticalObservatory(name, latitude, longitude, altitude, gimbalType, height, width, y_fov, x_fov, field_of_regard) {
    const site = new EarthGroundStation(latitude, longitude, altitude, name)
    site.attach(this.earth)

    const gimbal = new AzElGimbal(name + ' Gimbal')
    gimbal.attach(site)
    this.addObject(gimbal, false)

    const sensor = new ElectroOpicalSensor(height, width, y_fov, x_fov, field_of_regard, name + ' Sensor')
    sensor.attach(gimbal)
    this.addObject(sensor, false)

    this._objects[name] = site
    this._gimbals.push(gimbal)

    this._sensors.push(sensor)

    const observatory = new Observatory(site, gimbal, sensor)
    observatory.name = name
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
      o.sensor.update(time, this, forceUpdate)
    })
  }
}

export default Universe;
