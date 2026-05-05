import SimulationRuntime from '../src/runtime/SimulationRuntime.js'
import { applyIau2006XysDataPatch } from '../src/engine/cesium/Iau2006XysDataLocal.js'

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
      },
      {
        type: 'AirVehicle',
        name: 'Drone-1',
        latitude: 34.671,
        longitude: -86.649,
        altitude: 120,
        velocity_ned: [10, 0, 0]
      }
    ],
    events: [
      {
        time: 0,
        type: 'trackObject',
        observer: 'OBS-1',
        target: 'Drone-1'
      }
    ]
  }
}

function createRegistry(config = createScenarioConfig()) {
  return {
    async listScenarios() {
      return [{ id: 'demo', label: 'Demo', scenarioUrl: '/scenarios/demo.json', assetBaseUrl: '/scenarios/' }]
    },
    async getScenarioById(id) {
      if (id !== 'demo') return null
      return {
        descriptor: { id: 'demo', label: 'Demo', scenarioUrl: '/scenarios/demo.json', assetBaseUrl: '/scenarios/' },
        config
      }
    }
  }
}

describe('SimulationRuntime', () => {
  test('loads, starts, stops, snapshots, and resets runtime event generations', async () => {
    let nowMs = Date.parse('2026-04-03T16:00:00Z')
    const runtime = new SimulationRuntime({
      scenarioRegistry: createRegistry(),
      tickMs: 5,
      now: () => nowMs
    })
    const writer = runtime.createSession({ holderLabel: 'Writer', capability: 'write' })

    const loaded = await runtime.loadScenarioById('demo', { sessionId: writer.sessionId })
    expect(loaded.status.state).toBe('loaded')
    expect(loaded.runtimeId).toBe(runtime.runtimeId)
    expect(loaded.sessions.writeCount).toBe(1)
    expect(loaded.objects.some((object) => object.name === 'OBS-1')).toBe(true)
    expect(loaded.observatories[0].gimbal.trackTarget).toBe('Drone-1')

    await runtime.start({ sessionId: writer.sessionId })
    expect(runtime.state).toBe('running')
    nowMs += 100
    await runtime.tick()

    const stopped = runtime.stop({ sessionId: writer.sessionId })
    expect(stopped.status.state).toBe('paused')

    const reloaded = await runtime.loadScenarioById('demo', { sessionId: writer.sessionId })
    expect(reloaded.sync.lastEventSequence).toBe(0)
    expect(reloaded.sync.scenarioGeneration).toBeGreaterThan(loaded.sync.scenarioGeneration)
    runtime.close()
  })

  test('requires write capability for mutating operations', async () => {
    const runtime = new SimulationRuntime({ scenarioRegistry: createRegistry() })
    const reader = runtime.createSession({ holderLabel: 'Reader', capability: 'read' })

    await expect(runtime.loadScenarioById('demo', { sessionId: reader.sessionId })).rejects.toThrow(/write capability/)
    runtime.close()
  })

  test('records multi-writer commands in ordered runtime event log', async () => {
    const runtime = new SimulationRuntime({ scenarioRegistry: createRegistry(), writePolicy: 'multi' })
    const first = runtime.createSession({ holderLabel: 'Writer-1', capability: 'write' })
    const second = runtime.createSession({ holderLabel: 'Writer-2', capability: 'write' })
    await runtime.loadScenarioById('demo', { sessionId: first.sessionId })

    await runtime.applyCommands(first.sessionId, [
      { type: 'stepGimbalAxes', observer: 'OBS-1', axes: { az: 1 } }
    ])
    await runtime.applyCommands(second.sessionId, [
      { type: 'stepFsmAxes', observer: 'OBS-1', axes: { tip: 0.5 } }
    ])

    const events = runtime.getRuntimeEvents().events
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ sequence: 1, holderLabel: 'Writer-1', type: 'stepGimbalAxes' })
    expect(events[1]).toMatchObject({ sequence: 2, holderLabel: 'Writer-2', type: 'stepFsmAxes' })
    runtime.close()
  })

  test('translates analog rate leases into absolute commands and expires them', async () => {
    let nowMs = Date.parse('2026-04-03T16:00:00Z')
    const runtime = new SimulationRuntime({
      scenarioRegistry: createRegistry(),
      analogLeaseMs: 250,
      tickMs: 5,
      now: () => nowMs
    })
    const writer = runtime.createSession({ holderLabel: 'Writer', capability: 'write' })
    await runtime.loadScenarioById('demo', { sessionId: writer.sessionId })
    await runtime.start({ sessionId: writer.sessionId })

    await runtime.applyCommands(writer.sessionId, [
      { type: 'setGimbalAxisRates', observer: 'OBS-1', axes: { az: 5, el: 0 } }
    ])

    nowMs += 100
    await runtime.tick()
    nowMs += 300
    await runtime.tick()

    const events = runtime.getRuntimeEvents().events
    expect(events[0].type).toBe('setGimbalAxes')
    expect(events[0].holderLabel).toBe('Writer')
    expect(events[1].type).toBe('setGimbalAxes')
    runtime.close()
  })

  test('can be embedded with trusted local mutations when sessions are disabled', async () => {
    const runtime = new SimulationRuntime({
      scenarioRegistry: createRegistry(),
      requireWriteSession: false
    })

    await expect(runtime.loadScenarioById('demo')).resolves.toMatchObject({
      status: { state: 'loaded' }
    })
    await expect(runtime.applyCommands('', [
      { type: 'stepGimbalAxes', observer: 'OBS-1', axes: { az: 1 } }
    ])).resolves.toMatchObject({
      sync: { lastEventSequence: 1 }
    })
    runtime.close()
  })
})
