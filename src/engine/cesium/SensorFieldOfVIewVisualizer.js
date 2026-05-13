import {
  Color,
  CallbackProperty,
  Cartesian3,
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

function positiveNumber(...values) {
  for (let i = 0; i < values.length; i++) {
    const value = Number(values[i])
    if (Number.isFinite(value) && value > 0) {
      return value
    }
  }
  return 1.0
}

function isTrackingGimbal(gimbal) {
  return defined(gimbal?.trackObject)
}

function resolveSensorRange(sensor, gimbal) {
  return isTrackingGimbal(gimbal)
    ? positiveNumber(gimbal?.range, sensor?.maxRange, gimbal?.maxRange)
    : positiveNumber(sensor?.maxRange, gimbal?.maxRange, gimbal?.range)
}

function maxRenderableFov(sensor, axis) {
  const fov = Number(sensor?.[axis])
  const zoomKey = axis === 'x_fov' ? 'max_x_fov' : 'max_y_fov'
  const zoomFov = Number(sensor?.zoom?.[zoomKey])
  return Math.max(
    Number.isFinite(fov) ? Math.abs(fov) : 0,
    Number.isFinite(zoomFov) ? Math.abs(zoomFov) : 0
  )
}

function shouldUseDynamicFov(sensor) {
  return sensor?.canZoom === true
}

function shouldUseStaticFixedRenderMode(sensor) {
  return sensor?.fieldOfViewRenderMode === 'static-fixed'
}

function resolveColor(color, fallback) {
  return defined(color) ? color : fallback
}

function rangeToRadii(range, result) {
  const radii = defined(result) ? result : new Cartesian3()
  radii.x = range
  radii.y = range
  radii.z = range
  return radii
}

function createRangeProperty(sensor, gimbal, universe, updateTrackingState) {
  return new CallbackProperty((time, result) => {
    gimbal?.update?.(time, universe)
    updateTrackingState()
    return rangeToRadii(resolveSensorRange(sensor, gimbal), result)
  }, false)
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

function createClockProperty(sensor, sign) {
  const getValue = () => CMath.toRadians(sign * Number(sensor.x_fov) / 2)
  return shouldUseDynamicFov(sensor)
    ? new CallbackProperty(getValue, false)
    : getValue()
}

function createConeProperty(sensor, sign) {
  const getValue = () => CMath.toRadians(90 + (sign * Number(sensor.y_fov) / 2))
  return shouldUseDynamicFov(sensor)
    ? new CallbackProperty(getValue, false)
    : getValue()
}

class SensorFieldOfViewVisualizer extends CompountElementVisualizer {
  constructor(viewer, site, gimbal, sensor, universe, color, inactiveColor) {
    super(color ?? Color.GREEN, 0.25, 0.5)
    this._color = resolveColor(color, Color.GREEN)
    this._gimbal = gimbal
    this._inactiveColor = resolveColor(inactiveColor, Color.GRAY)
    this._lastTrackingState = undefined
    this._fovEllipsoid = undefined
    const slicePartitions = resolveFovPartitions(maxRenderableFov(sensor, 'x_fov'))
    const stackPartitions = resolveFovPartitions(maxRenderableFov(sensor, 'y_fov'))
    const useStaticFixedRenderMode = shouldUseStaticFixedRenderMode(sensor)
    const radii = useStaticFixedRenderMode
      ? rangeToRadii(positiveNumber(sensor?.maxRange, gimbal?.maxRange, gimbal?.range))
      : createRangeProperty(sensor, gimbal, universe, () => this._applyTrackingColor())
    const e = viewer.entities.add({
      name: sensor.name + ' Field of View',
      position: useStaticFixedRenderMode
        ? createStaticFixedPositionProperty(sensor, universe, viewer)
        : createObjectPositionProperty(sensor, universe, viewer),
      orientation: useStaticFixedRenderMode
        ? createStaticFixedOrientationProperty(sensor, universe, viewer)
        : createObjectOrientationProperty(sensor, universe),
      ellipsoid: {
        radii,
        innerRadii: new Cartesian3(CMath.EPSILON1, CMath.EPSILON1, CMath.EPSILON1), // Cesium will crash if innerRadii is small and radii is large
        minimumClock: useStaticFixedRenderMode ? CMath.toRadians(-Number(sensor.x_fov) / 2) : createClockProperty(sensor, -1),
        maximumClock: useStaticFixedRenderMode ? CMath.toRadians(Number(sensor.x_fov) / 2) : createClockProperty(sensor, 1),
        minimumCone: useStaticFixedRenderMode ? CMath.toRadians(90 - (Number(sensor.y_fov) / 2)) : createConeProperty(sensor, -1),
        maximumCone: useStaticFixedRenderMode ? CMath.toRadians(90 + (Number(sensor.y_fov) / 2)) : createConeProperty(sensor, 1),
        material: this._color.withAlpha(this._materialAlpha),
        outlineColor: this._color.withAlpha(this._outlineAlpha),
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
    this._inactiveColor = resolveColor(value, Color.GRAY)
    this._applyTrackingColor(true)
  }

  get color() {
    return this._color
  }

  set color(value) {
    this._color = resolveColor(value, Color.GREEN)
    this._applyTrackingColor(true)
  }

  get materialAlpha() {
    return this._materialAlpha
  }

  set materialAlpha(value) {
    this._materialAlpha = value
    this._applyTrackingColor(true)
  }

  get outlineAlpha() {
    return this._outlineAlpha
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
    this._fovEllipsoid.material = baseColor.withAlpha(this._materialAlpha)
    this._fovEllipsoid.outlineColor = baseColor.withAlpha(this._outlineAlpha)
    this._lastTrackingState = isTracking
  }

  _isTracking() {
    return isTrackingGimbal(this._gimbal)
  }
}

export default SensorFieldOfViewVisualizer
