import { JulianDate, LagrangePolynomialApproximation, Cartesian3 } from 'cesium'

const _r = []

/**
 * Performs fast Lagrange polynomial interpolation for position data.
 * 
 * This function uses Cesium's LagrangePolynomialApproximation to interpolate
 * a position at a given time from pre-computed time and position arrays.
 * It assumes the data is already available and performs zero-order interpolation
 * for 3D position vectors.
 * 
 * @param {Array<number>} times - Array of time values (typically in seconds from epoch)
 * @param {Array<number>} positions - Flattened array of position coordinates [x1,y1,z1,x2,y2,z2,...]
 * @param {number} t - Time at which to interpolate (same units as times array)
 * @param {Cartesian3} [result] - Optional result object to store the interpolated position
 * @returns {Cartesian3} Interpolated position vector at time t
 * 
 * @example
 * // Interpolate position at t=100 seconds
 * const times = [0, 60, 120, 180, 240, 300, 360];
 * const positions = [x0,y0,z0, x1,y1,z1, x2,y2,z2, x3,y3,z3, x4,y4,z4, x5,y5,z5, x6,y6,z6];
 * const interpolatedPos = lagrange_fast(times, positions, 100);
 * 
 * @example
 * // Reuse result object for performance
 * const result = new Cartesian3();
 * lagrange_fast(times, positions, 150, result);
 * console.log(`Position: ${result.x}, ${result.y}, ${result.z}`);
 */
function lagrange_fast(times, positions, t, result) {

  _r.length = 0
  LagrangePolynomialApproximation.interpolateOrderZero(t, times, positions, 3, _r)
  return Cartesian3.fromArray(_r, 0, result)
}

/**
 * Adaptive Lagrange interpolation with automatic data point generation.
 * 
 * This function provides intelligent interpolation that automatically generates
 * interpolation points when the requested time falls outside the available data
 * range or when insufficient data points exist. It maintains a sliding window
 * of interpolation points around the requested time for optimal accuracy.
 * 
 * The function automatically reinitializes the interpolation data set when:
 * - Fewer than required points are available
 * - Requested time is before the first available time
 * - Requested time is after the last available time
 * 
 * @param {Array<number>} times - Array of time values (modified in-place)
 * @param {Array<number>} positions - Array of position coordinates (modified in-place)
 * @param {JulianDate} epoch - Reference epoch for time calculations
 * @param {JulianDate} time - Target time for interpolation
 * @param {Function} update - Function that returns position for a given time: update(julianDate) -> Cartesian3
 * @param {Cartesian3} [result] - Optional result object to store the interpolated position
 * @param {number} [interval=180] - Time interval between interpolation points in seconds
 * @returns {Cartesian3} Interpolated position vector at the target time
 * 
 * @example
 * // Adaptive interpolation with satellite propagation
 * const satellite = new SGP4Satellite(line1, line2);
 * const updateFunc = (time) => {
 *   satellite.update(time, universe);
 *   return satellite.position;
 * };
 * 
 * const times = [], positions = [];
 * const epoch = new JulianDate();
 * const targetTime = JulianDate.addMinutes(epoch, 30, new JulianDate());
 * 
 * const interpolatedPos = lagrange(times, positions, epoch, targetTime, updateFunc);
 * 
 * @example
 * // Custom interval for high-precision interpolation
 * const result = lagrange(times, positions, epoch, time, updateFunc, undefined, 60);
 */
function lagrange(times, positions, epoch, time, update, result, interval = 180) {

  let delta = JulianDate.secondsDifference(time, epoch)
  let numPoints = 7
  if (times.length < numPoints || delta < times[0] || delta > times[times.length - 1]) {
    initialize(times, positions, epoch, time, update, interval, numPoints)
    delta = JulianDate.secondsDifference(time, epoch)
  }

  return lagrange_fast(times, positions, delta, result)
}

/**
 * Initializes interpolation data arrays with computed position points.
 * 
 * This function generates a symmetric set of interpolation points around a target
 * time by calling the provided update function at regular intervals. It creates
 * a time-centered window of points to ensure optimal interpolation accuracy for
 * the target time.
 * 
 * The initialization process:
 * 1. Clears existing times and positions arrays
 * 2. Calculates start time as target time minus half the total span
 * 3. Generates numPoints at regular intervals
 * 4. Sets epoch to the first computed time
 * 5. Populates arrays with computed positions
 * 
 * @param {Array<number>} times - Time array to populate (cleared and filled)
 * @param {Array<number>} positions - Position array to populate (cleared and filled)
 * @param {JulianDate} epoch - Epoch reference (modified to first computed time)
 * @param {JulianDate} time - Target time around which to center the interpolation points
 * @param {Function} update - Function that computes position for given time: update(julianDate) -> Cartesian3
 * @param {number} interval - Time interval between points in seconds
 * @param {number} numPoints - Total number of interpolation points to generate
 * 
 * @example
 * // Initialize 7 points with 3-minute intervals around current time
 * const times = [], positions = [];
 * const epoch = new JulianDate();
 * const currentTime = JulianDate.now();
 * 
 * initialize(times, positions, epoch, currentTime, updateFunction, 180, 7);
 * // Creates points at: t-540s, t-360s, t-180s, t, t+180s, t+360s, t+540s
 * 
 * @example
 * // High-resolution initialization for precise interpolation
 * initialize(times, positions, epoch, targetTime, updateFunc, 60, 9);
 * // Creates 9 points with 1-minute spacing
 */
function initialize(times, positions, epoch, time, update, interval, numPoints) {

  times.length = 0
  positions.length = 0

  let t1 = JulianDate.clone(time)
  JulianDate.addSeconds(t1, -(numPoints - 1) / 2 * interval, t1)
  for (let i = 0; i < numPoints; i++) {
    JulianDate.addSeconds(t1, interval, t1)

    if (i === 0)
      JulianDate.clone(t1, epoch)

    const p = update(t1)
    positions.push(p.x)
    positions.push(p.y)
    positions.push(p.z)
    times.push(interval * i)
  }
}

export {
  lagrange_fast,
  lagrange,
  initialize
}