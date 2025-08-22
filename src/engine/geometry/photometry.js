import { Cartesian3, defined } from 'cesium';

/**
 * Converts apparent magnitude to photoelectrons.
 * 
 * This function implements the standard astronomical magnitude-to-flux conversion
 * using the Pogson ratio (2.5 * log10). The relationship is:
 * pe = 10^((zeropoint - mv) / 2.5)
 * 
 * @param {number} mv - Apparent visual magnitude of the object
 * @param {number} zeropoint - Photometric zeropoint of the detector system (magnitude)
 * @returns {number} Number of photoelectrons detected from the object
 * 
 * @example
 * // Convert a 5th magnitude star to photoelectrons with zeropoint 25
 * const photoelectrons = mvToPe(5.0, 25.0);
 * // Returns approximately 10^8 photoelectrons
 */
function mvToPe(mv, zeropoint) {
    return 10 ** ((zeropoint - mv) / 2.5)
}

/**
 * Converts photoelectrons to apparent magnitude.
 * 
 * This function implements the inverse of the mvToPe conversion, calculating
 * the apparent magnitude from the number of detected photoelectrons using:
 * mv = zeropoint - 2.5 * log10(pe)
 * 
 * @param {number} pe - Number of photoelectrons detected from the object
 * @param {number} zeropoint - Photometric zeropoint of the detector system (magnitude)
 * @returns {number} Apparent visual magnitude of the object
 * 
 * @example
 * // Convert 10^8 photoelectrons to magnitude with zeropoint 25
 * const magnitude = peToMv(1e8, 25.0);
 * // Returns approximately 5.0 magnitude
 */
function peToMv(pe, zeropoint) {
    return zeropoint - 2.5 * Math.log10(pe)
}


/**
 * Calculates the apparent magnitude of a Lambertian sphere.
 * 
 * This function implements the Lambertian sphere scattering model to calculate
 * the apparent magnitude of a spherical object (like a satellite or asteroid)
 * based on its physical properties, geometry, and solar illumination.
 * 
 * The calculation uses the phase function:
 * phaseFactor = sin(φ) + (π - φ) * cos(φ)
 * 
 * Where φ is the phase angle between the Sun-target and target-observer vectors.
 * 
 * @param {number} phaseAngle - Phase angle in degrees (0° = full illumination, 180° = no illumination)
 * @param {number} range - Distance from observer to target (same units as radius)
 * @param {number} [radius=1.0] - Radius of the spherical object (default: 1.0)
 * @param {number} [albedo=0.25] - Geometric albedo of the object surface (0.0-1.0, default: 0.25)
 * @returns {number} Apparent visual magnitude of the object
 * 
 * @example
 * // Calculate magnitude of a 1m radius satellite at 1000km with typical albedo
 * const magnitude = lambertianSphereToMv(45, 1000000, 1.0, 0.25);
 * 
 * @example
 * // Calculate magnitude of the Moon (approximate)
 * const moonMag = lambertianSphereToMv(90, 384400000, 1737400, 0.12);
 */
function lambertianSphereToMv(phaseAngle, range, radius=1.0, albedo=0.25) {

    phaseAngle = phaseAngle * Math.PI / 180.0;

    const mvSun = -26.74;

    // Lambertian sphere approximation.
    const phaseFactor = Math.sin(phaseAngle) + (Math.PI - phaseAngle) * Math.cos(phaseAngle);
    const intensity = phaseFactor * (2 * albedo * (radius * radius)) / (3 * Math.PI * (range * range));

    // Convert intensities to magnitudes
    const mv = mvSun - 2.5 * Math.log10(intensity);

    return mv;
}


/**
 * Calculates the brightness characteristics of a target object as observed from a given location.
 * 
 * This function computes the phase angle, range, and apparent magnitude of a target object
 * as seen by an observer, taking into account solar illumination. It supports different
 * scattering models through the target's model property.
 * 
 * The phase angle is calculated as the angle between the Sun-to-target vector and the
 * target-to-observer vector. A phase angle of 0° indicates the target is fully illuminated
 * (opposition), while 180° indicates the target is in shadow (conjunction).
 * 
 * @param {Object} observer - Observer object with worldPosition property (Cartesian3)
 * @param {Object} target - Target object with worldPosition and optional model properties
 * @param {Object} target.model - Optional model defining scattering properties
 * @param {string} target.model.mode - Scattering model type (e.g., 'lambertianSphere')
 * @param {number} target.model.diameter - Diameter of the target object
 * @param {number} target.model.albedo - Geometric albedo of the target surface
 * @param {Object} sun - Sun object with worldPosition property (Cartesian3)
 * @returns {Object} Object containing brightness calculation results
 * @returns {number} returns.phaseAngle - Phase angle in degrees (0-180)
 * @returns {number} returns.range - Distance from observer to target
 * @returns {number|undefined} returns.mv - Apparent visual magnitude (if model is defined)
 * 
 * @example
 * // Calculate brightness of a satellite from a ground station
 * const brightness = calculateTargetBrightness(groundStation, satellite, sun);
 * console.log(`Phase angle: ${brightness.phaseAngle}°`);
 * console.log(`Range: ${brightness.range / 1000} km`);
 * console.log(`Magnitude: ${brightness.mv}`);
 * 
 * @example
 * // Target with Lambertian sphere model
 * const target = {
 *   worldPosition: new Cartesian3(7000000, 0, 0),
 *   model: {
 *     mode: 'lambertianSphere',
 *     diameter: 2.0,  // 2 meter diameter
 *     albedo: 0.25    // 25% reflectivity
 *   }
 * };
 * const result = calculateTargetBrightness(observer, target, sun);
 */
function calculateTargetBrightness(observer, target, sun) {

    const targetToSun = Cartesian3.subtract(sun.worldPosition, target.worldPosition, new Cartesian3());
    const targetToObserver = Cartesian3.subtract(observer.worldPosition, target.worldPosition, new Cartesian3());
    const phaseAngle = Cartesian3.angleBetween(targetToSun, targetToObserver) * 180 / Math.PI;
    const range = Cartesian3.magnitude(targetToObserver);

    let mv;

    if(defined(target.model)) {

        if(target.model.mode == 'lambertianSphere') {
            mv = lambertianSphereToMv(phaseAngle, range, target.model.diameter / 2.0, target.model.albedo)
        }
    }

    return {
        phaseAngle,
        range,
        mv,
    }
}

export { mvToPe, peToMv, lambertianSphereToMv, calculateTargetBrightness };