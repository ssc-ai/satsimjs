import { Cartesian3, defined } from 'cesium'

import AirVehicle from '../objects/AirVehicle.js'
import { getObservatorySensors } from '../objects/observatoryUtils.js'
import { booleanOr, numberOr, toCartesian3OrUndefined } from '../utils.js'
import CommandBus from './CommandBus.js'
import CommandError from './CommandError.js'

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key)
}

function commandError(command, message, {
  code = 'COMMAND_INVALID',
  statusCode = 400
} = {}) {
  throw new CommandError(message, {
    type: command?.type,
    code,
    statusCode
  })
}

function requireUniverse(context, command) {
  if (!context?.universe) {
    commandError(command, 'Command requires a universe.', {
      code: 'COMMAND_CONTEXT_MISSING',
      statusCode: 409
    })
  }
  return context.universe
}

function resolveVelocityNedFromCommand(command, fallbackHeadingDeg = 0) {
  const vNedInput = command.velocity_ned ?? command.velocityNed ?? command.velocity
  if (defined(vNedInput)) {
    return toCartesian3OrUndefined(vNedInput)
  }

  const vEnuInput = command.velocity_enu ?? command.velocityEnu
  if (defined(vEnuInput)) {
    const vEnu = toCartesian3OrUndefined(vEnuInput)
    if (!defined(vEnu)) return undefined
    return new Cartesian3(vEnu.y, vEnu.x, -vEnu.z)
  }

  if (
    defined(command.speed) ||
    defined(command.horizontal_speed) ||
    defined(command.ground_speed) ||
    defined(command.vertical_speed) ||
    defined(command.climb_rate)
  ) {
    const speed = numberOr(command.speed ?? command.horizontal_speed ?? command.ground_speed)
    const headingDeg = numberOr(command.heading ?? command.direction, fallbackHeadingDeg)
    const headingRad = headingDeg * Math.PI / 180
    const verticalSpeed = numberOr(command.vertical_speed ?? command.climb_rate)
    return new Cartesian3(
      speed * Math.cos(headingRad),
      speed * Math.sin(headingRad),
      -verticalSpeed
    )
  }

  return undefined
}

function resolveAccelerationNedFromCommand(command) {
  const aNedInput = command.acceleration_ned ?? command.accelerationNed ?? command.acceleration
  if (defined(aNedInput)) {
    return toCartesian3OrUndefined(aNedInput)
  }

  const aEnuInput = command.acceleration_enu ?? command.accelerationEnu
  if (defined(aEnuInput)) {
    const aEnu = toCartesian3OrUndefined(aEnuInput)
    if (!defined(aEnu)) return undefined
    return new Cartesian3(aEnu.y, aEnu.x, -aEnu.z)
  }

  return undefined
}

function resolveEventObjectName(command) {
  return command.object ?? command.vehicle ?? command.name ?? command.target
}

function resolveAirVehicleForCommand(universe, command) {
  const objectName = resolveEventObjectName(command)
  if (!defined(objectName) || !universe.getObject) return undefined
  const object = universe.getObject(objectName)
  if (!defined(object)) return undefined
  if (object instanceof AirVehicle) return object
  if ('velocityNed' in object || 'accelerationNed' in object || 'heading' in object) {
    return object
  }
  return undefined
}

function findObservatoryByName(universe, observerName) {
  if (!defined(observerName)) return undefined
  const observatories = universe?._observatories || []
  for (let i = 0; i < observatories.length; i++) {
    const observatory = observatories[i]
    if (observatory?.site?.name === observerName || observatory?.name === observerName) {
      return observatory
    }
  }
  return undefined
}

function findObservatorySensor(observatory, sensorName) {
  const sensors = getObservatorySensors(observatory)
  const normalizedSensorName = String(sensorName ?? '').trim()
  if (!normalizedSensorName) {
    return observatory?.sensor ?? sensors[0]
  }
  return sensors.find((sensor) => sensor?.name === normalizedSensorName)
}

function collectAxisValues(...sources) {
  const out = {}
  sources.forEach((source) => {
    if (!defined(source) || typeof source !== 'object' || Array.isArray(source)) {
      return
    }
    Object.keys(source).forEach((axisName) => {
      const axis = String(axisName).trim()
      const value = Number(source[axisName])
      if (axis && Number.isFinite(value)) {
        out[axis] = value
      }
    })
  })
  return out
}

function requireAxes(command) {
  const axes = command.axes ?? {}
  if (!axes || typeof axes !== 'object' || Array.isArray(axes) || Object.keys(axes).length === 0) {
    commandError(command, `Command '${command.type}' requires at least one finite axis value.`, {
      code: 'COMMAND_AXES_REQUIRED',
      statusCode: 400
    })
  }
  return axes
}

function applyAxisCommand(controller, axisValues, { mode, getOptions = undefined } = {}) {
  Object.keys(axisValues).forEach((axisName) => {
    const axis = String(axisName)
    const valueDeg = Number(axisValues[axisName])
    if (!Number.isFinite(valueDeg)) return

    if (mode === 'step') {
      if (valueDeg === 0) return
      const currentDeg = numberOr(controller[axis], 0)
      if (typeof controller.stepAxisTarget === 'function') {
        controller.stepAxisTarget(axis, valueDeg, currentDeg, getOptions?.(axis))
      } else if (hasOwn(controller, axis)) {
        controller[axis] = currentDeg + valueDeg
      }
      return
    }

    if (typeof controller.setAxisTarget === 'function') {
      controller.setAxisTarget(axis, valueDeg, getOptions?.(axis))
    } else if (hasOwn(controller, axis)) {
      controller[axis] = valueDeg
    }
  })
}

function getGimbalAxisTargetOptions(axis) {
  if (String(axis).toLowerCase() !== 'az') {
    return undefined
  }
  return {
    normalizeTargetDeg: (azDeg) => {
      let wrapped = Number(azDeg) % 360.0
      if (wrapped < 0) wrapped += 360.0
      return wrapped
    }
  }
}

function requireObserver(command, context) {
  const universe = requireUniverse(context, command)
  const observerName = command.observer
  if (!observerName) {
    commandError(command, `Command '${command.type}' requires observer.`, {
      code: 'COMMAND_OBSERVER_REQUIRED',
      statusCode: 400
    })
  }
  const observatory = findObservatoryByName(universe, observerName)
  if (!observatory) {
    commandError(command, `Unknown observatory: ${observerName}`, {
      code: 'COMMAND_OBSERVATORY_NOT_FOUND',
      statusCode: 409
    })
  }
  return observatory
}

function requireGimbal(command, context) {
  const observatory = requireObserver(command, context)
  if (!observatory?.gimbal) {
    commandError(command, `Observatory '${command.observer}' has no gimbal.`, {
      code: 'COMMAND_GIMBAL_NOT_FOUND',
      statusCode: 409
    })
  }
  return observatory.gimbal
}

function requireFsm(command, context) {
  const observatory = requireObserver(command, context)
  if (!observatory?.fsm) {
    commandError(command, `Observatory '${command.observer}' has no fast steering mirror.`, {
      code: 'COMMAND_FSM_NOT_FOUND',
      statusCode: 409
    })
  }
  return observatory.fsm
}

function requireSensor(command, context) {
  const observatory = requireObserver(command, context)
  const sensorName = command.sensor ?? command.sensor_name ?? command.device
  const sensor = findObservatorySensor(observatory, sensorName)
  if (!sensor) {
    commandError(command, `Unknown sensor for observatory '${command.observer}'.`, {
      code: 'COMMAND_SENSOR_NOT_FOUND',
      statusCode: 409
    })
  }
  return sensor
}

function requireAirVehicle(command, context) {
  const universe = requireUniverse(context, command)
  const objectName = resolveEventObjectName(command)
  if (!defined(objectName)) {
    commandError(command, `Command '${command.type}' requires object.`, {
      code: 'COMMAND_OBJECT_REQUIRED',
      statusCode: 400
    })
  }
  const target = resolveAirVehicleForCommand(universe, command)
  if (!target) {
    commandError(command, `Unknown air vehicle: ${objectName}`, {
      code: 'COMMAND_AIR_VEHICLE_NOT_FOUND',
      statusCode: 409
    })
  }
  return target
}

function normalizeAxisCommand(command) {
  return {
    ...command,
    axes: collectAxisValues(command.axes)
  }
}

function normalizeStepAxisCommand(command) {
  return {
    ...command,
    axes: collectAxisValues(command.axes ?? command.deltas, command.deltas)
  }
}

function validateAxisCommand(command, context, resolveController) {
  resolveController(command, context)
  requireAxes(command)
}

function stopGimbalTracking(gimbal) {
  gimbal.trackObject = null
  gimbal.trackMode = 'fixed'
}

function syncAndStopGimbalTracking(gimbal) {
  const wasTracking = (gimbal.trackMode === 'rate') || defined(gimbal.trackObject)
  stopGimbalTracking(gimbal)
  if (wasTracking) {
    gimbal.clearAxisTargets?.(true)
  }
}

function createAxisCommand({
  type,
  aliases,
  mode,
  resolveController,
  getOptions = undefined,
  beforeExecute = undefined
}) {
  return {
    type,
    aliases,
    normalize: mode === 'step' ? normalizeStepAxisCommand : normalizeAxisCommand,
    validate(command, context) {
      validateAxisCommand(command, context, resolveController)
    },
    execute(command, context) {
      const controller = resolveController(command, context)
      beforeExecute?.(controller)
      applyAxisCommand(controller, command.axes, { mode, getOptions })
    }
  }
}

function applyAirVehicleManeuver(command, context) {
  const universe = requireUniverse(context, command)
  const target = requireAirVehicle(command, context)
  const time = context.time

  if (typeof target.update === 'function') {
    target.update(time, universe)
  }

  const velocityNed = resolveVelocityNedFromCommand(command, target.heading ?? 0)
  if (defined(velocityNed)) {
    target.velocityNed = velocityNed
  }

  const accelerationNed = resolveAccelerationNedFromCommand(command)
  if (defined(accelerationNed)) {
    target.accelerationNed = accelerationNed
  }

  if (hasOwn(command, 'heading') || hasOwn(command, 'direction')) {
    target.heading = numberOr(command.heading ?? command.direction)
  }
}

function validateAirVehicleManeuver(command, context) {
  requireAirVehicle(command, context)
  if (
    !defined(resolveVelocityNedFromCommand(command, 0)) &&
    !defined(resolveAccelerationNedFromCommand(command)) &&
    !hasOwn(command, 'heading') &&
    !hasOwn(command, 'direction')
  ) {
    commandError(command, `Command '${command.type}' requires a velocity, acceleration, or heading change.`, {
      code: 'COMMAND_MANEUVER_EMPTY',
      statusCode: 400
    })
  }
}

function createAirVehicleChangeCommand({ type, aliases, validateChange }) {
  return {
    type,
    aliases,
    validate(command, context) {
      requireAirVehicle(command, context)
      validateChange(command)
    },
    execute: applyAirVehicleManeuver
  }
}

const builtInCommands = [
  {
    type: 'trackObject',
    aliases: ['track_object'],
    validate(command, context) {
      const universe = requireUniverse(context, command)
      requireGimbal(command, context)
      if (!hasOwn(command, 'target')) {
        commandError(command, "Command 'trackObject' requires target; use null to clear tracking.", {
          code: 'COMMAND_TARGET_REQUIRED',
          statusCode: 400
        })
      }
      if (command.target !== null && command.target !== undefined && !universe.getObject?.(command.target)) {
        commandError(command, `Unknown target object: ${command.target}`, {
          code: 'COMMAND_TARGET_NOT_FOUND',
          statusCode: 409
        })
      }
    },
    execute(command, context) {
      const universe = requireUniverse(context, command)
      const gimbal = requireGimbal(command, context)
      const targetName = command.target
      if (targetName === null || targetName === undefined) {
        gimbal.trackObject = null
        gimbal.trackMode = 'fixed'
        gimbal.clearAxisTargets?.(true)
        return
      }
      gimbal.trackMode = 'rate'
      gimbal.trackObject = universe.getObject(targetName)
    }
  },
  createAxisCommand({
    type: 'stepGimbalAxes',
    aliases: ['step_gimbal_axes'],
    mode: 'step',
    resolveController: requireGimbal,
    getOptions: getGimbalAxisTargetOptions,
    beforeExecute: syncAndStopGimbalTracking
  }),
  createAxisCommand({
    type: 'setGimbalAxes',
    aliases: ['set_gimbal_axes'],
    mode: 'set',
    resolveController: requireGimbal,
    getOptions: getGimbalAxisTargetOptions,
    beforeExecute: stopGimbalTracking
  }),
  createAxisCommand({
    type: 'stepFsmAxes',
    aliases: ['step_fsm_axes'],
    mode: 'step',
    resolveController: requireFsm
  }),
  createAxisCommand({
    type: 'setFsmAxes',
    aliases: ['set_fsm_axes'],
    mode: 'set',
    resolveController: requireFsm
  }),
  {
    type: 'setSensorZoom',
    aliases: ['set_sensor_zoom'],
    normalize(command) {
      return {
        ...command,
        sensor: command.sensor ?? command.sensor_name,
        zoomLevel: Number(command.zoomLevel ?? command.zoom_level)
      }
    },
    validate(command, context) {
      const sensor = requireSensor(command, context)
      if (typeof sensor.setZoomLevel !== 'function') {
        commandError(command, `Sensor '${sensor.name}' cannot set zoom level.`, {
          code: 'COMMAND_SENSOR_ZOOM_UNSUPPORTED',
          statusCode: 409
        })
      }
      if (!Number.isFinite(command.zoomLevel)) {
        commandError(command, "Command 'setSensorZoom' requires finite zoomLevel.", {
          code: 'COMMAND_ZOOM_LEVEL_REQUIRED',
          statusCode: 400
        })
      }
    },
    execute(command, context) {
      requireSensor(command, context).setZoomLevel(command.zoomLevel)
    }
  },
  {
    type: 'stepSensorZoom',
    aliases: ['step_sensor_zoom'],
    normalize(command) {
      return {
        ...command,
        sensor: command.sensor ?? command.sensor_name,
        deltaZoomLevel: Number(command.deltaZoomLevel ?? command.delta_zoom_level)
      }
    },
    validate(command, context) {
      const sensor = requireSensor(command, context)
      if (typeof sensor.stepZoomLevel !== 'function') {
        commandError(command, `Sensor '${sensor.name}' cannot step zoom level.`, {
          code: 'COMMAND_SENSOR_ZOOM_UNSUPPORTED',
          statusCode: 409
        })
      }
      if (!Number.isFinite(command.deltaZoomLevel) || command.deltaZoomLevel === 0) {
        commandError(command, "Command 'stepSensorZoom' requires non-zero finite deltaZoomLevel.", {
          code: 'COMMAND_ZOOM_DELTA_REQUIRED',
          statusCode: 400
        })
      }
    },
    execute(command, context) {
      requireSensor(command, context).stepZoomLevel(command.deltaZoomLevel)
    }
  },
  {
    type: 'setDirectedEnergyActive',
    aliases: ['set_directed_energy_active'],
    normalize(command) {
      return {
        ...command,
        device: command.device ?? command.sensor ?? command.sensor_name
      }
    },
    validate(command, context) {
      const payload = requireSensor(command, context)
      if (payload.type !== 'Laser') {
        commandError(command, `Payload '${payload.name}' is not a directed-energy device.`, {
          code: 'COMMAND_DIRECTED_ENERGY_NOT_FOUND',
          statusCode: 409
        })
      }
      if (!hasOwn(command, 'active')) {
        commandError(command, "Command 'setDirectedEnergyActive' requires active.", {
          code: 'COMMAND_ACTIVE_REQUIRED',
          statusCode: 400
        })
      }
    },
    execute(command, context) {
      requireSensor(command, context).active = booleanOr(command.active, false)
    }
  },
  {
    type: 'airVehicleManeuver',
    aliases: ['air_vehicle_maneuver'],
    validate: validateAirVehicleManeuver,
    execute: applyAirVehicleManeuver
  },
  createAirVehicleChangeCommand({
    type: 'setAirVehicleVelocityNed',
    aliases: ['set_air_vehicle_velocity_ned'],
    validateChange(command) {
      if (!defined(resolveVelocityNedFromCommand(command, 0))) {
        commandError(command, "Command 'setAirVehicleVelocityNed' requires velocity or speed fields.", {
          code: 'COMMAND_VELOCITY_REQUIRED',
          statusCode: 400
        })
      }
    }
  }),
  createAirVehicleChangeCommand({
    type: 'setAirVehicleAccelerationNed',
    aliases: ['set_air_vehicle_acceleration_ned'],
    validateChange(command) {
      if (!defined(resolveAccelerationNedFromCommand(command))) {
        commandError(command, "Command 'setAirVehicleAccelerationNed' requires acceleration fields.", {
          code: 'COMMAND_ACCELERATION_REQUIRED',
          statusCode: 400
        })
      }
    }
  }),
  createAirVehicleChangeCommand({
    type: 'setAirVehicleHeading',
    aliases: ['set_air_vehicle_heading'],
    validateChange(command) {
      const heading = Number(command.heading ?? command.direction)
      if (!Number.isFinite(heading)) {
        commandError(command, "Command 'setAirVehicleHeading' requires finite heading.", {
          code: 'COMMAND_HEADING_REQUIRED',
          statusCode: 400
        })
      }
    }
  })
]

export function registerBuiltInCommands(commandBus) {
  builtInCommands.forEach((command) => commandBus.register(command))
  return commandBus
}

export function createDefaultCommandBus() {
  return registerBuiltInCommands(new CommandBus())
}

export { builtInCommands }
