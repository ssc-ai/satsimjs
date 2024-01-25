import { Cartesian3, defined } from 'cesium';

function mvToPe(mv, zeropoint) {
    return 10 ** ((zeropoint - mv) / 2.5)
}

function peToMv(pe, zeropoint) {
    return zeropoint - 2.5 * Math.log10(pe)
}


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