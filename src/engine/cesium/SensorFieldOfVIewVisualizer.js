import {
  Color,
  Cartesian3,
  ColorMaterialProperty,
  ConstantPositionProperty,
  ConstantProperty,
  Math as CMath,
  Matrix3,
  Quaternion,
  ReferenceFrame,
  defined
} from 'cesium'
import { createObjectPositionProperty, createObjectOrientationProperty } from './utils.js'
import CompountElementVisualizer from './CompoundElementVisualizer.js'

const FOV_DEGREES_PER_PARTITION = 2.5
const MIN_FOV_PARTITIONS = 8
const MAX_FOV_PARTITIONS = 96

function resolveFovPartitions(fovDeg) {
  const fov = Math.abs(Number(fovDeg))
  if (!Number.isFinite(fov) || fov <= 0) {
    return MIN_FOV_PARTITIONS
  }
  return Math.max(
    MIN_FOV_PARTITIONS,
    Math.min(MAX_FOV_PARTITIONS, Math.ceil(fov / FOV_DEGREES_PER_PARTITION))
  )
}

function resolveSensorRange(sensor, gimbal) {
  const range = Number(sensor?.maxRange ?? gimbal?.maxRange ?? gimbal?.range)
  return Number.isFinite(range) && range > 0 ? range : 1.0
}

function canUseStaticFixedPose(sensor, gimbal) {
  return sensor?.referenceFrame === ReferenceFrame.FIXED &&
    gimbal?.trackMode === 'fixed' &&
    !defined(gimbal.trackObject)
}

function createStaticFixedPositionProperty(sensor, universe, viewer) {
  const time = viewer.clock.currentTime
  sensor.update(time, universe, true, true, false)
  return new ConstantPositionProperty(Cartesian3.clone(sensor.position), ReferenceFrame.FIXED)
}

function createStaticFixedOrientationProperty(sensor, universe, viewer) {
  const time = viewer.clock.currentTime
  sensor.update(time, universe, true, true, false)
  universe.earth.update(time, universe)
  const x = sensor.transformVectorTo(universe.earth, new Cartesian3(0, 0, -1))
  const y = sensor.transformVectorTo(universe.earth, Cartesian3.UNIT_Y)
  const z = sensor.transformVectorTo(universe.earth, Cartesian3.UNIT_X)
  const matrix = new Matrix3(x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z)
  return new ConstantProperty(Quaternion.fromRotationMatrix(matrix, new Quaternion()))
}

function cloneMutableColor(color, fallback, result = new Color()) {
  return Color.clone(defined(color) ? color : fallback, result)
}

function cloneWithAlpha(color, alpha, result = new Color()) {
  Color.clone(color, result)
  result.alpha = alpha
  return result
}

class SensorFieldOfViewVisualizer extends CompountElementVisualizer {
  constructor(viewer, site, gimbal, sensor, universe, color, inactiveColor) {
    super(color ?? Color.GREEN, 0.25, 0.5)
    this._color = cloneMutableColor(color, Color.GREEN)
    this._gimbal = gimbal
    this._inactiveColor = cloneMutableColor(inactiveColor, Color.GRAY)
    this._lastTrackingState = undefined
    this._fovEllipsoid = undefined
    this._materialColor = cloneWithAlpha(this._color, this._materialAlpha)
    this._outlineColor = cloneWithAlpha(this._color, this._outlineAlpha)
    this._materialColorProperty = new ConstantProperty(this._materialColor)
    this._outlineColorProperty = new ConstantProperty(this._outlineColor)
    const slicePartitions = resolveFovPartitions(sensor.x_fov)
    const stackPartitions = resolveFovPartitions(sensor.y_fov)
    const range = resolveSensorRange(sensor, gimbal)
    const staticPose = canUseStaticFixedPose(sensor, gimbal)
    const e = viewer.entities.add({
      name: sensor.name + ' Field of View',
      position: staticPose
        ? createStaticFixedPositionProperty(sensor, universe, viewer)
        : createObjectPositionProperty(sensor, universe, viewer),
      orientation: staticPose
        ? createStaticFixedOrientationProperty(sensor, universe, viewer)
        : createObjectOrientationProperty(sensor, universe),
      ellipsoid: {
        radii: new Cartesian3(range, range, range),
        innerRadii: new Cartesian3(CMath.EPSILON1, CMath.EPSILON1, CMath.EPSILON1), // Cesium will crash if innerRadii is small and radii is large
        minimumClock: CMath.toRadians(-sensor.x_fov / 2),
        maximumClock: CMath.toRadians(sensor.x_fov / 2),
        minimumCone: CMath.toRadians(90 - sensor.y_fov / 2),
        maximumCone: CMath.toRadians(90 + sensor.y_fov / 2),
        material: new ColorMaterialProperty(this._materialColorProperty),
        outlineColor: this._outlineColorProperty,
        fill: true,
        outline: true,
        slicePartitions,
        stackPartitions
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
    cloneMutableColor(value, Color.GRAY, this._inactiveColor)
    this._applyTrackingColor(true)
  }

  set color(value) {
    cloneMutableColor(value, Color.GREEN, this._color)
    this._applyTrackingColor(true)
  }

  set materialAlpha(value) {
    this._materialAlpha = value
    this._applyTrackingColor(true)
  }

  set outlineAlpha(value) {
    this._outlineAlpha = value
    this._applyTrackingColor(true)
  }

  get fill() {
    return defined(this._fovEllipsoid) ? this._fovEllipsoid.fill : true
  }

  set fill(value) {
    if (defined(this._fovEllipsoid)) {
      this._fovEllipsoid.fill = Boolean(value)
    }
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
    cloneWithAlpha(baseColor, this._materialAlpha, this._materialColor)
    cloneWithAlpha(baseColor, this._outlineAlpha, this._outlineColor)
    this._materialColorProperty.setValue(this._materialColor)
    this._outlineColorProperty.setValue(this._outlineColor)
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
