import { defined, Math as CMath, Color, Cartesian3 } from 'cesium'
import { createObjectPositionProperty, createObjectOrientationProperty } from './utils.js'
import CompountElementVisualizer from './CompoundElementVisualizer.js'

class SensorFieldOfRegardVisualizer extends CompountElementVisualizer {
  constructor(viewer, site, sensor, universe) {
    super(Color.PURPLE, 0.1, 0.5)
    
    if (defined(sensor.field_of_regard)) {
      for (let i = 0; i < sensor.field_of_regard.length; i++) {
        let fofr = sensor.field_of_regard[i]
        let ent = createFieldofRegardSection(fofr.clock[0], fofr.clock[1], fofr.elevation[0], fofr.elevation[1], fofr.range)
        this._entities.push(ent)
      }
    }

    function createFieldofRegardSection(minClock, maxClock, minEl, maxEl, range) {
      if(range === undefined)
        range = 45000000.0

      // TODO ellipsoid is buggy in Cesium (i.e., outline doesn't match, 2D view crashes), replace with a polygon
      let ent = viewer.entities.add({
        name: sensor.name + ' Field of Regard',
        position: createObjectPositionProperty(site, universe, viewer),
        orientation: createObjectOrientationProperty(site, universe),
        ellipsoid: {
          radii: new Cartesian3(range, range, range),
          innerRadii: new Cartesian3(CMath.EPSILON1, CMath.EPSILON1, CMath.EPSILON1),
          minimumClock: CMath.toRadians(minClock - 180.0),
          maximumClock: CMath.toRadians(maxClock - 180.0),
          minimumCone: CMath.toRadians(90.0-minEl),
          maximumCone: CMath.toRadians(90.0-maxEl),
          material: Color.PURPLE.withAlpha(0.1),
          outlineColor: Color.PURPLE.withAlpha(0.5),
          outline: true,
          slicePartitions: 36,
          stackPartitions: 20
        },
        simObjectRef: sensor,
        allowPicking: false
      });

      return ent.ellipsoid
    }
  }
}

export default SensorFieldOfRegardVisualizer
