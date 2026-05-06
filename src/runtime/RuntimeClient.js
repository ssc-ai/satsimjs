function trimBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '')
}

function joinUrl(baseUrl, path) {
  return `${trimBaseUrl(baseUrl)}${path}`
}

/**
 * Minimal browser/node client for the SatSim runtime HTTP API.
 */
export class RuntimeClient {
  /**
   * Create a runtime client.
   *
   * @param {object} [options]
   * @param {string} [options.baseUrl=''] Runtime server base URL.
   * @param {Function} [options.fetchImpl=globalThis.fetch] Fetch implementation.
   * @param {Function} [options.EventSourceImpl=globalThis.EventSource] EventSource implementation for SSE.
   */
  constructor({
    baseUrl = '',
    fetchImpl = globalThis.fetch?.bind(globalThis),
    EventSourceImpl = globalThis.EventSource
  } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new Error('RuntimeClient requires fetch.')
    }
    this.baseUrl = trimBaseUrl(baseUrl)
    this.fetch = fetchImpl
    this.EventSourceImpl = EventSourceImpl
    this.sessionId = null
    this.holderLabel = null
    this.capability = null
  }

  /**
   * Send a JSON HTTP request to the runtime API.
   *
   * @param {string} path API path.
   * @param {object} [options] Request options.
   * @returns {Promise<object>} Parsed JSON response.
   */
  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const response = await this.fetch(joinUrl(this.baseUrl, path), {
      method,
      headers: body == null
        ? headers
        : {
          'Content-Type': 'application/json',
          ...headers
        },
      body: body == null ? undefined : JSON.stringify(body)
    })
    const payload = await response.json()
    if (!response.ok) {
      const error = new Error(payload.error || `Request failed: ${response.status}`)
      error.status = response.status
      error.code = payload.code
      error.errors = payload.errors
      error.details = payload.details
      error.payload = payload
      throw error
    }
    return payload
  }

  /**
   * List scenarios available on the runtime server.
   *
   * @returns {Promise<object>} Scenario list response.
   */
  listScenarios() {
    return this.request('/api/v1/scenarios')
  }

  /**
   * Fetch runtime status.
   *
   * @returns {Promise<object>} Runtime status.
   */
  getRuntime() {
    return this.request('/api/v1/runtime')
  }

  /**
   * Fetch the full runtime state snapshot.
   *
   * @returns {Promise<object>} Runtime snapshot.
   */
  getState() {
    return this.request('/api/v1/state')
  }

  /**
   * Fetch ordered runtime events.
   *
   * @param {object} [options]
   * @returns {Promise<object>} Event polling response.
   */
  getEvents({ generation, after } = {}) {
    const params = new URLSearchParams()
    if (generation != null) params.set('generation', String(generation))
    if (after != null) params.set('after', String(after))
    const query = params.toString()
    return this.request(`/api/v1/events${query ? `?${query}` : ''}`)
  }

  /**
   * Create and remember a read or write session.
   *
   * @param {object} [request] Session request.
   * @returns {Promise<object>} Public session descriptor.
   */
  async createSession({ holderLabel = 'Client', capability = 'read' } = {}) {
    const session = await this.request('/api/v1/runtime/sessions', {
      method: 'POST',
      body: { holderLabel, capability }
    })
    this.sessionId = session.sessionId
    this.holderLabel = session.holderLabel
    this.capability = session.capability
    return session
  }

  /**
   * Renew a session lease.
   *
   * @param {string} [sessionId=this.sessionId] Session to renew.
   * @returns {Promise<object>} Public session descriptor.
   */
  async heartbeat(sessionId = this.sessionId) {
    const session = await this.request(`/api/v1/runtime/sessions/${encodeURIComponent(sessionId)}/heartbeat`, {
      method: 'POST'
    })
    if (session.sessionId === this.sessionId) {
      this.holderLabel = session.holderLabel
      this.capability = session.capability
    }
    return session
  }

  /**
   * Release a session lease.
   *
   * @param {string} [sessionId=this.sessionId] Session to release.
   * @returns {Promise<object>} Release result.
   */
  async release(sessionId = this.sessionId) {
    const result = await this.request(`/api/v1/runtime/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE'
    })
    if (sessionId === this.sessionId) {
      this.sessionId = null
      this.holderLabel = null
      this.capability = null
    }
    return result
  }

  /**
   * Load a scenario.
   *
   * @param {string} id Scenario id.
   * @param {string} [sessionId=this.sessionId] Write session id.
   * @returns {Promise<object>} Runtime snapshot.
   */
  loadScenario(id, sessionId = this.sessionId) {
    return this.request(`/api/v1/scenarios/${encodeURIComponent(id)}/load`, {
      method: 'POST',
      body: { sessionId }
    })
  }

  /**
   * Start the runtime.
   *
   * @param {string} [sessionId=this.sessionId] Write session id.
   * @returns {Promise<object>} Runtime status.
   */
  start(sessionId = this.sessionId) {
    return this.request('/api/v1/runtime/start', {
      method: 'POST',
      body: { sessionId }
    })
  }

  /**
   * Stop the runtime.
   *
   * @param {string} [sessionId=this.sessionId] Write session id.
   * @returns {Promise<object>} Runtime status.
   */
  stop(sessionId = this.sessionId) {
    return this.request('/api/v1/runtime/stop', {
      method: 'POST',
      body: { sessionId }
    })
  }

  /**
   * Submit runtime commands.
   *
   * @param {object[]} commands Commands to submit.
   * @param {string} [sessionId=this.sessionId] Write session id.
   * @returns {Promise<object>} Runtime snapshot.
   */
  sendCommands(commands, sessionId = this.sessionId) {
    return this.request('/api/v1/runtime/commands', {
      method: 'POST',
      body: { sessionId, commands }
    })
  }

  /**
   * Subscribe to server-sent runtime snapshots.
   *
   * @param {object} [options]
   * @param {(snapshot: object) => void} [options.onState] Snapshot callback.
   * @param {(error: unknown) => void} [options.onError] Error callback.
   * @returns {EventSource} EventSource instance.
   */
  streamState({ onState, onError } = {}) {
    if (typeof this.EventSourceImpl !== 'function') {
      throw new Error('RuntimeClient requires EventSource for state streams.')
    }
    const source = new this.EventSourceImpl(joinUrl(this.baseUrl, '/api/v1/state/stream'))
    source.addEventListener?.('state', (event) => {
      try {
        onState?.(JSON.parse(event.data))
      } catch (err) {
        onError?.(err)
      }
    })
    if ('onerror' in source) {
      source.onerror = (event) => onError?.(event)
    }
    return source
  }
}

export default RuntimeClient
