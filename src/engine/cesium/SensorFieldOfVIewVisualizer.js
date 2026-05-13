import {
  ArcType,
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
const GEOMETRY_EPS_DEGREES = 1e-3
const MIN_GEOMETRY_FOV_DEGREES = GEOMETRY_EPS_DEGREES * 4
const MIN_OUTLINE_SAMPLES = 8

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

function positiveFiniteFov(sensor, axis, fallback = GEOMETRY_EPS_DEGREES) {
  const value = Math.abs(Number(sensor?.[axis]))
  if (Number.isFinite(value) && value > 0) {
    return value
  }
  return fallback
}

function clampFovDegrees(value, maximum) {
  if (!Number.isFinite(value) || value <= 0) {
    return MIN_GEOMETRY_FOV_DEGREES
  }
  return Math.min(Math.max(Math.abs(value), MIN_GEOMETRY_FOV_DEGREES), maximum)
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

function rangeToInnerRadii(range) {
  const inner = Math.min(Math.max(range * 1e-4, 10.0), range * 0.5)
  return new Cartesian3(inner, inner, inner)
}

function createDynamicInnerRadii() {
  return new Cartesian3(CMath.EPSILON1, CMath.EPSILON1, CMath.EPSILON1)
}

function createValueProperty(getValue, isDynamic) {
  return isDynamic
    ? new CallbackProperty(() => getValue(), false)
    : getValue()
}

function combineVectors(a, scaleA, b, scaleB) {
  return new Cartesian3(
    (a.x * scaleA) + (b.x * scaleB),
    (a.y * scaleA) + (b.y * scaleB),
    (a.z * scaleA) + (b.z * scaleB)
  )
}

function createClockGeometry(sensor) {
  const isDynamic = shouldUseDynamicFov(sensor)
  const getClampedFov = () => Math.min(
    clampFovDegrees(positiveFiniteFov(sensor, 'x_fov'), 360),
    360 - (2 * GEOMETRY_EPS_DEGREES)
  )
  const initialFov = clampFovDegrees(positiveFiniteFov(sensor, 'x_fov'), 360)

  if (!isDynamic && initialFov >= 360 - GEOMETRY_EPS_DEGREES) {
    return {
      clockOffsetDegrees: 0,
      sections: [{}]
    }
  }

  const clockOffsetDegrees = () => GEOMETRY_EPS_DEGREES + (getClampedFov() / 2)
  return {
    clockOffsetDegrees: isDynamic ? clockOffsetDegrees : clockOffsetDegrees(),
    sections: [{
      minimumClock: createValueProperty(() => CMath.toRadians(GEOMETRY_EPS_DEGREES), isDynamic),
      maximumClock: createValueProperty(
        () => CMath.toRadians(GEOMETRY_EPS_DEGREES + getClampedFov()),
        isDynamic
      )
    }]
  }
}

function createConeBounds(sensor) {
  const isDynamic = shouldUseDynamicFov(sensor)
  const getHalfFov = () => Math.min(
    clampFovDegrees(positiveFiniteFov(sensor, 'y_fov'), 180) / 2,
    90 - GEOMETRY_EPS_DEGREES
  )
  return {
    minimumCone: createValueProperty(
      () => CMath.toRadians(Math.max(GEOMETRY_EPS_DEGREES, 90 - getHalfFov())),
      isDynamic
    ),
    maximumCone: createValueProperty(
      () => CMath.toRadians(Math.min(180 - GEOMETRY_EPS_DEGREES, 90 + getHalfFov())),
      isDynamic
    )
  }
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

function createSensorAxes(sensor, universe, clockOffsetDegrees = 0) {
  const baseX = sensor.transformVectorTo(universe.earth, new Cartesian3(0, 0, -1))
  const baseY = sensor.transformVectorTo(universe.earth, Cartesian3.UNIT_Y)
  const z = sensor.transformVectorTo(universe.earth, Cartesian3.UNIT_X)
  const offsetDegrees = typeof clockOffsetDegrees === 'function'
    ? clockOffsetDegrees()
    : clockOffsetDegrees
  const clockOffset = CMath.toRadians(offsetDegrees)
  const cosClock = Math.cos(clockOffset)
  const sinClock = Math.sin(clockOffset)
  const x = combineVectors(baseX, cosClock, baseY, -sinClock)
  const y = combineVectors(baseX, sinClock, baseY, cosClock)
  return { x, y, z }
}

function createSensorOrientation(sensor, universe, clockOffsetDegrees = 0, result = new Quaternion()) {
  const axes = createSensorAxes(sensor, universe, clockOffsetDegrees)
  const x = axes.x
  const y = axes.y
  const z = axes.z
  const matrix = new Matrix3(x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z)
  return Quaternion.fromRotationMatrix(matrix, result)
}

function createStaticFixedOrientationProperty(sensor, universe, viewer, clockOffsetDegrees = 0) {
  const time = viewer.clock.currentTime
  sensor.update(time, universe, true, true, false)
  universe.earth.update(time, universe)
  return new ConstantProperty(createSensorOrientation(sensor, universe, clockOffsetDegrees))
}

function canUseSensorOrientation(sensor, universe) {
  return typeof sensor?.transformVectorTo === 'function' && defined(universe?.earth)
}

function createDynamicSensorOrientationProperty(sensor, universe, clockOffsetDegrees) {
  return new CallbackProperty((time, result) => {
    sensor.update(time, universe)
    universe.earth.update(time, universe)
    return createSensorOrientation(sensor, universe, clockOffsetDegrees, result)
  }, false)
}

function propertyValue(value, time, result) {
  if (defined(value) && typeof value.getValue === 'function') {
    return value.getValue(time, result)
  }
  if (defined(value?.value)) {
    return Cartesian3.clone(value.value, result)
  }
  return value
}

function numericPropertyValue(value, time, fallback) {
  const resolved = propertyValue(value, time)
  return Number.isFinite(resolved) ? resolved : fallback
}

function isFullClockSection(clockSection) {
  return !defined(clockSection?.minimumClock) && !defined(clockSection?.maximumClock)
}

function pointOnSensorSurface(origin, axes, range, clock, cone) {
  const sinCone = Math.sin(cone)
  const localX = range * sinCone * Math.cos(clock)
  const localY = range * sinCone * Math.sin(clock)
  const localZ = range * Math.cos(cone)
  return new Cartesian3(
    origin.x + (axes.x.x * localX) + (axes.y.x * localY) + (axes.z.x * localZ),
    origin.y + (axes.x.y * localX) + (axes.y.y * localY) + (axes.z.y * localZ),
    origin.z + (axes.x.z * localX) + (axes.y.z * localY) + (axes.z.z * localZ)
  )
}

function addOutlinePoint(points, origin, axes, range, clock, cone) {
  points.push(pointOnSensorSurface(origin, axes, range, clock, cone))
}

function addClockArc(points, origin, axes, range, startClock, endClock, cone, samples, skipFirst = false) {
  const firstIndex = skipFirst ? 1 : 0
  for (let i = firstIndex; i < samples; i++) {
    const t = samples <= 1 ? 0 : i / (samples - 1)
    addOutlinePoint(points, origin, axes, range, startClock + ((endClock - startClock) * t), cone)
  }
}

function addConeArc(points, origin, axes, range, clock, startCone, endCone, samples, skipFirst = false) {
  const firstIndex = skipFirst ? 1 : 0
  for (let i = firstIndex; i < samples; i++) {
    const t = samples <= 1 ? 0 : i / (samples - 1)
    addOutlinePoint(points, origin, axes, range, clock, startCone + ((endCone - startCone) * t))
  }
}

function createOutlinePositions({
  clockSection,
  coneBounds,
  clockOffsetDegrees,
  cone,
  gimbal,
  position,
  range,
  sensor,
  universe,
  time,
  slicePartitions,
  stackPartitions
}) {
  if (!canUseSensorOrientation(sensor, universe)) {
    return []
  }

  gimbal?.update?.(time, universe)
  const origin = Cartesian3.clone(propertyValue(position, time), new Cartesian3())
  if (!defined(origin)) {
    return []
  }

  universe.earth.update(time, universe)
  const axes = createSensorAxes(sensor, universe, clockOffsetDegrees)
  const maxRange = typeof range === 'function' ? range() : range
  const minClock = numericPropertyValue(clockSection?.minimumClock, time, 0)
  const maxClock = numericPropertyValue(clockSection?.maximumClock, time, Math.PI * 2)
  const minCone = numericPropertyValue(
    cone ?? coneBounds?.minimumCone,
    time,
    numericPropertyValue(coneBounds?.minimumCone, time, GEOMETRY_EPS_DEGREES)
  )
  const maxCone = numericPropertyValue(coneBounds?.maximumCone, time, Math.PI - GEOMETRY_EPS_DEGREES)
  const clockSamples = Math.max(MIN_OUTLINE_SAMPLES, slicePartitions + 1)
  const coneSamples = Math.max(MIN_OUTLINE_SAMPLES, stackPartitions + 1)
  const points = []

  if (defined(cone)) {
    addClockArc(points, origin, axes, maxRange, minClock, maxClock, minCone, clockSamples)
    if (points.length > 0) {
      points.push(Cartesian3.clone(points[0]))
    }
    return points
  }

  addClockArc(points, origin, axes, maxRange, minClock, maxClock, minCone, clockSamples)
  addConeArc(points, origin, axes, maxRange, maxClock, minCone, maxCone, coneSamples, true)
  addClockArc(points, origin, axes, maxRange, maxClock, minClock, maxCone, clockSamples, true)
  addConeArc(points, origin, axes, maxRange, minClock, maxCone, minCone, coneSamples, true)

  if (points.length > 0) {
    points.push(Cartesian3.clone(points[0]))
  }
  return points
}

function createOutlinePositionProperty(options, isDynamic) {
  if (isDynamic) {
    return new CallbackProperty((time) => createOutlinePositions({ ...options, time }), false)
  }
  return createOutlinePositions(options)
}

class SensorFieldOfViewVisualizer extends CompountElementVisualizer {
  constructor(viewer, site, gimbal, sensor, universe, color, inactiveColor) {
    super(color ?? Color.GREEN, 0.25, 0.5)
    this._color = resolveColor(color, Color.GREEN)
    this._gimbal = gimbal
    this._inactiveColor = resolveColor(inactiveColor, Color.GRAY)
    this._lastTrackingState = undefined
    this._fovEllipsoid = undefined
    this._fovEllipsoids = []
    this._outlinePolylines = []
    const slicePartitions = resolveFovPartitions(maxRenderableFov(sensor, 'x_fov'))
    const stackPartitions = resolveFovPartitions(maxRenderableFov(sensor, 'y_fov'))
    const useStaticFixedRenderMode = shouldUseStaticFixedRenderMode(sensor)
    const useCustomOutline = canUseSensorOrientation(sensor, universe)
    const staticRange = positiveNumber(sensor?.maxRange, gimbal?.maxRange, gimbal?.range)
    const clockGeometry = createClockGeometry(sensor)
    const position = useStaticFixedRenderMode
      ? createStaticFixedPositionProperty(sensor, universe, viewer)
      : createObjectPositionProperty(sensor, universe, viewer)
    const orientation = useStaticFixedRenderMode
      ? createStaticFixedOrientationProperty(sensor, universe, viewer, clockGeometry.clockOffsetDegrees)
      : canUseSensorOrientation(sensor, universe)
        ? createDynamicSensorOrientationProperty(sensor, universe, clockGeometry.clockOffsetDegrees)
        : createObjectOrientationProperty(sensor, universe)
    const clockSections = clockGeometry.sections
    const coneBounds = createConeBounds(sensor)

    clockSections.forEach((clockSection, index) => {
      const e = viewer.entities.add({
        name: `${sensor.name} Field of View${clockSections.length > 1 ? ` ${index + 1}` : ''}`,
        position,
        orientation,
        ellipsoid: {
          radii: useStaticFixedRenderMode
            ? rangeToRadii(staticRange)
            : createRangeProperty(sensor, gimbal, universe, () => this._applyTrackingColor()),
          innerRadii: useStaticFixedRenderMode
            ? rangeToInnerRadii(staticRange)
            : createDynamicInnerRadii(),
          ...clockSection,
          ...coneBounds,
          material: this._color.withAlpha(this._materialAlpha),
          outlineColor: this._color.withAlpha(this._outlineAlpha),
          fill: true,
          outline: !useCustomOutline,
          slicePartitions,
          stackPartitions
        },
        simObjectRef: sensor,
        allowPicking: false
      })

      this._fovEllipsoids.push(e.ellipsoid)
      this._entities.push(e.ellipsoid)

      if (useCustomOutline) {
        const outlineSections = isFullClockSection(clockSection)
          ? [coneBounds.minimumCone, coneBounds.maximumCone]
          : [undefined]
        outlineSections.forEach((cone, outlineIndex) => {
          const positions = createOutlinePositionProperty({
            clockSection,
            coneBounds,
            clockOffsetDegrees: clockGeometry.clockOffsetDegrees,
            cone,
            gimbal,
            position,
            range: useStaticFixedRenderMode
              ? staticRange
              : () => resolveSensorRange(sensor, gimbal),
            sensor,
            universe,
            time: viewer.clock?.currentTime,
            slicePartitions,
            stackPartitions
          }, !useStaticFixedRenderMode)
          const outline = viewer.entities.add({
            name: `${sensor.name} Field of View Outline${outlineSections.length > 1 ? ` ${outlineIndex + 1}` : ''}`,
            polyline: {
              positions,
              material: this._color.withAlpha(this._outlineAlpha),
              width: 1,
              arcType: ArcType.NONE,
              show: this._outline
            },
            simObjectRef: sensor,
            allowPicking: false
          })
          this._outlinePolylines.push(outline.polyline)
          this._entities.push(outline.polyline)
        })
      }
    })

    this._fovEllipsoid = this._fovEllipsoids[0]
    this._applyTrackingColor(true)
  }

  _forEachFovEllipsoid(callback) {
    this._fovEllipsoids.forEach((ellipsoid) => {
      if (defined(ellipsoid)) {
        callback(ellipsoid)
      }
    })
  }

  _forEachOutlinePolyline(callback) {
    this._outlinePolylines.forEach((polyline) => {
      if (defined(polyline)) {
        callback(polyline)
      }
    })
  }

  get show() {
    return this._show
  }

  set show(value) {
    this._show = Boolean(value)
    this._forEachFovEllipsoid((ellipsoid) => {
      ellipsoid.show = this._show
    })
    this._syncOutlineVisibility()
  }

  get outline() {
    return this._outline
  }

  set outline(value) {
    this._outline = Boolean(value)
    this._forEachFovEllipsoid((ellipsoid) => {
      ellipsoid.outline = this._outline && this._outlinePolylines.length === 0
    })
    this._syncOutlineVisibility()
  }

  _syncOutlineVisibility() {
    this._forEachOutlinePolyline((polyline) => {
      polyline.show = this._show && this._outline
    })
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
    this._forEachFovEllipsoid((ellipsoid) => {
      ellipsoid.fill = Boolean(value)
    })
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
    this._forEachFovEllipsoid((ellipsoid) => {
      ellipsoid.material = baseColor.withAlpha(this._materialAlpha)
      ellipsoid.outlineColor = baseColor.withAlpha(this._outlineAlpha)
    })
    this._forEachOutlinePolyline((polyline) => {
      polyline.material = baseColor.withAlpha(this._outlineAlpha)
    })
    this._lastTrackingState = isTracking
  }

  _isTracking() {
    return isTrackingGimbal(this._gimbal)
  }
}

export default SensorFieldOfViewVisualizer
