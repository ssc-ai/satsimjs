import { Cartesian3, Ellipsoid, defined } from 'cesium';

const EARTH_RADIUS = Ellipsoid.WGS84.maximumRadius; // meters
const SUN_RADIUS = 695700000; // meters, mean solar radius

const ShadowState = Object.freeze({
  SUNLIT: 'sunlit',
  PENUMBRA: 'penumbra',
  UMBRA: 'umbra',
});

/**
 * Classifies the illumination state of a position relative to the Sun/Earth system.
 *
 * Implements the conic shadow construction from Vallado (2007), modeling the
 * Earth's umbra and penumbra as coaxial cones that originate from tangent rays
 * intersecting the solar and terrestrial discs.
 *
 * @param {Cartesian3} position - Position vector of the object in the Earth-centered inertial frame.
 * @param {Cartesian3} sunDirection - Unit vector from Earth toward the Sun.
 * @param {number} umbraLength - Length of the Earth's umbra cone (meters).
 * @param {number} penumbraLength - Length to the penumbra apex on the solar side (meters).
 * @returns {ShadowState} The illumination classification for the position.
 */
function classifyShadowState(position, sunDirection, umbraLength, penumbraLength) {
  const projection = Cartesian3.dot(position, sunDirection);

  if (projection >= 0) {
    return ShadowState.SUNLIT;
  }

  const axialDistance = -projection;
  const axialComponent = Cartesian3.multiplyByScalar(sunDirection, projection, new Cartesian3());
  const radialVector = Cartesian3.subtract(position, axialComponent, new Cartesian3());
  const radialDistance = Cartesian3.magnitude(radialVector);

  const umbraRadius = Math.max(0, EARTH_RADIUS * (umbraLength - axialDistance) / umbraLength);
  if (axialDistance <= umbraLength && radialDistance <= umbraRadius) {
    return ShadowState.UMBRA;
  }

  const penumbraRadius = EARTH_RADIUS * (penumbraLength + axialDistance) / penumbraLength;
  if (radialDistance <= penumbraRadius) {
    return ShadowState.PENUMBRA;
  }

  return ShadowState.SUNLIT;
}

/**
 * Determine the illumination state for a set of simulation objects.
 *
 * @param {Object} sun - Sun object that exposes `update(time, universe)` and `worldPosition`.
 * @param {Array<Object>} objects - Collection of simulation objects that expose
 *   `update(time, universe)` and `worldPosition`.
 * @param {import('cesium').JulianDate} time - Epoch at which to evaluate shadow status.
 * @param {Object} [universe] - Optional universe context to forward into object updates.
 * @returns {Array<ShadowState>} Shadow classification for each provided object.
 */
function getShadowStatus(sun, objects, time, universe) {
  if (!defined(sun)) {
    throw new TypeError('Sun object is required.');
  }

  if (!defined(time)) {
    throw new TypeError('Time argument is required.');
  }

  if (!Array.isArray(objects)) {
    throw new TypeError('Objects must be provided as an array.');
  }

  if (typeof sun.update === 'function') {
    sun.update(time, universe);
  }

  const sunPosition = sun.worldPosition;
  if (!defined(sunPosition)) {
    throw new TypeError('Sun object must expose a worldPosition.');
  }

  const sunDistance = Cartesian3.magnitude(sunPosition);
  if (sunDistance === 0) {
    return objects.map(() => ShadowState.SUNLIT);
  }

  const sunDirection = Cartesian3.divideByScalar(sunPosition, sunDistance, new Cartesian3());
  const umbraLength = EARTH_RADIUS * sunDistance / (SUN_RADIUS - EARTH_RADIUS);
  const penumbraLength = EARTH_RADIUS * sunDistance / (SUN_RADIUS + EARTH_RADIUS);

  return objects.map((object) => {
    if (!defined(object)) {
      return ShadowState.SUNLIT;
    }

    if (typeof object.update === 'function') {
      object.update(time, universe);
    }

    const position = object.worldPosition;
    if (!defined(position)) {
      return ShadowState.SUNLIT;
    }

    return classifyShadowState(position, sunDirection, umbraLength, penumbraLength);
  });
}

export { ShadowState, getShadowStatus, classifyShadowState };
