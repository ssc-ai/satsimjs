import { Cartesian3, defined } from 'cesium'

import AirVehicle from '../objects/AirVehicle.js'
import { getObservatorySensors } from '../objects/observatoryUtils.js'
import { numberOr, toCartesian3OrUndefined } from '../utils.js'
import CommandError from './CommandError.js'

export function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key)
}

export function commandError(command, message, {
  code = 'COMMAND_INVALID',
  statusCode = 400
} = {}) {
  throw new CommandError(message, {
    type: command?.type,
    code,
    statusCode
  })
}

export function requireUniverse(context, command) {
  if (!context?.universe) {
    commandError(command, 'Command requires a universe.', {
      code: 'COMMAND_CONTEXT_MISSING',
      statusCode: 409
    })
  }
  return context.universe
}

export function resolveVelocityNedFromCommand(command, fallbackHeadingDeg = 0) {
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

export function resolveAccelerationNedFromCommand(command) {
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

export function resolveEventObjectName(command) {
  return command.object ?? command.vehicle ?? command.name ?? command.target
}

export function resolveAirVehicleForCommand(universe, command) {
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

export function findObservatoryByName(universe, observerName) {
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

export function findObservatorySensor(observatory, sensorName) {
  const sensors = getObservatorySensors(observatory)
  const normalizedSensorName = String(sensorName ?? '').trim()
  if (!normalizedSensorName) {
    return observatory?.sensor ?? sensors[0]
  }
  return sensors.find((sensor) => sensor?.name === normalizedSensorName)
}

export function requireObserver(command, context) {
  const universe = requireUniverse(context, command)
  const observerName = command.observer
  const observatory = findObservatoryByName(universe, observerName)
  if (!observatory) {
    commandError(command, `Unknown observatory: ${observerName}`, {
      code: 'COMMAND_OBSERVATORY_NOT_FOUND',
      statusCode: 409
    })
  }
  return observatory
}

export function requireGimbal(command, context) {
  const observatory = requireObserver(command, context)
  if (!observatory?.gimbal) {
    commandError(command, `Observatory '${command.observer}' has no gimbal.`, {
      code: 'COMMAND_GIMBAL_NOT_FOUND',
      statusCode: 409
    })
  }
  return observatory.gimbal
}

export function requireFsm(command, context) {
  const observatory = requireObserver(command, context)
  if (!observatory?.fsm) {
    commandError(command, `Observatory '${command.observer}' has no fast steering mirror.`, {
      code: 'COMMAND_FSM_NOT_FOUND',
      statusCode: 409
    })
  }
  return observatory.fsm
}

export function requireSensor(command, context) {
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

export function requireAirVehicle(command, context) {
  const universe = requireUniverse(context, command)
  const objectName = resolveEventObjectName(command)
  const target = resolveAirVehicleForCommand(universe, command)
  if (!target) {
    commandError(command, `Unknown air vehicle: ${objectName}`, {
      code: 'COMMAND_AIR_VEHICLE_NOT_FOUND',
      statusCode: 409
    })
  }
  return target
}
