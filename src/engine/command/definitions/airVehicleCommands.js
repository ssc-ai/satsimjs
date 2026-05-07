import { defined } from 'cesium'

import { numberOr } from '../../utils.js'
import defineCommand from '../defineCommand.js'
import { getCommandSchema } from '../schemas.js'
import {
  commandError,
  hasOwn,
  requireAirVehicle,
  requireUniverse,
  resolveAccelerationNedFromCommand,
  resolveEventObjectName,
  resolveVelocityNedFromCommand
} from '../targetResolvers.js'

function runtimeMetadata(command) {
  return command.__runtimeSession ? { __runtimeSession: command.__runtimeSession } : {}
}

function normalizeAirVehicleCommand(command) {
  return {
    type: command.type,
    object: resolveEventObjectName(command),
    velocity_ned: command.velocity_ned ?? command.velocityNed ?? command.velocity,
    velocity_enu: command.velocity_enu ?? command.velocityEnu,
    acceleration_ned: command.acceleration_ned ?? command.accelerationNed ?? command.acceleration,
    acceleration_enu: command.acceleration_enu ?? command.accelerationEnu,
    speed: command.speed ?? command.horizontal_speed ?? command.ground_speed,
    vertical_speed: command.vertical_speed ?? command.climb_rate,
    heading: command.heading ?? command.direction,
    ...runtimeMetadata(command)
  }
}

function resolveAirVehicleCommand(command, context) {
  return {
    universe: requireUniverse(context, command),
    target: requireAirVehicle(command, context)
  }
}

function applyAirVehicleManeuver(command, context, { universe, target }) {
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

  if (hasOwn(command, 'heading')) {
    target.heading = numberOr(command.heading)
  }
}

function validateAirVehicleManeuver(command) {
  if (
    !defined(resolveVelocityNedFromCommand(command, 0)) &&
    !defined(resolveAccelerationNedFromCommand(command)) &&
    !hasOwn(command, 'heading')
  ) {
    commandError(command, `Command '${command.type}' requires a velocity, acceleration, or heading change.`, {
      code: 'COMMAND_MANEUVER_EMPTY',
      statusCode: 400
    })
  }
}

function createAirVehicleChangeCommand({ type, aliases, validateChange }) {
  return defineCommand({
    type,
    aliases,
    schema: getCommandSchema(type),
    normalize: normalizeAirVehicleCommand,
    resolve: resolveAirVehicleCommand,
    validate: validateChange,
    execute: applyAirVehicleManeuver
  })
}

export const airVehicleCommands = [
  defineCommand({
    type: 'airVehicleManeuver',
    aliases: ['air_vehicle_maneuver'],
    schema: getCommandSchema('airVehicleManeuver'),
    normalize: normalizeAirVehicleCommand,
    resolve: resolveAirVehicleCommand,
    validate: validateAirVehicleManeuver,
    execute: applyAirVehicleManeuver
  }),
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
      const heading = Number(command.heading)
      if (!Number.isFinite(heading)) {
        commandError(command, "Command 'setAirVehicleHeading' requires finite heading.", {
          code: 'COMMAND_HEADING_REQUIRED',
          statusCode: 400
        })
      }
    }
  })
]
