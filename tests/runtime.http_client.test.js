import http from 'node:http'

import HttpRuntimeServer from '../src/runtime/HttpRuntimeServer.js'
import RuntimeClient from '../src/runtime/RuntimeClient.js'
import SimulationRuntime from '../src/runtime/SimulationRuntime.js'
import { applyIau2006XysDataPatch } from '../src/engine/cesium/Iau2006XysDataLocal.js'

beforeAll(() => {
  applyIau2006XysDataPatch()
})

function createScenarioConfig() {
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
        altitude: 3
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

function createRegistry() {
  const descriptor = {
    id: 'demo',
    label: 'Demo',
    scenarioUrl: '/scenarios/demo.json',
    assetBaseUrl: '/scenarios/'
  }
  return {
    async listScenarios() {
      return [descriptor]
    },
    async getScenarioById(id) {
      if (id !== 'demo') return null
      return { descriptor, config: createScenarioConfig() }
    }
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`)
  }
  return payload
}

function readSseChunk(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.setEncoding('utf8')
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
        if (data.includes('event: state')) {
          req.destroy()
          resolve(data)
        }
      })
      res.on('error', reject)
    })
    req.on('error', reject)
  })
}

describe('HttpRuntimeServer', () => {
  test('serves scenarios, sessions, snapshots, SSE, commands, and runtime events', async () => {
    const runtime = new SimulationRuntime({ scenarioRegistry: createRegistry() })
    const server = new HttpRuntimeServer({
      runtime,
      config: { bindHost: '127.0.0.1', bindPort: 0 }
    })
    await server.listen()
    const baseUrl = `http://${server.config.bindHost}:${server.config.bindPort}`

    try {
      const health = await fetchJson(`${baseUrl}/healthz`)
      expect(health.ok).toBe(true)

      const scenarios = await fetchJson(`${baseUrl}/api/v1/scenarios`)
      expect(scenarios.scenarios[0].id).toBe('demo')

      const reader = await fetchJson(`${baseUrl}/api/v1/runtime/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holderLabel: 'Reader', capability: 'read' })
      })
      expect(reader.capability).toBe('read')

      const writer = await fetchJson(`${baseUrl}/api/v1/runtime/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holderLabel: 'Writer', capability: 'write' })
      })
      expect(writer.capability).toBe('write')

      const ssePromise = readSseChunk(`${baseUrl}/api/v1/state/stream`)
      const loaded = await fetchJson(`${baseUrl}/api/v1/scenarios/demo/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: writer.sessionId })
      })
      expect(loaded.status.state).toBe('loaded')
      expect(await ssePromise).toMatch(/event: state/)

      const commandSnapshot = await fetchJson(`${baseUrl}/api/v1/runtime/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: writer.sessionId,
          commands: [{ type: 'stepGimbalAxes', observer: 'OBS-1', axes: { az: 1 } }]
        })
      })
      expect(commandSnapshot.sync.lastEventSequence).toBe(1)

      const events = await fetchJson(`${baseUrl}/api/v1/events?after=0`)
      expect(events.events[0]).toMatchObject({
        holderLabel: 'Writer',
        type: 'stepGimbalAxes'
      })

      const runtimeStatus = await fetchJson(`${baseUrl}/api/v1/runtime/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: writer.sessionId })
      })
      expect(runtimeStatus.state).toBe('running')
    } finally {
      await server.close()
    }
  })
})

describe('RuntimeClient', () => {
  test('creates read/write sessions and submits commands', async () => {
    const runtime = new SimulationRuntime({ scenarioRegistry: createRegistry() })
    const server = new HttpRuntimeServer({
      runtime,
      config: { bindHost: '127.0.0.1', bindPort: 0 }
    })
    await server.listen()
    const client = new RuntimeClient({
      baseUrl: `http://${server.config.bindHost}:${server.config.bindPort}`
    })

    try {
      const writer = await client.createSession({ holderLabel: 'SDK', capability: 'write' })
      expect(writer.sessionId).toBe(client.sessionId)
      await client.loadScenario('demo')
      const snapshot = await client.sendCommands([
        { type: 'stepGimbalAxes', observer: 'OBS-1', axes: { az: 1 } }
      ])
      expect(snapshot.sync.lastEventSequence).toBe(1)

      const events = await client.getEvents({ after: 0 })
      expect(events.events[0].holderLabel).toBe('SDK')
      await client.release()
      expect(client.sessionId).toBeNull()
    } finally {
      await server.close()
    }
  })

  test('wires state streaming through a provided EventSource implementation', () => {
    const events = {}
    class FakeEventSource {
      constructor(url) {
        this.url = url
      }

      addEventListener(type, listener) {
        events[type] = listener
      }
    }

    const client = new RuntimeClient({
      baseUrl: 'http://example.test',
      fetchImpl: async () => ({
        ok: true,
        async json() { return {} }
      }),
      EventSourceImpl: FakeEventSource
    })
    const received = []
    const source = client.streamState({
      onState: (snapshot) => received.push(snapshot)
    })

    expect(source.url).toBe('http://example.test/api/v1/state/stream')
    events.state({ data: JSON.stringify({ runtimeId: 'runtime-1' }) })
    expect(received).toEqual([{ runtimeId: 'runtime-1' }])
  })
})
