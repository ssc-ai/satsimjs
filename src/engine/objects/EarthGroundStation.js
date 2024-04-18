import { Math as CMath, Cartesian3, ReferenceFrame, defaultValue } from 'cesium'
import SimObject from './SimObject.js'

/**
 * Represents a ground station on Earth.
 * @extends SimObject
 */
class EarthGroundStation extends SimObject {
  /**
   * Creates a new EarthGroundStation object.
   * @param {Number} latitude - The latitude of the ground station in degrees.
   * @param {Number} longitude - The longitude of the ground station in degrees.
   * @param {Number} [altitude=0.0] - The altitude of the ground station in meters.
   * @param {String} [name='EarthGroundStation'] - The name of the ground station.
   */
  constructor(latitude, longitude, altitude, name='EarthGroundStation') {
    super(name, ReferenceFrame.FIXED)
    this._latitude = latitude
    this._longitude = longitude
    this._altitude = defaultValue(altitude, 0.0) // meters
    this._period = 86400

    this._initialize()
  }

  /**
   * Initializes the ground station's position and orientation.
   * @private
   */
  _initialize() {
    this._position = Cartesian3.fromDegrees(this._longitude, this._latitude, this._altitude)
    this._velocity = new Cartesian3()
 
    this.reset()
    this.rotateZ(this._longitude * CMath.RADIANS_PER_DEGREE)
    this.rotateY(CMath.PI_OVER_TWO - this._latitude * CMath.RADIANS_PER_DEGREE)
    this.setTranslation(this._position)
  }

  /**
   * Gets the latitude of the ground station.
   * @returns {Number} The latitude of the ground station in degrees.
   */
  get latitude() {
    return this._latitude
  }

  /**
   * Sets the latitude of the ground station.
   * @param {Number} latitude - The latitude of the ground station in degrees.
   */
  set latitude(latitude) {
    this._latitude = latitude
    this._initialize()
  }

  /**
   * Gets the longitude of the ground station.
   * @returns {Number} The longitude of the ground station in degrees.
   */
  get longitude() {
    return this._longitude
  }

  /**
   * Sets the longitude of the ground station.
   * @param {Number} longitude - The longitude of the ground station in degrees.
   */
  set longitude(longitude) {
    this._longitude = longitude
    this._initialize()
  }

  /**
   * Gets the altitude of the ground station.
   * @returns {Number} The altitude of the ground station in meters.
   */
  get altitude() {
    return this._altitude
  }

  /**
   * Sets the altitude of the ground station.
   * @param {Number} altitude - The altitude of the ground station in meters.
   */
  set altitude(altitude) {
    this._altitude = altitude
    this._initialize()
  }

  /**
   * Gets the ECI velocity of the ground station.
   */
  get worldVelocity() {
    const EARTH_ANGULAR_SPEED = 7.292115146706979e-5;
    const vw = new Cartesian3(0, 0, EARTH_ANGULAR_SPEED);
    const vw_x_r = Cartesian3.cross(vw, this._position, new Cartesian3());
    return this.parent.transformVectorToWorld(Cartesian3.add(this._velocity, vw_x_r, new Cartesian3()))
  }


  /**
   * Updates the ground station's state.
   * @param {Number} time - The current simulation time in seconds.
   * @param {Universe} universe - The universe in which the ground station exists.
   * @override
   */
  _update(time, universe) {
    // do nothing since this is a fixed object and _initialize() sets the position and orientation
  }
}

export default EarthGroundStation