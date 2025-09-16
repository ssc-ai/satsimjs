import { Color, CallbackProperty, Cartesian3, Math as CMath, defined } from 'cesium'
import { createObjectPositionProperty, createObjectOrientationProperty } from './utils.js'
import CompountElementVisualizer from './CompoundElementVisualizer.js'

class SensorFieldOfViewVisualizer extends CompountElementVisualizer {
  constructor(viewer, site, gimbal, sensor, universe, color, inactiveColor) {
    super(color ?? Color.GREEN, 0.25, 0.5)
    this._gimbal = gimbal
    this._inactiveColor = inactiveColor ?? Color.GRAY
    this._lastTrackingState = undefined
    this._fovEllipsoid = undefined
    const e = viewer.entities.add({
      name: sensor.name + ' Field of View',
      position: createObjectPositionProperty(sensor, universe, viewer),
      orientation: createObjectOrientationProperty(sensor, universe),
      ellipsoid: {
        radii: new CallbackProperty((time, result) => {
          gimbal.update(time, universe)
          this._applyTrackingColor()
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

    this._fovEllipsoid = e.ellipsoid
    this._applyTrackingColor(true)
    this._entities.push(e.ellipsoid)
  }

  get inactiveColor() {
    return this._inactiveColor
  }

  set inactiveColor(value) {
    this._inactiveColor = defined(value) ? value : Color.GRAY
    this._applyTrackingColor(true)
  }

  set color(value) {
    super.color = value
    this._applyTrackingColor(true)
  }

  _applyTrackingColor(force = false) {
    if (!defined(this._fovEllipsoid) || !defined(this._gimbal)) {
      return
    }
    const isTracking = this._isTracking()
    if (!force && isTracking === this._lastTrackingState) {
      return
    }
    const baseColor = isTracking ? this._color : this._inactiveColor
    this._fovEllipsoid.material = baseColor.withAlpha(this._materialAlpha)
    this._fovEllipsoid.outlineColor = baseColor.withAlpha(this._outlineAlpha)
    this._lastTrackingState = isTracking
  }

  _isTracking() {
    if (!defined(this._gimbal)) {
      return false
    }
    return defined(this._gimbal.trackObject)
  }
}

export default SensorFieldOfViewVisualizer
