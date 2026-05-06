import http from 'node:http'

import SimulationRuntime from './SimulationRuntime.js'
import { createSseChannel, parseJsonBody, sendJson } from './http.js'

function sendError(res, err) {
  const payload = {
    ok: false,
    error: String(err?.message ?? err)
  }
  if (err?.code) {
    payload.code = err.code
  }
  if (Array.isArray(err?.errors)) {
    payload.errors = err.errors
  } else if (typeof err?.toJSON === 'function') {
    payload.details = err.toJSON()
  }
  sendJson(res, err.statusCode || 400, payload)
}

async function readOptionalJsonBody(req) {
  try {
    return await parseJsonBody(req)
  } catch (err) {
    if (err.statusCode === 400) throw err
    throw err
  }
}

async function handleMutation({ req, res, action, mapResult = (value) => value }) {
  try {
    const body = await readOptionalJsonBody(req)
    const result = await action(body)
    sendJson(res, 200, mapResult(result))
  } catch (err) {
    sendError(res, err)
  }
}

/**
 * Optional Node HTTP/SSE wrapper around a `SimulationRuntime`.
 */
export class HttpRuntimeServer {
  /**
   * Create an HTTP runtime server.
   *
   * @param {object} [options]
   * @param {SimulationRuntime} [options.runtime] Runtime instance to expose.
   * @param {object} [options.config] Server bind configuration.
   */
  constructor({
    runtime,
    config = {}
  } = {}) {
    this.runtime = runtime ?? new SimulationRuntime()
    this.config = {
      bindHost: config.bindHost ?? '127.0.0.1',
      bindPort: Number(config.bindPort ?? 0)
    }
    this.sseChannel = createSseChannel()
    this.server = null
    this._offRuntimeUpdate = null
  }

  /**
   * Create the Node request handler used by the HTTP server.
   *
   * @returns {Function} Request handler.
   */
  createRequestHandler() {
    return async (req, res) => {
      const method = req.method || 'GET'
      const requestUrl = new URL(req.url || '/', 'http://localhost')
      const pathName = requestUrl.pathname
      const scenarioLoadMatch = pathName.match(/^\/api\/v1\/scenarios\/([^/]+)\/load$/)
      const sessionHeartbeatMatch = pathName.match(/^\/api\/v1\/runtime\/sessions\/([^/]+)\/heartbeat$/)
      const sessionReleaseMatch = pathName.match(/^\/api\/v1\/runtime\/sessions\/([^/]+)$/)

      if (method === 'GET' && (pathName === '/healthz' || pathName === '/api/healthz')) {
        sendJson(res, 200, {
          ok: true,
          service: 'satsim_runtime',
          runtime: this.runtime.getSnapshot().status
        })
        return
      }

      if (method === 'GET' && pathName === '/api/v1/scenarios') {
        try {
          sendJson(res, 200, { scenarios: await this.runtime.listScenarios() })
        } catch (err) {
          sendError(res, err)
        }
        return
      }

      if (method === 'POST' && scenarioLoadMatch) {
        await handleMutation({
          req,
          res,
          action: (body) => this.runtime.loadScenarioById(scenarioLoadMatch[1], {
            sessionId: body?.sessionId
          })
        })
        return
      }

      if (method === 'GET' && pathName === '/api/v1/runtime') {
        sendJson(res, 200, this.runtime.getSnapshot().status)
        return
      }

      if (method === 'POST' && pathName === '/api/v1/runtime/start') {
        await handleMutation({
          req,
          res,
          action: (body) => this.runtime.start({ sessionId: body?.sessionId }),
          mapResult: (snapshot) => snapshot.status
        })
        return
      }

      if (method === 'POST' && pathName === '/api/v1/runtime/stop') {
        await handleMutation({
          req,
          res,
          action: (body) => this.runtime.stop({ sessionId: body?.sessionId }),
          mapResult: (snapshot) => snapshot.status
        })
        return
      }

      if (method === 'GET' && pathName === '/api/v1/state') {
        sendJson(res, 200, this.runtime.getSnapshot())
        return
      }

      if (method === 'GET' && pathName === '/api/v1/state/stream') {
        this.sseChannel.attach(req, res, this.runtime.getSnapshot())
        return
      }

      if (method === 'GET' && pathName === '/api/v1/events') {
        const after = requestUrl.searchParams.get('after')
        const generation = requestUrl.searchParams.get('generation')
        sendJson(res, 200, this.runtime.getRuntimeEvents({
          after: after == null ? undefined : Number(after),
          generation: generation == null ? undefined : Number(generation)
        }))
        return
      }

      if (method === 'POST' && pathName === '/api/v1/runtime/sessions') {
        await handleMutation({
          req,
          res,
          action: (body) => this.runtime.createSession({
            holderLabel: body?.holderLabel,
            capability: body?.capability
          })
        })
        return
      }

      if (method === 'POST' && sessionHeartbeatMatch) {
        try {
          sendJson(res, 200, this.runtime.heartbeatSession(decodeURIComponent(sessionHeartbeatMatch[1])))
        } catch (err) {
          sendError(res, err)
        }
        return
      }

      if (method === 'DELETE' && sessionReleaseMatch) {
        try {
          sendJson(res, 200, this.runtime.releaseSession(decodeURIComponent(sessionReleaseMatch[1])))
        } catch (err) {
          sendError(res, err)
        }
        return
      }

      if (method === 'POST' && pathName === '/api/v1/runtime/commands') {
        await handleMutation({
          req,
          res,
          action: (body) => this.runtime.applyCommands(body?.sessionId, body?.commands)
        })
        return
      }

      sendJson(res, 404, {
        ok: false,
        error: `Not found: ${method} ${pathName}`
      })
    }
  }

  /**
   * Start listening for HTTP requests.
   *
   * @returns {Promise<HttpRuntimeServer>} Resolves with this server after bind.
   */
  listen() {
    if (this.server) {
      return Promise.resolve(this)
    }

    this.server = http.createServer(this.createRequestHandler())
    this._offRuntimeUpdate = this.runtime.on('update', ({ snapshot }) => {
      this.sseChannel.broadcast(snapshot)
    })

    return new Promise((resolve, reject) => {
      const onError = (err) => {
        this.server.off('listening', onListening)
        reject(err)
      }
      const onListening = () => {
        this.server.off('error', onError)
        this.config.bindPort = this.server.address().port
        resolve(this)
      }
      this.server.once('error', onError)
      this.server.once('listening', onListening)
      this.server.listen(this.config.bindPort, this.config.bindHost)
    })
  }

  /**
   * Close SSE clients, runtime resources, and the HTTP server.
   *
   * @returns {Promise<void>} Resolves when the server is closed.
   */
  close() {
    this.sseChannel.closeAll()
    this._offRuntimeUpdate?.()
    this._offRuntimeUpdate = null
    this.runtime.close()

    if (!this.server) {
      return Promise.resolve()
    }

    const server = this.server
    this.server = null
    return new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}

export default HttpRuntimeServer
