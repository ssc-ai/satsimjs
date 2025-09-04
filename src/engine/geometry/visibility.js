import { defined, Cartesian3 } from 'cesium';
import { southEastZenithToAzEl } from '../dynamics/gimbal.js'
import { calculateTargetBrightness } from './photometry.js';

/**
 * Calculates the visibility of a satellite from multiple observatories.
 * 
 * This function determines whether a satellite is visible from each of the provided
 * observatories based on their field-of-regard constraints. For each observatory,
 * it computes the satellite's position in local coordinates (azimuth, elevation, range),
 * checks visibility against field-of-regard boundaries, and calculates brightness
 * characteristics including phase angle and apparent magnitude.
 * 
 * The visibility determination process:
 * 1. Updates the satellite position to the current time
 * 2. Transforms satellite world position to observatory local coordinates
 * 3. Converts local position to azimuth/elevation/range
 * 4. Checks if position falls within any field-of-regard region
 * 5. Calculates brightness properties using photometry analysis
 * 
 * @param {Universe} universe - Universe object containing simulation state and celestial bodies
 * @param {Viewer} viewer - Viewer object containing simulation time information
 * @param {Array<Observatory>} observatories - Array of observatory objects to check visibility from
 * @param {SimObject} sat - Satellite object to check visibility for
 * @returns {Array<Object>} Array of visibility results, one per observatory
 * @returns {string} returns[].sensor - Name of the sensor/observatory
 * @returns {number} returns[].az - Azimuth angle in degrees (0-360)
 * @returns {number} returns[].el - Elevation angle in degrees (-90 to +90)
 * @returns {number} returns[].r - Range/distance from observatory to satellite
 * @returns {boolean} returns[].visible - Whether satellite is within field-of-regard
 * @returns {number} returns[].phaseAngle - Phase angle in degrees (from photometry calculation)
 * @returns {number} returns[].range - Range from observer (from photometry calculation)
 * @returns {number|undefined} returns[].mv - Apparent visual magnitude (if calculable) 
 * 
 * @example
 * // Check satellite visibility from multiple ground stations
 * const visibility = getVisibility(universe, viewer, groundStations, satellite);
 * 
 * visibility.forEach(result => {
 *   console.log(`${result.sensor}: Az=${result.az.toFixed(1)}° El=${result.el.toFixed(1)}°`);
 *   console.log(`  Visible: ${result.visible}, Magnitude: ${result.mv?.toFixed(1) || 'N/A'}`);
 * });
 * 
 * @example
 * // Single observatory with field-of-regard constraints
 * const observatory = new Observatory(groundStation, gimbal, sensor);
 * // where sensor has field_of_regard: [{ clock: [0, 360], elevation: [10, 90] }]
 * const result = getVisibility(universe, viewer, [observatory], satellite);
 * 
 * @see {@link calculateTargetBrightness} For brightness calculation details
 * @see {@link southEastZenithToAzEl} For coordinate transformation details
 */
function getVisibility(universe, viewer, observatories, sat) {
  let visibility = []
  for (let observatory of observatories) {
    const localPos = new Cartesian3();
    const field_of_regard = observatory.sensor.field_of_regard;
    // Base time (current)
    const t0 = viewer.clock.currentTime;
    sat.update(t0, universe)
    observatory.site.transformPointFromWorld(sat.worldPosition, localPos);
    let [az, el, r] = southEastZenithToAzEl(localPos)
    let visible = false
    if(defined(field_of_regard)) {
      for(let i = 0; i < field_of_regard.length; i ++) {
        const f = field_of_regard[i];
        if(az > f.clock[0] && az < f.clock[1] && el > f.elevation[0] && el < f.elevation[1]) {
          visible = true
        }
      }
    }
    // Compute instantaneous angular rate on the sky (arcsec/s) relative to observer
    // Using omega = |r x v| / |r|^2 where r and v are relative position and velocity in world frame
    let angRateArcsecPerSec = undefined;
    try {
      const rWorld = Cartesian3.subtract(
        sat.worldPosition,
        observatory.site.worldPosition,
        new Cartesian3()
      );
      const vRel = Cartesian3.subtract(
        sat.worldVelocity,
        observatory.site.worldVelocity,
        new Cartesian3()
      );
      const rMag = Cartesian3.magnitude(rWorld);
      if (rMag > 0 && defined(vRel)) {
        const cx = Cartesian3.cross(rWorld, vRel, new Cartesian3());
        const omega = Cartesian3.magnitude(cx) / (rMag * rMag); // rad/s
        const RAD2ARCSEC = 206264.80624709636; // arcsec per radian
        angRateArcsecPerSec = omega * RAD2ARCSEC;
      }
    } catch (e) {
      // leave undefined on error
    }

    visibility.push({...{
      sensor: observatory.sensor.name,
      az,
      el,
      r,
      visible,
      angRateArcsecPerSec
    }, ...calculateTargetBrightness(observatory.site, sat, universe.sun) } )
  }
  return visibility
}

export { getVisibility }