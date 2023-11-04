import { JulianDate } from 'cesium'
import SimObject from './SimObject.js'

/**
 * A class representing an electro-optical sensor.
 * @extends SimObject
 */
class ElectroOpicalSensor extends SimObject {
  /**
   * Create an electro-optical sensor.
   * @param {number} height - The height of the sensor in pixels.
   * @param {number} width - The width of the sensor in pixels.
   * @param {number} y_fov - The vertical field of view of the sensor in degrees.
   * @param {number} x_fov - The horizontal field of view of the sensor in degrees.
   * @param {Array} field_of_regard - An array of objects representing the field of regard of the sensor.
   * @param {string} name - The name of the sensor.
   */
  constructor(height, width, y_fov, x_fov, field_of_regard=[], name='ElectroOpticalSensor') {
    super(name)
    this.height = height
    this.width = width
    this.y_fov = y_fov
    this.x_fov = x_fov
    this.y_ifov = this.y_fov / this.height
    this.x_ifov = this.x_fov / this.width
    this.field_of_regard = field_of_regard
  }

  /**
   * Update the state of the sensor.
   * @param {JulianDate} time - The current simulation time.
   * @param {Universe} universe - The universe in which the sensor exists.
   * @override
   */
  _update(time, universe) {
    // TODO do nothing for now
  }

}

export default ElectroOpicalSensor
