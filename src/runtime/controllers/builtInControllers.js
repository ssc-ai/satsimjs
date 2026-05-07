import { getRuntimeCommandSchema } from '../../engine/command/index.js'
import {
  commandError,
  findObservatoryByName,
  findObservatorySensor,
  requireFsm,
  requireGimbal,
  requireSensor
} from '../../engine/command/targetResolvers.js'
import { clamp } from '../../engine/utils.js'
import ControllerRegistry from './ControllerRegistry.js'

function withRuntimeSession(command, session) {
  if (!session) return command
  return {
    ...command,
    __runtimeSession: session
  }
}

function cloneLeaseMap(leases) {
  const out = new Map()
  for (const [key, lease] of leases.entries()) {
    out.set(key, {
      ...lease,
      ...(lease.axes ? { axes: { ...lease.axes } } : {})
    })
  }
  return out
}

function collectNumericAxes(source) {
  const out = {}
  Object.entries(source ?? {}).forEach(([axisName, rawValue]) => {
    const axis = String(axisName).trim()
    const value = Number(rawValue)
    if (axis && Number.isFinite(value)) {
      out[axis] = value
    }
  })
  return out
}

function hasNonZeroAxisRate(axes) {
  return Object.values(axes ?? {}).some((value) => Number(value) !== 0)
}

function normalizeAxisRateCommand(command) {
  return {
    type: command.type,
    observer: command.observer,
    axes: collectNumericAxes(command.axes),
    ...(command.__runtimeSession ? { __runtimeSession: command.__runtimeSession } : {})
  }
}

function leaseExpiryMs(context) {
  const nowMs = Number.isFinite(Number(context.nowMs)) ? Number(context.nowMs) : Date.now()
  return nowMs + Math.max(1, Number(context.analogLeaseMs) || 1)
}

function commandTypeSet(types = []) {
  return new Set(types.map((type) => String(type).trim().toLowerCase()))
}

class AxisController {
  constructor({
    name,
    commandType,
    aliases,
    outputType,
    axisNames,
    cancelCommandTypes,
    resolve,
    findTarget
  }) {
    this.name = name
    this._outputType = outputType
    this._axisNames = axisNames
    this._findTarget = findTarget
    this.observedCommandTypes = commandTypeSet(cancelCommandTypes)
    this._leases = new Map()
    this.commandDefinitions = [
      {
        type: commandType,
        aliases,
        schema: getRuntimeCommandSchema(commandType),
        normalize: normalizeAxisRateCommand,
        resolve,
        apply: (command, context, target, state) => this.applyAxisRateCommand(command, context, target, state)
      }
    ]
  }

  get leases() {
    return this._leases
  }

  cloneState() {
    return {
      leases: cloneLeaseMap(this._leases)
    }
  }

  commit(state) {
    this._leases = state.leases
  }

  clear() {
    this._leases.clear()
  }

  leaseKey(observer) {
    return String(observer || '').trim()
  }

  holdCommand(observer, target, session) {
    const axes = {}
    this._axisNames.forEach((axisName) => {
      const value = Number(target?.[axisName])
      if (Number.isFinite(value)) {
        axes[axisName] = value
      }
    })
    if (Object.keys(axes).length === 0) {
      return []
    }
    return [withRuntimeSession({
      type: this._outputType,
      observer,
      axes
    }, session)]
  }

  applyAxisRateCommand(command, context, target, state) {
    const key = this.leaseKey(command.observer)
    if (!key) return []

    if (!hasNonZeroAxisRate(command.axes)) {
      const lease = state.leases.get(key)
      const hadLease = state.leases.delete(key)
      return hadLease ? this.holdCommand(command.observer, target, lease?.session ?? context.session) : []
    }

    state.leases.set(key, {
      observer: command.observer,
      axes: { ...(command.axes ?? {}) },
      expiresAtMs: leaseExpiryMs(context),
      session: context.session
    })
    return []
  }

  observeCommand(command, context, state) {
    const key = this.leaseKey(command?.observer)
    if (key) {
      state.leases.delete(key)
    }
    return []
  }

  tick({ universe, deltaSec } = {}) {
    if (!(deltaSec > 0) || !universe) {
      return []
    }

    const commands = []
    for (const lease of this._leases.values()) {
      const target = this._findTarget(universe, lease.observer)
      if (!target) continue

      const axes = {}
      for (const [axisName, rawRate] of Object.entries(lease.axes ?? {})) {
        const current = Number(target?.[axisName])
        const rate = Number(rawRate)
        if (!Number.isFinite(current) || !Number.isFinite(rate) || rate === 0) continue
        axes[axisName] = current + (rate * deltaSec)
      }
      if (Object.keys(axes).length > 0) {
        commands.push(withRuntimeSession({
          type: this._outputType,
          observer: lease.observer,
          axes
        }, lease.session))
      }
    }
    return commands
  }

  expire({ universe, nowMs } = {}) {
    if (!universe) {
      return []
    }

    const commands = []
    for (const [key, lease] of this._leases.entries()) {
      if (Number(nowMs) < Number(lease.expiresAtMs)) continue
      this._leases.delete(key)
      const target = this._findTarget(universe, lease.observer)
      commands.push(...this.holdCommand(lease.observer, target, lease.session))
    }
    return commands
  }

  stopAll({ universe } = {}) {
    if (!universe) {
      this.clear()
      return []
    }

    const commands = []
    for (const lease of this._leases.values()) {
      const target = this._findTarget(universe, lease.observer)
      commands.push(...this.holdCommand(lease.observer, target, lease.session))
    }
    this.clear()
    return commands
  }
}

export class GimbalController extends AxisController {
  constructor() {
    super({
      name: 'gimbal',
      commandType: 'setGimbalAxisRates',
      aliases: ['set_gimbal_axis_rates'],
      outputType: 'setGimbalAxes',
      axisNames: ['az', 'el'],
      cancelCommandTypes: ['trackObject', 'setGimbalAxes', 'stepGimbalAxes'],
      resolve: requireGimbal,
      findTarget(universe, observer) {
        return findObservatoryByName(universe, observer)?.gimbal
      }
    })
  }
}

export class FsmController extends AxisController {
  constructor() {
    super({
      name: 'fsm',
      commandType: 'setFsmAxisRates',
      aliases: ['set_fsm_axis_rates'],
      outputType: 'setFsmAxes',
      axisNames: ['tip', 'tilt'],
      cancelCommandTypes: ['setFsmAxes', 'stepFsmAxes'],
      resolve: requireFsm,
      findTarget(universe, observer) {
        return findObservatoryByName(universe, observer)?.fsm
      }
    })
  }
}

function normalizeZoomRateCommand(command) {
  return {
    type: command.type,
    observer: command.observer,
    sensor: command.sensor ?? command.sensor_name,
    zoomRateLevelPerSec: Number(command.zoomRateLevelPerSec ?? command.zoom_rate_level_per_sec),
    ...(command.__runtimeSession ? { __runtimeSession: command.__runtimeSession } : {})
  }
}

export class SensorZoomController {
  constructor() {
    this.name = 'sensorZoom'
    this._leases = new Map()
    this.observedCommandTypes = commandTypeSet(['setSensorZoom', 'stepSensorZoom'])
    this.commandDefinitions = [
      {
        type: 'setSensorZoomRate',
        aliases: ['set_sensor_zoom_rate'],
        schema: getRuntimeCommandSchema('setSensorZoomRate'),
        normalize: normalizeZoomRateCommand,
        resolve: requireSensor,
        validate(command, context, sensor) {
          if (!Number.isFinite(Number(sensor?.zoomLevel))) {
            commandError(command, `Sensor '${sensor?.name}' cannot use zoom-rate control.`, {
              code: 'COMMAND_SENSOR_ZOOM_UNSUPPORTED',
              statusCode: 409
            })
          }
        },
        apply: (command, context, sensor, state) => this.applyZoomRateCommand(command, context, sensor, state)
      }
    ]
  }

  get leases() {
    return this._leases
  }

  cloneState() {
    return {
      leases: cloneLeaseMap(this._leases)
    }
  }

  commit(state) {
    this._leases = state.leases
  }

  clear() {
    this._leases.clear()
  }

  leaseKey(observer, sensor) {
    return `${String(observer || '').trim()}::${String(sensor || '').trim()}`
  }

  holdCommand(observer, sensor, session) {
    const zoomLevel = Number(sensor?.zoomLevel)
    if (!sensor || !Number.isFinite(zoomLevel)) {
      return []
    }
    return [withRuntimeSession({
      type: 'setSensorZoom',
      observer,
      sensor: sensor.name,
      zoomLevel
    }, session)]
  }

  applyZoomRateCommand(command, context, sensor, state) {
    const sensorName = sensor?.name ?? command.sensor
    const key = this.leaseKey(command.observer, sensorName)
    if (Number(command.zoomRateLevelPerSec) === 0) {
      const lease = state.leases.get(key)
      const hadLease = state.leases.delete(key)
      return hadLease ? this.holdCommand(command.observer, sensor, lease?.session ?? context.session) : []
    }

    state.leases.set(key, {
      observer: command.observer,
      sensor: sensorName,
      zoomRateLevelPerSec: Number(command.zoomRateLevelPerSec) || 0,
      expiresAtMs: leaseExpiryMs(context),
      session: context.session
    })
    return []
  }

  observeCommand(command, context, state, sensor) {
    const resolvedSensor = sensor ?? this.findSensor(context.universe, command?.observer, command?.sensor ?? command?.sensor_name)
    const sensorName = resolvedSensor?.name ?? command?.sensor ?? command?.sensor_name
    const key = this.leaseKey(command?.observer, sensorName)
    if (key) {
      state.leases.delete(key)
    }
    return []
  }

  findSensor(universe, observer, sensor) {
    const observatory = findObservatoryByName(universe, observer)
    return findObservatorySensor(observatory, sensor)
  }

  tick({ universe, deltaSec } = {}) {
    if (!(deltaSec > 0) || !universe) {
      return []
    }

    const commands = []
    for (const lease of this._leases.values()) {
      const sensor = this.findSensor(universe, lease.observer, lease.sensor)
      const currentZoomLevel = Number(sensor?.zoomLevel)
      const zoomRateLevelPerSec = Number(lease.zoomRateLevelPerSec)
      if (!sensor || !Number.isFinite(currentZoomLevel) || !Number.isFinite(zoomRateLevelPerSec) || zoomRateLevelPerSec === 0) {
        continue
      }
      commands.push(withRuntimeSession({
        type: 'setSensorZoom',
        observer: lease.observer,
        sensor: sensor.name,
        zoomLevel: clamp(currentZoomLevel + (zoomRateLevelPerSec * deltaSec), 0, 1)
      }, lease.session))
    }
    return commands
  }

  expire({ universe, nowMs } = {}) {
    if (!universe) {
      return []
    }

    const commands = []
    for (const [key, lease] of this._leases.entries()) {
      if (Number(nowMs) < Number(lease.expiresAtMs)) continue
      this._leases.delete(key)
      commands.push(...this.holdCommand(
        lease.observer,
        this.findSensor(universe, lease.observer, lease.sensor),
        lease.session
      ))
    }
    return commands
  }

  stopAll({ universe } = {}) {
    if (!universe) {
      this.clear()
      return []
    }

    const commands = []
    for (const lease of this._leases.values()) {
      commands.push(...this.holdCommand(
        lease.observer,
        this.findSensor(universe, lease.observer, lease.sensor),
        lease.session
      ))
    }
    this.clear()
    return commands
  }
}

export function registerBuiltInControllers(registry) {
  registry.register(new GimbalController())
  registry.register(new FsmController())
  registry.register(new SensorZoomController())
  return registry
}

export function createDefaultControllerRegistry() {
  return registerBuiltInControllers(new ControllerRegistry())
}
