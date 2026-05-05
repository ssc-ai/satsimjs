import {
  Cartesian3,
  JulianDate,
  Matrix3,
  Matrix4,
  Quaternion,
  ReferenceFrame,
  Transforms
} from '../cesiumExports.js'

const _scratchFixedRotation = new Matrix3()
const _scratchOrientation = new Matrix3()
const _scratchQuaternion = new Quaternion()
const _scratchPosition = new Cartesian3()

function julianDateToIso(value) {
  if (!(value instanceof JulianDate)) {
    return null
  }
  return JulianDate.toDate(value).toISOString()
}

function toVectorArray(value) {
  if (!(value instanceof Cartesian3)) {
    return null
  }
  return [value.x, value.y, value.z]
}

function referenceFrameToLabel(referenceFrame) {
  if (referenceFrame === ReferenceFrame.INERTIAL) return 'inertial'
  if (referenceFrame === ReferenceFrame.FIXED) return 'fixed'
  return 'unknown'
}

/**
 * Convert a Cesium clock step enum value to a stable snapshot label.
 *
 * @param {number} clockStep Cesium clock step value.
 * @returns {string} Snapshot label.
 */
export function clockStepToLabel(clockStep) {
  switch (clockStep) {
    case 0:
      return 'tick_dependent'
    case 1:
      return 'system_clock_multiplier'
    case 2:
      return 'system_clock'
    default:
      return 'custom'
  }
}

/**
 * Convert a Cesium clock range enum value to a stable snapshot label.
 *
 * @param {number} clockRange Cesium clock range value.
 * @returns {string} Snapshot label.
 */
export function clockRangeToLabel(clockRange) {
  switch (clockRange) {
    case 0:
      return 'unbounded'
    case 1:
      return 'clamped'
    case 2:
      return 'loop_stop'
    default:
      return 'custom'
  }
}

function resolvePositionEcef(object, time) {
  if (!(object?.worldPosition instanceof Cartesian3)) {
    return null
  }

  if (object.referenceFrame !== ReferenceFrame.INERTIAL) {
    return toVectorArray(object.worldPosition)
  }

  const fixedRotation = Transforms.computeTemeToPseudoFixedMatrix(time, _scratchFixedRotation)
  if (!(fixedRotation instanceof Matrix3)) {
    return toVectorArray(object.worldPosition)
  }

  return toVectorArray(Matrix3.multiplyByVector(fixedRotation, object.worldPosition, _scratchPosition))
}

function resolveOrientationQuat(object) {
  if (!(object?.localToWorldTransform instanceof Matrix4)) {
    return null
  }
  const rotation = Matrix4.getMatrix3(object.localToWorldTransform, _scratchOrientation)
  const quaternion = Quaternion.fromRotationMatrix(rotation, _scratchQuaternion)
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w]
}

function serializeVelocity(value) {
  return value instanceof Cartesian3 ? [value.x, value.y, value.z] : null
}

function serializeObjectState(object) {
  const state = {}

  if (Number.isFinite(object?.latitude)) state.latitudeDeg = object.latitude
  if (Number.isFinite(object?.longitude)) state.longitudeDeg = object.longitude
  if (Number.isFinite(object?.altitude)) state.altitudeMeters = object.altitude
  if (Number.isFinite(object?.heading)) state.headingDeg = object.heading
  if (Number.isFinite(object?.az)) state.azDeg = object.az
  if (Number.isFinite(object?.el)) state.elDeg = object.el
  if (Number.isFinite(object?.roll)) state.rollDeg = object.roll
  if (Number.isFinite(object?.tip)) state.tipDeg = object.tip
  if (Number.isFinite(object?.tilt)) state.tiltDeg = object.tilt
  if (Number.isFinite(object?.zoomLevel)) state.zoomLevel = object.zoomLevel
  if (Number.isFinite(object?.x_fov)) state.xFovDeg = object.x_fov
  if (Number.isFinite(object?.y_fov)) state.yFovDeg = object.y_fov
  if (typeof object?.trackMode === 'string') state.trackMode = object.trackMode
  if ('trackObject' in (object ?? {})) {
    state.trackTarget = object.trackObject?.name ?? null
  }
  if (typeof object?.active === 'boolean') state.active = object.active
  if (Number.isFinite(object?.beamLength)) state.beamLengthMeters = object.beamLength
  if (typeof object?.isColliding === 'boolean') state.isColliding = object.isColliding
  if (typeof object?.hasWaypointRoute === 'boolean') state.hasWaypointRoute = object.hasWaypointRoute
  if (Number.isFinite(object?.collisionRadius)) state.collisionRadiusMeters = object.collisionRadius

  const velocityNed = serializeVelocity(object?.velocityNed)
  if (velocityNed) state.velocityNed = velocityNed
  const accelerationNed = serializeVelocity(object?.accelerationNed)
  if (accelerationNed) state.accelerationNed = accelerationNed

  return state
}

function serializeSensor(sensor) {
  return {
    name: sensor?.name ?? null,
    type: sensor?.type ?? sensor?.constructor?.name ?? 'Unknown',
    zoomLevel: Number.isFinite(sensor?.zoomLevel) ? sensor.zoomLevel : null,
    xFovDeg: Number.isFinite(sensor?.x_fov) ? sensor.x_fov : null,
    yFovDeg: Number.isFinite(sensor?.y_fov) ? sensor.y_fov : null,
    active: typeof sensor?.active === 'boolean' ? sensor.active : null,
    beamLengthMeters: Number.isFinite(sensor?.beamLength) ? sensor.beamLength : null,
    isColliding: typeof sensor?.isColliding === 'boolean' ? sensor.isColliding : null
  }
}

function serializeObservatory(observatory, time) {
  const site = observatory?.site
  const gimbal = observatory?.gimbal
  const fsm = observatory?.fsm
  const sensors = Array.isArray(observatory?.sensors) ? observatory.sensors : []
  const targetPosition = gimbal?.trackObject ? resolvePositionEcef(gimbal.trackObject, time) : null
  const sitePosition = resolvePositionEcef(site, time)
  let rangeToTargetMeters = null
  if (Array.isArray(sitePosition) && Array.isArray(targetPosition)) {
    rangeToTargetMeters = Cartesian3.distance(
      new Cartesian3(sitePosition[0], sitePosition[1], sitePosition[2]),
      new Cartesian3(targetPosition[0], targetPosition[1], targetPosition[2])
    )
  }

  return {
    name: observatory?.name ?? site?.name ?? null,
    siteName: site?.name ?? null,
    sitePositionEcef: sitePosition,
    gimbal: {
      name: gimbal?.name ?? null,
      azDeg: Number.isFinite(gimbal?.az) ? gimbal.az : null,
      elDeg: Number.isFinite(gimbal?.el) ? gimbal.el : null,
      rollDeg: Number.isFinite(gimbal?.roll) ? gimbal.roll : null,
      trackMode: gimbal?.trackMode ?? null,
      trackTarget: gimbal?.trackObject?.name ?? null,
      rangeToTargetMeters: Number.isFinite(rangeToTargetMeters) ? rangeToTargetMeters : null
    },
    fsm: fsm ? {
      name: fsm?.name ?? null,
      tipDeg: Number.isFinite(fsm?.tip) ? fsm.tip : null,
      tiltDeg: Number.isFinite(fsm?.tilt) ? fsm.tilt : null
    } : null,
    sensors: sensors.map((sensor) => serializeSensor(sensor))
  }
}

/**
 * Build the status block used by runtime snapshots and status endpoints.
 *
 * @param {object} options Status inputs.
 * @returns {object} Serializable runtime status.
 */
export function buildRuntimeStatus({ state, scenarioId, clock, lastError }) {
  return {
    state,
    scenarioId: scenarioId ?? null,
    simTimeIso: julianDateToIso(clock?.currentTime),
    startTimeIso: julianDateToIso(clock?.startTime),
    endTimeIso: julianDateToIso(clock?.stopTime),
    multiplier: Number.isFinite(Number(clock?.multiplier)) ? Number(clock.multiplier) : null,
    clockStep: clockStepToLabel(clock?.clockStep),
    clockRange: clockRangeToLabel(clock?.clockRange),
    lastError: lastError || null
  }
}

/**
 * Build a serializable snapshot from a runtime, scenario, and Universe.
 *
 * @param {object} options Snapshot inputs.
 * @returns {object} Serializable runtime snapshot.
 */
export function buildRuntimeSnapshot({
  runtimeId,
  state,
  scenario,
  clock,
  universe,
  lastError,
  sync,
  sessions,
  runtime = {}
}) {
  const status = buildRuntimeStatus({
    state,
    scenarioId: scenario?.descriptor?.id,
    clock,
    lastError
  })
  const currentTime = clock?.currentTime instanceof JulianDate ? clock.currentTime : JulianDate.now()
  const objects = Object.values(universe?.objects ?? {}).map((object) => {
    return {
      name: object?.name ?? null,
      type: object?.type ?? object?.constructor?.name ?? 'Unknown',
      referenceFrame: referenceFrameToLabel(object?.referenceFrame),
      positionEcef: resolvePositionEcef(object, currentTime),
      orientationQuat: resolveOrientationQuat(object),
      state: serializeObjectState(object)
    }
  })
  const observatories = Array.isArray(universe?._observatories)
    ? universe._observatories.map((observatory) => serializeObservatory(observatory, currentTime))
    : []

  return {
    runtimeId,
    status,
    scenario: scenario?.descriptor ?? null,
    runtime,
    sync: {
      mode: sync?.mode ?? 'event_log',
      scenarioGeneration: Number(sync?.scenarioGeneration) || 0,
      lastEventSequence: Number(sync?.lastEventSequence) || 0
    },
    sessions: sessions ?? null,
    objects,
    observatories
  }
}
