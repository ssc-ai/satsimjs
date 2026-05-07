import { booleanOr } from '../../utils.js'
import defineCommand from '../defineCommand.js'
import { getCommandSchema } from '../schemas.js'
import { commandError, requireSensor } from '../targetResolvers.js'

function runtimeMetadata(command) {
  return command.__runtimeSession ? { __runtimeSession: command.__runtimeSession } : {}
}

function normalizeSetSensorZoom(command) {
  return {
    type: command.type,
    observer: command.observer,
    sensor: command.sensor ?? command.sensor_name,
    zoomLevel: Number(command.zoomLevel ?? command.zoom_level),
    ...runtimeMetadata(command)
  }
}

function normalizeStepSensorZoom(command) {
  return {
    type: command.type,
    observer: command.observer,
    sensor: command.sensor ?? command.sensor_name,
    deltaZoomLevel: Number(command.deltaZoomLevel ?? command.delta_zoom_level),
    ...runtimeMetadata(command)
  }
}

function normalizeDirectedEnergy(command) {
  return {
    type: command.type,
    observer: command.observer,
    device: command.device ?? command.sensor ?? command.sensor_name,
    active: command.active,
    ...runtimeMetadata(command)
  }
}

export const sensorCommands = [
  defineCommand({
    type: 'setSensorZoom',
    aliases: ['set_sensor_zoom'],
    schema: getCommandSchema('setSensorZoom'),
    normalize: normalizeSetSensorZoom,
    resolve: requireSensor,
    validate(command, context, sensor) {
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
    execute(command, context, sensor) {
      sensor.setZoomLevel(command.zoomLevel)
    }
  }),
  defineCommand({
    type: 'stepSensorZoom',
    aliases: ['step_sensor_zoom'],
    schema: getCommandSchema('stepSensorZoom'),
    normalize: normalizeStepSensorZoom,
    resolve: requireSensor,
    validate(command, context, sensor) {
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
    execute(command, context, sensor) {
      sensor.stepZoomLevel(command.deltaZoomLevel)
    }
  }),
  defineCommand({
    type: 'setDirectedEnergyActive',
    aliases: ['set_directed_energy_active'],
    schema: getCommandSchema('setDirectedEnergyActive'),
    normalize: normalizeDirectedEnergy,
    resolve: requireSensor,
    validate(command, context, payload) {
      if (payload.type !== 'Laser') {
        commandError(command, `Payload '${payload.name}' is not a directed-energy device.`, {
          code: 'COMMAND_DIRECTED_ENERGY_NOT_FOUND',
          statusCode: 409
        })
      }
    },
    execute(command, context, payload) {
      payload.active = booleanOr(command.active, false)
    }
  })
]
