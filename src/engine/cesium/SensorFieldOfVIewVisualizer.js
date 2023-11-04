import { defaultValue, Color, CallbackProperty, Cartesian3, Math as CMath } from 'cesium'
import { createObjectPositionProperty, createObjectOrientationProperty } from './utils.js'
import CompountElementVisualizer from './CompoundElementVisualizer.js'

class SensorFieldOfViewVisualizer extends CompountElementVisualizer {
  constructor(viewer, site, gimbal, sensor, universe, color) {
    super(defaultValue(color, Color.GREEN), 0.25, 0.5)
    const e = viewer.entities.add({
      name: sensor.name + ' Field of View',
      position: createObjectPositionProperty(sensor, universe, viewer),
      orientation: createObjectOrientationProperty(sensor, universe),
      ellipsoid: {
        radii: new CallbackProperty(function(time, result) {
          gimbal.update(time, universe)
          let range = gimbal.range <= 0 ? 1.0 : gimbal.range // Cesium will crash if range is less than 0
          return Cartesian3.clone(new Cartesian3(range, range, range), result)
        }, false),
        innerRadii: new Cartesian3(CMath.EPSILON1, CMath.EPSILON1, CMath.EPSILON1), // Cesium will crash if innerRadii is small and radii is large
        minimumClock: CMath.toRadians(-sensor.x_fov / 2),
        maximumClock: CMath.toRadians(sensor.x_fov / 2),
        minimumCone: CMath.toRadians(90 - sensor.y_fov / 2),
        maximumCone: CMath.toRadians(90 + sensor.y_fov / 2),
        material: this._color.withAlpha(0.25),
        outlineColor: this._color.withAlpha(0.5),
        outline: true,
        slicePartitions: 3,
        stackPartitions: 3
      },
      simObjectRef: sensor,
      allowPicking: false
    })

    this._entities.push(e.ellipsoid)
  }
}

export default SensorFieldOfViewVisualizer
