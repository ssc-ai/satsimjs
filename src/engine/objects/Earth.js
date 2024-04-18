import { Transforms, Matrix3, defined, Matrix4, ReferenceFrame, Cartesian3 } from 'cesium';
import SimObject from './SimObject.js';

/**
 * Represents the Earth object in the simulation.
 * @extends SimObject
 */
class Earth extends SimObject {
  constructor() {
    super('Earth', ReferenceFrame.FIXED);
    this._teme2ecef = new Matrix3();
    this._ecef2teme = new Matrix3();
  }

  /**
   * Gets the world position (ECI) of the object.
   * @type {Cartesian3}
   * @readonly
   */
  get worldPosition() {
    return Cartesian3.ZERO;
  }

  /**
   * Gets the world velocity (ECI) of the object.
   * @type {Cartesian3}
   * @readonly
   */
  get worldVelocity() {
    return Cartesian3.ZERO;
  }  

  /**
   * Updates the Earth object's position and orientation based on the current time and universe.
   * @param {JulianDate} time - The current time in Julian Date format.
   * @param {Universe} universe - The universe object containing information about the simulation.
   * @override
   */
  _update(time, universe) {
    const transform = Transforms.computeIcrfToFixedMatrix(time, this._teme2ecef);
    if (!defined(transform)) {
      Transforms.computeTemeToPseudoFixedMatrix(time, this._teme2ecef);
    }
    Matrix3.transpose(this._teme2ecef, this._ecef2teme);
    Matrix4.fromRotation(this._ecef2teme, this._transform);
  }
}

export default Earth;
