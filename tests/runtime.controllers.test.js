import { createDefaultCommandBus } from '../src/engine/command/index.js'
import { applyIau2006XysDataPatch } from '../src/engine/cesium/Iau2006XysDataLocal.js'
import {
  ControllerRegistry,
  createDefaultControllerRegistry,
  GimbalController,
  SensorZoomController
} from '../src/runtime/index.js'
import SimulationRuntime from '../src/runtime/SimulationRuntime.js'

beforeAll(() => {
  applyIau2006XysDataPatch()
})

function createScenarioConfig({ includeFsm = true } = {}) {
  return {
    simulationParameters: {
      start_time: '2026-04-03T16:00:00Z',
      current_time: '2026-04-03T16:00:00Z',
      end_time: '2026-04-03T16:10:00Z',
      time_step: 1,
      clock_step: 'tick_dependent',
      clock_range: 'loop_stop'
    },
    objects: [
      {
        type: 'GroundEOObservatory',
        name: 'OBS-1',
        latitude: 34.67,
        longitude: -86.65,
        altitude: 3,
        sensor_max_distance: 5000,
        sensors: [
          { name: 'Camera', type: 'ElectroOpticalSensor', zoom: { minFov: 1, maxFov: 5 } },
          { name: 'Laser', type: 'Laser', max_range: 5000 }
        ],
        ...(includeFsm ? {
          fsm: {
            tip: 0,
            tilt: 0,
            slewRates: {
              tip: { maxRateDegPerSec: 20 },
              tilt: { maxRateDegPerSec: 20 }
            }
          }
        } : {})
      }
    ]
  }
}

function createRegistry(config = createScenarioConfig()) {
  return {
    async listScenarios() {
      return [{ id: 'demo', label: 'Demo' }]
    },
    async getScenarioById(id) {
      if (id !== 'demo') return null
      return {
        descriptor: { id: 'demo', label: 'Demo' },
        config
      }
    }
  }
}

function createRuntime(options = {}) {
  return new SimulationRuntime({
    scenarioRegistry: createRegistry(options.config),
    requireWriteSession: false,
    now: options.now ?? (() => Date.parse('2026-04-03T16:00:00Z')),
    analogLeaseMs: options.analogLeaseMs,
    controllerRegistry: options.controllerRegistry
  })
}

function createCustomController() {
  return {
    name: 'custom',
    value: null,
    commandDefinitions: [
      {
        type: 'customControl',
        aliases: ['custom_control'],
        normalize(command) {
          return {
            type: command.type,
            value: command.value
          }
        },
        validate(command) {
          if (command.value === 'invalid') {
            throw new Error('invalid custom value')
          }
        },
        apply(command, context, resolved, state) {
          if (command.value === 'boom') {
            throw new Error('custom apply failed')
          }
          state.value = command.value
          return [{ type: 'customMark', value: command.value }]
        }
      }
    ],
    cloneState() {
      return { value: this.value }
    },
    commit(state) {
      this.value = state.value
    },
    clear() {
      this.value = null
    }
  }
}

function createObserverOutputController() {
  return {
    name: 'observerOutput',
    touched: false,
    observedCommandTypes: ['setGimbalAxes'],
    commandDefinitions: [],
    observeCommand(command, context, state) {
      state.touched = true
      return [{ type: 'setGimbalAxes', observer: command.observer, axes: { az: 0 } }]
    },
    cloneState() {
      return { touched: this.touched }
    },
    commit(state) {
      this.touched = state.touched
    }
  }
}

describe('ControllerRegistry', () => {
  test('registers, resolves aliases, and unregisters controllers', () => {
    const registry = new ControllerRegistry()
    const controller = createCustomController()

    registry.register(controller)
    expect(registry.get('custom')).toBe(controller)
    expect(registry.getCommandDefinition('custom_control')).toMatchObject({
      type: 'customControl'
    })
    expect(registry.isControllerCommand({ type: 'customControl' })).toBe(true)

    expect(registry.unregister('custom')).toBe(true)
    expect(registry.isControllerCommand({ type: 'customControl' })).toBe(false)
  })

  test('rejects unknown controller commands', () => {
    const registry = new ControllerRegistry()
    expect(() => registry.prepare({ type: 'missingControl' })).toThrow(/Unknown controller command type/)
  })

  test('returns ordered batch errors and does not commit partial state', () => {
    const registry = new ControllerRegistry()
    const controller = createCustomController()
    registry.register(controller)

    try {
      registry.prepareBatch([
        { command: { type: 'customControl', value: 'ok' }, index: 2 },
        { command: { type: 'customControl', value: 'invalid' }, index: 1 }
      ])
      throw new Error('Expected controller prepareBatch to fail.')
    } catch (error) {
      expect(error).toMatchObject({
        errors: [
          expect.objectContaining({ index: 1, type: 'customControl' })
        ]
      })
    }

    const plans = registry.prepareBatch([
      { command: { type: 'customControl', value: 'accepted' }, index: 0 },
      { command: { type: 'customControl', value: 'boom' }, index: 1 }
    ])
    try {
      registry.planPreparedBatch(plans)
      throw new Error('Expected controller planPreparedBatch to fail.')
    } catch (error) {
      expect(error).toMatchObject({
        errors: [
          expect.objectContaining({ index: 1, type: 'customControl' })
        ]
      })
    }
    expect(controller.value).toBe(null)
  })

  test('rejects commands returned from observer hooks without committing state', () => {
    const registry = new ControllerRegistry()
    const controller = createObserverOutputController()
    registry.register(controller)

    try {
      registry.planPreparedBatch([
        {
          command: { type: 'setGimbalAxes', observer: 'OBS-1', axes: { az: 20 } },
          index: 0
        }
      ])
      throw new Error('Expected observer output to fail.')
    } catch (error) {
      expect(error).toMatchObject({
        errors: [
          expect.objectContaining({
            index: 0,
            type: 'setGimbalAxes',
            code: 'CONTROLLER_OBSERVER_OUTPUT_UNSUPPORTED'
          })
        ]
      })
    }

    expect(controller.touched).toBe(false)
  })
})

describe('built-in runtime controllers', () => {
  test('GimbalController creates, ticks, stops, and expires leases', async () => {
    let nowMs = Date.parse('2026-04-03T16:00:00Z')
    const runtime = createRuntime({
      analogLeaseMs: 250,
      now: () => nowMs
    })
    await runtime.loadScenarioById('demo')
    const controller = runtime.controllerRegistry.get('gimbal')
    const context = runtime.createCommandContext(runtime.clock.currentTime, { sessionId: 'writer' }, 'runtime')

    const plans = runtime.controllerRegistry.prepareBatch([
      { command: { type: 'setGimbalAxisRates', observer: 'OBS-1', axes: { az: 5, el: 0 } }, index: 0 }
    ], context)
    const commitPlan = runtime.controllerRegistry.planPreparedBatch(plans, {
      nowMs,
      analogLeaseMs: 250
    })
    runtime.controllerRegistry.commit(commitPlan)

    expect(controller.leases.get('OBS-1')).toMatchObject({
      observer: 'OBS-1',
      axes: { az: 5, el: 0 }
    })

    runtime.getObservatoryByName('OBS-1').gimbal.az = 10
    expect(controller.tick({ universe: runtime.universe, deltaSec: 0.2 })).toEqual([
      expect.objectContaining({
        type: 'setGimbalAxes',
        observer: 'OBS-1',
        axes: { az: 11 }
      })
    ])

    const stopPlan = runtime.controllerRegistry.planPreparedBatch(
      runtime.controllerRegistry.prepareBatch([
        { command: { type: 'setGimbalAxisRates', observer: 'OBS-1', axes: { az: 0 } }, index: 0 }
      ], context),
      { nowMs, analogLeaseMs: 250 }
    )
    expect(stopPlan.commands).toEqual([
      expect.objectContaining({
        type: 'setGimbalAxes',
        observer: 'OBS-1'
      })
    ])
    runtime.controllerRegistry.commit(stopPlan)
    expect(controller.leases.size).toBe(0)

    runtime.controllerRegistry.commit(runtime.controllerRegistry.planPreparedBatch(plans, {
      nowMs,
      analogLeaseMs: 250
    }))
    nowMs += 300
    expect(controller.expire({ universe: runtime.universe, nowMs })).toEqual([
      expect.objectContaining({
        type: 'setGimbalAxes',
        observer: 'OBS-1'
      })
    ])
    expect(controller.leases.size).toBe(0)
  })

  test('GimbalController observes discrete commands in input order', async () => {
    const runtime = createRuntime()
    await runtime.loadScenarioById('demo')
    const registry = runtime.controllerRegistry
    const controller = registry.get('gimbal')
    const context = runtime.createCommandContext(runtime.clock.currentTime, null, 'runtime')
    const nowMs = Date.parse('2026-04-03T16:00:00Z')
    const ratePlan = registry.prepare(
      { type: 'setGimbalAxisRates', observer: 'OBS-1', axes: { az: 5 } },
      context,
      0
    )
    const setPlan = runtime.commandBus.prepare(
      { type: 'setGimbalAxes', observer: 'OBS-1', axes: { az: 20 } },
      context,
      1
    )

    registry.commit(registry.planPreparedBatch([ratePlan, setPlan], {
      nowMs,
      analogLeaseMs: 250
    }))
    expect(controller.leases.size).toBe(0)

    registry.commit(registry.planPreparedBatch([setPlan, ratePlan], {
      nowMs,
      analogLeaseMs: 250
    }))
    expect(controller.leases.get('OBS-1')).toMatchObject({
      observer: 'OBS-1',
      axes: { az: 5 }
    })
  })

  test('FsmController validates targets and ticks into setFsmAxes', async () => {
    const runtime = createRuntime()
    await runtime.loadScenarioById('demo')
    const context = runtime.createCommandContext(runtime.clock.currentTime, null, 'runtime')

    const plans = runtime.controllerRegistry.prepareBatch([
      { command: { type: 'setFsmAxisRates', observer: 'OBS-1', axes: { tip: 2 } }, index: 0 }
    ], context)
    runtime.controllerRegistry.commit(runtime.controllerRegistry.planPreparedBatch(plans, {
      nowMs: Date.parse('2026-04-03T16:00:00Z'),
      analogLeaseMs: 250
    }))

    const fsm = runtime.getObservatoryByName('OBS-1').fsm
    fsm.tip = 1
    expect(runtime.controllerRegistry.get('fsm').tick({ universe: runtime.universe, deltaSec: 0.5 })).toEqual([
      expect.objectContaining({
        type: 'setFsmAxes',
        axes: { tip: 2 }
      })
    ])

    const runtimeWithoutFsm = createRuntime({ config: createScenarioConfig({ includeFsm: false }) })
    await runtimeWithoutFsm.loadScenarioById('demo')
    try {
      runtimeWithoutFsm.controllerRegistry.prepareBatch([
        { command: { type: 'setFsmAxisRates', observer: 'OBS-1', axes: { tip: 1 } }, index: 0 }
      ], runtimeWithoutFsm.createCommandContext(runtimeWithoutFsm.clock.currentTime))
      throw new Error('Expected FSM controller validation to fail.')
    } catch (error) {
      expect(error).toMatchObject({
        errors: [
          expect.objectContaining({
            code: 'COMMAND_FSM_NOT_FOUND',
            statusCode: 409
          })
        ]
      })
    }
  })

  test('SensorZoomController clamps ticks and emits hold commands', async () => {
    const runtime = createRuntime()
    await runtime.loadScenarioById('demo')
    const context = runtime.createCommandContext(runtime.clock.currentTime, null, 'runtime')
    const controller = runtime.controllerRegistry.get('sensorZoom')
    const sensor = runtime.getSensorByName(runtime.getObservatoryByName('OBS-1'), 'Camera')

    sensor.zoomLevel = 0.9
    const plans = runtime.controllerRegistry.prepareBatch([
      { command: { type: 'setSensorZoomRate', observer: 'OBS-1', sensor: 'Camera', zoomRateLevelPerSec: 1 }, index: 0 }
    ], context)
    runtime.controllerRegistry.commit(runtime.controllerRegistry.planPreparedBatch(plans, {
      nowMs: Date.parse('2026-04-03T16:00:00Z'),
      analogLeaseMs: 250
    }))

    expect(controller.tick({ universe: runtime.universe, deltaSec: 0.5 })).toEqual([
      expect.objectContaining({
        type: 'setSensorZoom',
        observer: 'OBS-1',
        sensor: 'Camera',
        zoomLevel: 1
      })
    ])

    const stopPlan = runtime.controllerRegistry.planPreparedBatch(
      runtime.controllerRegistry.prepareBatch([
        { command: { type: 'setSensorZoomRate', observer: 'OBS-1', sensor: 'Camera', zoomRateLevelPerSec: 0 }, index: 0 }
      ], context),
      { nowMs: Date.parse('2026-04-03T16:00:00Z'), analogLeaseMs: 250 }
    )
    expect(stopPlan.commands).toEqual([
      expect.objectContaining({
        type: 'setSensorZoom',
        sensor: 'Camera',
        zoomLevel: 0.9
      })
    ])
  })

  test('default registry includes domain controllers', () => {
    const registry = createDefaultControllerRegistry()
    expect(registry.get('gimbal')).toBeInstanceOf(GimbalController)
    expect(registry.get('sensorZoom')).toBeInstanceOf(SensorZoomController)
  })
})

describe('SimulationRuntime controller extensibility', () => {
  test('executes custom controller commands through generated command bus commands', async () => {
    const controllerRegistry = new ControllerRegistry()
    const controller = createCustomController()
    controllerRegistry.register(controller)

    const commandBus = createDefaultCommandBus()
    commandBus.register({
      type: 'customMark',
      validate(command) {
        if (!command.value) {
          throw new Error('value required')
        }
      },
      execute(command, { universe }) {
        universe.customMark = command.value
      }
    })

    const runtime = createRuntime({ controllerRegistry })
    runtime.commandBus = commandBus
    await runtime.loadScenarioById('demo')

    await runtime.applyCommands('', [
      { type: 'custom_control', value: 'accepted' }
    ])

    expect(controller.value).toBe('accepted')
    expect(runtime.universe.customMark).toBe('accepted')
    expect(runtime.getRuntimeEvents().events).toEqual([
      expect.objectContaining({
        type: 'customMark',
        data: { value: 'accepted' }
      })
    ])
  })
})
