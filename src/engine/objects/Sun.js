import { Transforms, Matrix3, defined, Matrix4, ReferenceFrame, Simon1994PlanetaryPositions } from 'cesium';
import SimObject from './SimObject.js';

/**
 * Represents the Earth object in the simulation.
 * @extends SimObject
 */
class Sun extends SimObject {
  constructor() {
    super('Sun', ReferenceFrame.INERTIAL);
  }

  /**
   * Updates the Earth object's position and orientation based on the current time and universe.
   * @param {JulianDate} time - The current time in Julian Date format.
   * @param {Universe} universe - The universe object containing information about the simulation.
   * @override
   */
  _update(time, universe) {
    Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time, this._position);
  }
}

export default Sun;
