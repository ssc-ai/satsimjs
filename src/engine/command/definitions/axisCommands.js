import { defined } from 'cesium'

import { numberOr } from '../../utils.js'
import defineCommand from '../defineCommand.js'
import { getCommandSchema } from '../schemas.js'
import {
  commandError,
  hasOwn,
  requireFsm,
  requireGimbal,
  requireUniverse
} from '../targetResolvers.js'

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

function normalizeAxisCommand(command) {
  return {
    type: command.type,
    observer: command.observer,
    axes: collectAxisValues(command.axes),
    ...(command.__runtimeSession ? { __runtimeSession: command.__runtimeSession } : {})
  }
}

function normalizeStepAxisCommand(command) {
  return {
    type: command.type,
    observer: command.observer,
    axes: collectAxisValues(command.axes ?? command.deltas, command.deltas),
    ...(command.__runtimeSession ? { __runtimeSession: command.__runtimeSession } : {})
  }
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

function validateAxisCommand(command) {
  requireAxes(command)
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
  resolve,
  getOptions = undefined,
  beforeExecute = undefined
}) {
  return defineCommand({
    type,
    aliases,
    schema: getCommandSchema(type),
    normalize: mode === 'step' ? normalizeStepAxisCommand : normalizeAxisCommand,
    resolve(command, context) {
      return resolve(command, context)
    },
    validate: validateAxisCommand,
    execute(command, context, controller) {
      beforeExecute?.(controller)
      applyAxisCommand(controller, command.axes, { mode, getOptions })
    }
  })
}

function normalizeTrackObject(command) {
  return {
    type: command.type,
    observer: command.observer,
    target: command.target,
    ...(command.__runtimeSession ? { __runtimeSession: command.__runtimeSession } : {})
  }
}

export const axisCommands = [
  defineCommand({
    type: 'trackObject',
    aliases: ['track_object'],
    schema: getCommandSchema('trackObject'),
    normalize: normalizeTrackObject,
    resolve(command, context) {
      return {
        universe: requireUniverse(context, command),
        gimbal: requireGimbal(command, context)
      }
    },
    validate(command, context, { universe }) {
      if (command.target !== null && command.target !== undefined && !universe.getObject?.(command.target)) {
        commandError(command, `Unknown target object: ${command.target}`, {
          code: 'COMMAND_TARGET_NOT_FOUND',
          statusCode: 409
        })
      }
    },
    execute(command, context, { universe, gimbal }) {
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
  }),
  createAxisCommand({
    type: 'stepGimbalAxes',
    aliases: ['step_gimbal_axes'],
    mode: 'step',
    resolve: requireGimbal,
    getOptions: getGimbalAxisTargetOptions,
    beforeExecute: syncAndStopGimbalTracking
  }),
  createAxisCommand({
    type: 'setGimbalAxes',
    aliases: ['set_gimbal_axes'],
    mode: 'set',
    resolve: requireGimbal,
    getOptions: getGimbalAxisTargetOptions,
    beforeExecute: stopGimbalTracking
  }),
  createAxisCommand({
    type: 'stepFsmAxes',
    aliases: ['step_fsm_axes'],
    mode: 'step',
    resolve: requireFsm
  }),
  createAxisCommand({
    type: 'setFsmAxes',
    aliases: ['set_fsm_axes'],
    mode: 'set',
    resolve: requireFsm
  })
]
