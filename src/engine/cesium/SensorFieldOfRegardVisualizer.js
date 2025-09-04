import { defined, Math as CMath, Color, Cartesian3 } from 'cesium'
import { createObjectPositionProperty, createObjectOrientationProperty } from './utils.js'
import CompountElementVisualizer from './CompoundElementVisualizer.js'

class SensorFieldOfRegardVisualizer extends CompountElementVisualizer {
  constructor(viewer, site, sensor, universe) {
    super(Color.PURPLE, 0.1, 0.5)

    if (defined(sensor.field_of_regard)) {
      for (let i = 0; i < sensor.field_of_regard.length; i++) {
        const fofr = sensor.field_of_regard[i];
        const parts = createFieldOfRegardSections(
          fofr.clock[0], fofr.clock[1],
          fofr.elevation[0], fofr.elevation[1],
          fofr.range
        );
        parts.forEach((g) => this._entities.push(g));
      }
    }

    function createFieldOfRegardSections(minClock, maxClock, minEl, maxEl, range) {
      if (range === undefined) range = 45000000.0;

      const epsDeg = 0.1; // minimum angular width to avoid degeneracy (~0.0017 rad)

      // Normalize clocks to [0, 360) and split at the 0° seam to avoid IDL issues
      const wrap360 = (deg) => ((deg % 360) + 360) % 360;
      let aDeg = wrap360(minClock);
      let bDeg = wrap360(maxClock);

      // Detect a full 360° interval (e.g., 0..360)
      const rawWidth = Math.abs(maxClock - minClock);
      const isFullCircle = rawWidth >= (360.0 - epsDeg);

      // Ensure non-zero width when not full 360
      if (!isFullCircle && Math.abs(bDeg - aDeg) < epsDeg) {
        if (bDeg >= aDeg) bDeg = aDeg + epsDeg; else aDeg = bDeg - epsDeg;
        aDeg = wrap360(aDeg);
        bDeg = wrap360(bDeg);
      }

      // If interval crosses the 0° seam, split into two parts
      const intervals = [];
      if (!isFullCircle && bDeg < aDeg) {
        intervals.push([aDeg, 360.0 - epsDeg]);
        intervals.push([0.0 + epsDeg, bDeg]);
      } else if (!isFullCircle) {
        intervals.push([aDeg, bDeg]);
      }

      // Compute cone angles with clamping away from 0 and π
      const coneEps = CMath.RADIANS_PER_DEGREE * epsDeg;
      const coneMinRaw = CMath.toRadians(90.0 - Math.max(minEl, maxEl));
      const coneMaxRaw = CMath.toRadians(90.0 - Math.min(minEl, maxEl));
      const minCone = Math.max(coneEps, Math.min(coneMinRaw, Math.PI - coneEps));
      const maxCone = Math.max(minCone + coneEps, Math.min(coneMaxRaw, Math.PI - coneEps));

      // Use a small but scale-aware inner radius to avoid degenerate triangles
      const inner = Math.max(range * 1e-4, 10.0);

      const graphics = [];
      // For full-circle: create one ellipsoid sector without clock slicing
      const makeEllipsoid = (minClkRad, maxClkRad) => {
        const ent = viewer.entities.add({
          name: sensor.name + ' Field of Regard',
          position: createObjectPositionProperty(site, universe, viewer),
          orientation: createObjectOrientationProperty(site, universe),
          ellipsoid: {
            radii: new Cartesian3(range, range, range),
            innerRadii: new Cartesian3(inner, inner, inner),
            minimumClock: minClkRad,
            maximumClock: maxClkRad,
            minimumCone: minCone,
            maximumCone: maxCone,
            material: Color.PURPLE.withAlpha(0.1),
            outlineColor: Color.PURPLE.withAlpha(0.5),
            outline: false, // disable built-in outline to avoid splitLongitude artifacts
            slicePartitions: 36,
            stackPartitions: 20
          },
          simObjectRef: sensor,
          allowPicking: false
        });
        graphics.push(ent.ellipsoid);
      };

      if (isFullCircle) {
        // Single unsliced sector (min/max clock omitted to cover full 360°)
        const ent = viewer.entities.add({
          name: sensor.name + ' Field of Regard',
          position: createObjectPositionProperty(site, universe, viewer),
          orientation: createObjectOrientationProperty(site, universe),
          ellipsoid: {
            radii: new Cartesian3(range, range, range),
            innerRadii: new Cartesian3(inner, inner, inner),
            minimumCone: minCone,
            maximumCone: maxCone,
            material: Color.PURPLE.withAlpha(0.1),
            outlineColor: Color.PURPLE.withAlpha(0.5),
            outline: false,
            slicePartitions: 36,
            stackPartitions: 20
          },
          simObjectRef: sensor,
          allowPicking: false
        });
        graphics.push(ent.ellipsoid);
      } else {
        for (const [cMinDeg, cMaxDeg] of intervals) {
          makeEllipsoid(CMath.toRadians(cMinDeg), CMath.toRadians(cMaxDeg));
        }
      }

      return graphics;
    }
  }
}

export default SensorFieldOfRegardVisualizer
