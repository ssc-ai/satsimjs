import { Cartesian3, Math as CMath } from 'cesium';

/**
 * Converts a Cartesian3 vector in South-East-Zenith coordinates to azimuth and elevation angles.
 * 
 * This function transforms a position vector in the South-East-Zenith (SEZ) coordinate system
 * to azimuth and elevation angles suitable for ground-based tracking systems. The SEZ system
 * is commonly used for ground-based observations where:
 * - X-axis points South
 * - Y-axis points East  
 * - Z-axis points toward Zenith (up)
 * 
 * The azimuth is measured clockwise from North (0°) through East (90°), South (180°),
 * and West (270°). Elevation is measured from the horizontal plane, with positive
 * values above the horizon.
 * 
 * @param {Cartesian3} cartesian3 - Position vector in South-East-Zenith coordinates
 * @returns {Array<number>} Array containing [azimuth, elevation, range]
 * @returns {number} returns[0] - Azimuth angle in degrees (0-360)
 * @returns {number} returns[1] - Elevation angle in degrees (-90 to +90)
 * @returns {number} returns[2] - Range/magnitude of the input vector
 * 
 * @example
 * // Convert a position vector to azimuth and elevation
 * const position = new Cartesian3(1000, 500, 866); // SEZ coordinates
 * const [az, el, range] = southEastZenithToAzEl(position);
 * console.log(`Az: ${az.toFixed(1)}°, El: ${el.toFixed(1)}°, Range: ${range.toFixed(0)}m`);
 * 
 * @example
 * // Handle edge cases
 * const zenithPoint = new Cartesian3(0, 0, 1000);
 * const [azZenith, elZenith] = southEastZenithToAzEl(zenithPoint);
 * // Returns: az=0°, el=90° for point directly overhead
 */
function southEastZenithToAzEl(cartesian3) {
  let az, el;
  if (cartesian3.x === 0.0 && cartesian3.y === 0.0) {
    az = 0.0;
  } else {
    az = Math.atan2(cartesian3.y, -cartesian3.x);
    if (az < 0.0) {
      az += CMath.TWO_PI;
    }
  }

  const mag = Cartesian3.magnitude(cartesian3);
  if (mag < 1e-9) {
    el = 0.0;
  } else {
    el = Math.asin(cartesian3.z / mag);
  }

  return [az * CMath.DEGREES_PER_RADIAN, el * CMath.DEGREES_PER_RADIAN, mag];
}

/**
 * Converts a Cartesian3 vector in space-based coordinates to azimuth and elevation angles.
 * 
 * This function transforms a position vector in a space-based coordinate system to
 * azimuth and elevation angles. Unlike the ground-based SEZ system, this space-based
 * system uses a different elevation calculation that measures the angle from the
 * negative Z-axis, making it suitable for space-based tracking systems and satellites.
 * 
 * The coordinate system convention:
 * - X-axis and Y-axis form the reference plane
 * - Z-axis points in the reference direction
 * - Azimuth is measured from the negative X-axis toward the Y-axis
 * - Elevation is measured from the XY-plane toward the negative Z-axis
 * 
 * @param {Cartesian3} cartesian3 - Position vector in space-based coordinates
 * @returns {Array<number>} Array containing [azimuth, elevation, range]
 * @returns {number} returns[0] - Azimuth angle in degrees (0-360)
 * @returns {number} returns[1] - Elevation angle in degrees (0-180)
 * @returns {number} returns[2] - Range/magnitude of the input vector
 * 
 * @example
 * // Convert a space-based position vector
 * const spacePosition = new Cartesian3(1000, 500, -866); // Space-based coordinates
 * const [az, el, range] = spaceBasedToAzEl(spacePosition);
 * console.log(`Space Az: ${az.toFixed(1)}°, El: ${el.toFixed(1)}°, Range: ${range.toFixed(0)}m`);
 * 
 * @example
 * // Handle vectors in the XY-plane
 * const xyPlaneVector = new Cartesian3(1000, 1000, 0);
 * const [azXY, elXY] = spaceBasedToAzEl(xyPlaneVector);
 * // Returns: el=90° for vectors in the XY-plane
 */
function spaceBasedToAzEl(cartesian3) {
  let az, el;
  if (cartesian3.x === 0 && cartesian3.y === 0) {
    az = 0.0;
  } else {
    az = Math.atan2(cartesian3.y, -cartesian3.x);
    if (az < 0.0) {
      az += CMath.TWO_PI;
    }
  }

  const mag = Cartesian3.magnitude(cartesian3);
  const r = Math.sqrt(cartesian3.x * cartesian3.x + cartesian3.y * cartesian3.y);
  if (Math.abs(r) < 1e-9 && Math.abs(cartesian3.z) < 1e-9) {
    el = 0.0;
  } else {
    el = Math.atan2(r, -cartesian3.z);
  }

  return [az * CMath.DEGREES_PER_RADIAN, el * CMath.DEGREES_PER_RADIAN, mag];
}

export {
  southEastZenithToAzEl,
  spaceBasedToAzEl
}