import Universe from '../engine/Universe.js'
import { Cartesian3, JulianDate } from '../cesiumExports.js'
import { createClockContext, loadScenarioRuntime } from '../scenario/index.js'
import { createRuntimeError } from './errors.js'
import SessionManager from './SessionManager.js'
import { buildRuntimeSnapshot } from './snapshot.js'

const DEFAULT_ANALOG_LEASE_MS = 250

function createRuntimeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function julianDateToIso(value) {
  if (!(value instanceof JulianDate)) {
    return null
  }
  return JulianDate.toDate(value).toISOString()
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeSessionId(options) {
  if (typeof options === 'string') {
    return options
  }
  return String(options?.sessionId || '').trim()
}

function stripRuntimeMetadata(command) {
  const data = { ...command }
  delete data.type
  delete data.__runtimeSession
  return data
}

/**
 * Minimal event target used by runtime servers and embedders.
 */
class RuntimeEventTarget {
  constructor() {
    this._listeners = new Map()
  }

  /**
   * Subscribe to a runtime event.
   *
   * @param {string} type Event type.
   * @param {(payload: object) => void} listener Callback invoked for the event.
   * @returns {() => void} Unsubscribe callback.
   */
  on(type, listener) {
    if (typeof listener !== 'function') {
      return () => {}
    }
    const key = String(type)
    const listeners = this._listeners.get(key) ?? new Set()
    listeners.add(listener)
    this._listeners.set(key, listeners)
    return () => this.off(key, listener)
  }

  /**
   * Remove a runtime event listener.
   *
   * @param {string} type Event type.
   * @param {(payload: object) => void} listener Callback to remove.
   */
  off(type, listener) {
    const listeners = this._listeners.get(String(type))
    if (!listeners) return
    listeners.delete(listener)
    if (listeners.size === 0) {
      this._listeners.delete(String(type))
    }
  }

  /**
   * Emit a runtime event to listeners.
   *
   * @param {string} type Event type.
   * @param {object} payload Event payload.
   */
  emit(type, payload) {
    const listeners = this._listeners.get(String(type))
    if (!listeners) return
    for (const listener of [...listeners]) {
      listener(payload)
    }
  }
}

/**
 * Generic SatSim runtime coordinator.
 *
 * The runtime owns scenario loading, the authoritative clock, Universe updates,
 * session enforcement, ordered command/event logging, and analog-rate leases.
 * Embedding applications can override hook methods to attach domain-specific
 * behavior without coupling the core runtime to HTTP, UDP, or ICD details.
 */
export class SimulationRuntime extends RuntimeEventTarget {
  /**
   * Create a simulation runtime.
   *
   * @param {object} [options]
   * @param {string} [options.runtimeId] Stable runtime identifier shown in snapshots.
   * @param {object} [options.scenarioRegistry] Registry with `listScenarios` and `getScenarioById`.
   * @param {() => Universe} [options.createUniverse] Factory used for each scenario load.
   * @param {number} [options.tickMs=40] Wall-clock tick interval in milliseconds.
   * @param {() => number} [options.now=Date.now] Clock used for ticks, events, and leases.
   * @param {SessionManager} [options.sessionManager] Session manager to use.
   * @param {'multi'|'single'|'readOnly'} [options.writePolicy='multi'] Policy for created sessions.
   * @param {boolean} [options.requireWriteSession=true] Whether mutating calls require a write session.
   * @param {number} [options.analogLeaseMs=250] Analog-rate command lease duration.
   */
  constructor({
    runtimeId = createRuntimeId(),
    scenarioRegistry,
    createUniverse = () => new Universe(),
    tickMs = 40,
    now = () => Date.now(),
    sessionManager,
    writePolicy = 'multi',
    requireWriteSession = true,
    analogLeaseMs = DEFAULT_ANALOG_LEASE_MS
  } = {}) {
    super()
    this.runtimeId = String(runtimeId || createRuntimeId())
    this.scenarioRegistry = scenarioRegistry
    this.createUniverse = createUniverse
    this.tickMs = Math.max(1, Number(tickMs) || 40)
    this.now = now
    this.sessionManager = sessionManager ?? new SessionManager({ writePolicy, now })
    this.requireWriteSession = Boolean(requireWriteSession)
    this.analogLeaseMs = Math.max(1, Number(analogLeaseMs) || DEFAULT_ANALOG_LEASE_MS)

    this.state = 'idle'
    this.lastError = ''
    this.clock = createClockContext()
    this.loadedScenario = null
    this.universe = null
    this.syncMode = 'event_log'
    this.scenarioGeneration = 0
    this.runtimeEventSequence = 0
    this.runtimeEvents = []
    this._analogGimbalLeases = new Map()
    this._analogFsmLeases = new Map()
    this._analogZoomLeases = new Map()

    this._timer = null
    this._tickInFlight = false
    this._lastWallTimeMs = 0
    this._closed = false
  }

  /**
   * Return scenario descriptors available to this runtime.
   *
   * @returns {Promise<object[]>} Scenario descriptors from the configured registry.
   */
  async listScenarios() {
    return this.scenarioRegistry?.listScenarios?.() ?? []
  }

  /**
   * Create a runtime session and publish an updated snapshot.
   *
   * @param {object} [request] Session request accepted by `SessionManager`.
   * @returns {object} Public session descriptor.
   */
  createSession(request = {}) {
    const session = this.sessionManager.createSession(request)
    this.emitSnapshot('session_create')
    return session
  }

  /**
   * Renew a runtime session lease.
   *
   * @param {string} sessionId Session to renew.
   * @returns {object} Public session descriptor.
   */
  heartbeatSession(sessionId) {
    const session = this.sessionManager.heartbeat(sessionId)
    this.emitSnapshot('session_heartbeat')
    return session
  }

  /**
   * Release a runtime session.
   *
   * @param {string} sessionId Session to release.
   * @returns {{released: boolean}} Release result.
   */
  releaseSession(sessionId) {
    const released = this.sessionManager.release(sessionId)
    this.emitSnapshot('session_release')
    return released
  }

  /**
   * Resolve the write session used for mutating runtime operations.
   *
   * Subclasses may override this to adapt legacy lock mechanisms or trusted
   * local control paths.
   *
   * @param {string} sessionId Candidate session id.
   * @returns {object|null} Internal session record, or null when session enforcement is disabled.
   */
  resolveWriteSession(sessionId) {
    const normalized = String(sessionId || '').trim()
    if (!this.requireWriteSession) {
      if (!normalized) return null
      try {
        return this.sessionManager.touch(normalized)
      } catch (_) {
        return null
      }
    }
    return this.sessionManager.requireWriteSession(normalized)
  }

  /**
   * Load a scenario by id into a fresh Universe and reset runtime event state.
   *
   * @param {string} id Scenario id to load.
   * @param {object|string} [options] Options object or session id string.
   * @returns {Promise<object>} Fresh runtime snapshot.
   */
  async loadScenarioById(id, options = {}) {
    const session = this.resolveWriteSession(normalizeSessionId(options))
    if (this.state === 'running') {
      throw createRuntimeError('Cannot load a new scenario while the runtime is running.', 409)
    }

    const resolved = await this.scenarioRegistry?.getScenarioById?.(id)
    if (!resolved) {
      throw createRuntimeError(`Unknown scenario id: ${id}`, 404)
    }

    const nextUniverse = this.createUniverse()
    const nextClock = createClockContext()
    loadScenarioRuntime(nextUniverse, nextClock, resolved.config)
    nextUniverse.update(nextClock.currentTime)

    this.clearAnalogLeases()
    this.resetRuntimeEvents()
    this.loadedScenario = resolved
    this.universe = nextUniverse
    this.clock = nextClock
    this.lastError = ''
    this.state = 'loaded'
    this.afterScenarioLoaded({ scenario: resolved, session })
    return this.emitSnapshot('load')
  }

  /**
   * Hook invoked after a scenario has been loaded and before the load snapshot is emitted.
   *
   * @param {object} context Load context.
   */
  afterScenarioLoaded() {}

  /**
   * Start ticking the loaded scenario.
   *
   * @param {object|string} [options] Options object or session id string.
   * @returns {Promise<object>} Runtime snapshot after start.
   */
  async start(options = {}) {
    const session = this.resolveWriteSession(normalizeSessionId(options))
    if (!this.loadedScenario || !this.universe) {
      throw createRuntimeError('No scenario is loaded.', 409)
    }
    if (this.state === 'running') {
      return this.getSnapshot()
    }
    if (!(this.state === 'loaded' || this.state === 'paused')) {
      throw createRuntimeError(`Runtime cannot start from state: ${this.state}`, 409)
    }

    this.clock.shouldAnimate = true
    this._closed = false
    this.state = 'running'
    this.lastError = ''
    this._lastWallTimeMs = this.now()
    await this.tick()
    await this.afterRuntimeStarted({ session })
    if (this.state === 'running') {
      this.scheduleNextTick()
    }
    return this.getSnapshot()
  }

  /**
   * Hook invoked after the first runtime tick during start.
   *
   * @param {object} context Start context.
   */
  afterRuntimeStarted() {}

  /**
   * Stop ticking and leave the loaded runtime paused.
   *
   * @param {object|string} [options] Options object or session id string.
   * @returns {object} Runtime snapshot after stop.
   */
  stop(options = {}) {
    const session = this.resolveWriteSession(normalizeSessionId(options))
    if (this.state !== 'running') {
      return this.getSnapshot()
    }

    this.clearTimer()
    this.clock.shouldAnimate = false
    this.state = 'paused'
    this.afterRuntimeStopped({ session })
    return this.emitSnapshot('stop')
  }

  /**
   * Hook invoked after the runtime transitions from running to paused.
   *
   * @param {object} context Stop context.
   */
  afterRuntimeStopped() {}

  /**
   * Validate and normalize incoming command objects.
   *
   * @param {object[]} commands Command objects from a client or embedding app.
   * @returns {object[]} Normalized command objects.
   */
  normalizeCommands(commands) {
    if (!Array.isArray(commands) || commands.length === 0) {
      throw createRuntimeError('Commands must be a non-empty array.')
    }
    return commands.map((command) => {
      if (!command || typeof command !== 'object' || Array.isArray(command)) {
        throw createRuntimeError('Each command must be an object.')
      }
      const type = String(command.type || '').trim()
      if (!type) {
        throw createRuntimeError('Each command requires type.')
      }
      return { ...command, type }
    })
  }

  /**
   * Apply runtime commands in receive order and emit an updated snapshot.
   *
   * Runtime-only commands are handled by subclass hooks; all other commands are
   * scheduled into the Universe at the current simulation time.
   *
   * @param {string} sessionId Write session id.
   * @param {object[]} commands Commands to apply.
   * @returns {Promise<object>} Runtime snapshot after command application.
   */
  async applyCommands(sessionId, commands) {
    if (!this.loadedScenario || !this.universe) {
      throw createRuntimeError('No scenario is loaded.', 409)
    }
    if (this.state === 'idle' || this.state === 'error') {
      throw createRuntimeError(`Runtime cannot accept commands from state: ${this.state}`, 409)
    }

    const session = this.resolveWriteSession(sessionId)
    const currentTime = JulianDate.clone(this.clock.currentTime, new JulianDate())
    const normalizedCommands = this.normalizeCommands(commands)
    const translatedCommands = this.translateIncomingCommands(normalizedCommands, session)
    const runtimeCommands = translatedCommands.filter((command) => this.isRuntimeOnlyCommand(command))
    const scheduledCommands = translatedCommands.filter((command) => !this.isRuntimeOnlyCommand(command))

    this.applyRuntimeOnlyCommands(runtimeCommands, { session, currentTime })
    this.scheduleCommands(scheduledCommands, currentTime, { session })
    await this.afterCommandsApplied(translatedCommands, { session, currentTime })
    return this.emitSnapshot('commands')
  }

  /**
   * Hook invoked after commands are translated and scheduled.
   *
   * @param {object[]} commands Translated commands, including runtime-only commands.
   * @param {object} context Command application context.
   */
  async afterCommandsApplied() {}

  /**
   * Return true when a command should be handled by `applyRuntimeOnlyCommands`.
   *
   * @param {object} command Normalized command.
   * @returns {boolean} Whether the command should skip Universe scheduling.
   */
  isRuntimeOnlyCommand() {
    return false
  }

  /**
   * Apply commands that affect runtime/application state rather than Universe state.
   *
   * @param {object[]} commands Runtime-only commands.
   * @param {object} context Command application context.
   */
  applyRuntimeOnlyCommands() {}

  /**
   * Clear the ordered runtime event log and increment the scenario generation.
   */
  resetRuntimeEvents() {
    this.scenarioGeneration += 1
    this.runtimeEventSequence = 0
    this.runtimeEvents = []
  }

  analogGimbalLeaseKey(observer) {
    return String(observer || '').trim()
  }

  analogFsmLeaseKey(observer) {
    return String(observer || '').trim()
  }

  analogZoomLeaseKey(observer, sensor) {
    return `${String(observer || '').trim()}::${String(sensor || '').trim()}`
  }

  /**
   * Remove all active analog-rate command leases.
   */
  clearAnalogLeases() {
    this._analogGimbalLeases.clear()
    this._analogFsmLeases.clear()
    this._analogZoomLeases.clear()
  }

  /**
   * Return true when a command represents continuous analog-rate control.
   *
   * @param {object} command Command to inspect.
   * @returns {boolean} Whether the command is an analog-rate command.
   */
  isAnalogRateCommand(command) {
    return (
      command?.type === 'setGimbalAxisRates' ||
      command?.type === 'setFsmAxisRates' ||
      command?.type === 'setSensorZoomRate'
    )
  }

  /**
   * Find an observatory by site name.
   *
   * @param {string} observerName Observatory/site name.
   * @returns {object|null} Matching observatory, if present.
   */
  getObservatoryByName(observerName) {
    const name = String(observerName || '').trim()
    if (!name) return null
    return this.universe?._observatories?.find((observatory) => observatory?.site?.name === name) ?? null
  }

  /**
   * Return all sensors attached to an observatory.
   *
   * @param {object} observatory Observatory object.
   * @returns {object[]} Sensor objects.
   */
  getObservatorySensors(observatory) {
    if (Array.isArray(observatory?.sensors)) {
      return observatory.sensors.filter(Boolean)
    }
    return observatory?.sensor ? [observatory.sensor] : []
  }

  /**
   * Find a sensor by name, falling back to the first sensor when no name is provided.
   *
   * @param {object} observatory Observatory object.
   * @param {string} sensorName Sensor name.
   * @returns {object|null} Matching sensor, if present.
   */
  getSensorByName(observatory, sensorName) {
    const sensors = this.getObservatorySensors(observatory)
    const desiredName = String(sensorName || '').trim()
    if (!desiredName) {
      return sensors[0] ?? null
    }
    return sensors.find((sensor) => sensor?.name === desiredName) ?? null
  }

  /**
   * Return the fine steering mirror for an observatory.
   *
   * @param {object} observatory Observatory object.
   * @returns {object|null} FSM object, if present.
   */
  getObservatoryFsm(observatory) {
    return observatory?.fsm ?? null
  }

  /**
   * Build absolute stop commands that freeze analog-controlled actuators at their current state.
   *
   * @param {object} options Stop-command options.
   * @returns {object[]} Absolute commands to schedule.
   */
  buildAbsoluteStopCommands({ observer, sensor, includeGimbal = false, includeFsm = false, includeSensor = false, session = null } = {}) {
    const observatory = this.getObservatoryByName(observer)
    if (!observatory) {
      return []
    }

    const commands = []
    const gimbal = observatory.gimbal
    if (includeGimbal && gimbal && observer) {
      const axes = {}
      if (Number.isFinite(gimbal.az)) axes.az = gimbal.az
      if (Number.isFinite(gimbal.el)) axes.el = gimbal.el
      if (Object.keys(axes).length > 0) {
        commands.push(this.withRuntimeSession({
          type: 'setGimbalAxes',
          observer,
          axes
        }, session))
      }
    }

    const fsm = this.getObservatoryFsm(observatory)
    if (includeFsm && fsm && observer) {
      const axes = {}
      if (Number.isFinite(fsm.tip)) axes.tip = fsm.tip
      if (Number.isFinite(fsm.tilt)) axes.tilt = fsm.tilt
      if (Object.keys(axes).length > 0) {
        commands.push(this.withRuntimeSession({
          type: 'setFsmAxes',
          observer,
          axes
        }, session))
      }
    }

    if (includeSensor && sensor) {
      const targetSensor = this.getSensorByName(observatory, sensor)
      const zoomLevel = Number(targetSensor?.zoomLevel)
      if (targetSensor && Number.isFinite(zoomLevel)) {
        commands.push(this.withRuntimeSession({
          type: 'setSensorZoom',
          observer,
          sensor: targetSensor.name,
          zoomLevel
        }, session))
      }
    }

    return commands
  }

  /**
   * Attach internal session metadata to a command for event attribution.
   *
   * @param {object} command Command to annotate.
   * @param {object|null} session Internal session record.
   * @returns {object} Annotated command.
   */
  withRuntimeSession(command, session) {
    if (!session) return command
    return {
      ...command,
      __runtimeSession: session
    }
  }

  /**
   * Update analog-rate leases from incoming rate commands and return any generated stop commands.
   *
   * @param {object[]} commands Analog-rate commands.
   * @param {object|null} session Internal session record.
   * @returns {object[]} Absolute stop commands generated by zero-rate commands.
   */
  updateAnalogLeases(commands, session) {
    const expiresAtMs = this.now() + this.analogLeaseMs
    const translatedCommands = []
    for (const command of commands) {
      if (command?.type === 'setGimbalAxisRates') {
        const key = this.analogGimbalLeaseKey(command.observer)
        if (!key) continue
        const hasActiveRate = Object.values(command.axes ?? {}).some((value) => Number(value) !== 0)
        if (!hasActiveRate) {
          const lease = this._analogGimbalLeases.get(key)
          const hadLease = this._analogGimbalLeases.delete(key)
          if (hadLease) {
            translatedCommands.push(...this.buildAbsoluteStopCommands({
              observer: command.observer,
              includeGimbal: true,
              session: lease?.session ?? session
            }))
          }
          continue
        }
        this._analogGimbalLeases.set(key, {
          observer: command.observer,
          axes: { ...(command.axes ?? {}) },
          expiresAtMs,
          session
        })
        continue
      }

      if (command?.type === 'setFsmAxisRates') {
        const key = this.analogFsmLeaseKey(command.observer)
        if (!key) continue
        const hasActiveRate = Object.values(command.axes ?? {}).some((value) => Number(value) !== 0)
        if (!hasActiveRate) {
          const lease = this._analogFsmLeases.get(key)
          const hadLease = this._analogFsmLeases.delete(key)
          if (hadLease) {
            translatedCommands.push(...this.buildAbsoluteStopCommands({
              observer: command.observer,
              includeFsm: true,
              session: lease?.session ?? session
            }))
          }
          continue
        }
        this._analogFsmLeases.set(key, {
          observer: command.observer,
          axes: { ...(command.axes ?? {}) },
          expiresAtMs,
          session
        })
        continue
      }

      if (command?.type === 'setSensorZoomRate') {
        const key = this.analogZoomLeaseKey(command.observer, command.sensor)
        if (Number(command.zoomRateLevelPerSec) === 0) {
          const lease = this._analogZoomLeases.get(key)
          const hadLease = this._analogZoomLeases.delete(key)
          if (hadLease) {
            translatedCommands.push(...this.buildAbsoluteStopCommands({
              observer: command.observer,
              sensor: command.sensor,
              includeSensor: true,
              session: lease?.session ?? session
            }))
          }
          continue
        }
        this._analogZoomLeases.set(key, {
          observer: command.observer,
          sensor: command.sensor,
          zoomRateLevelPerSec: Number(command.zoomRateLevelPerSec) || 0,
          expiresAtMs,
          session
        })
        continue
      }

      if (command?.type === 'trackObject' || command?.type === 'stepGimbalAxes') {
        this._analogGimbalLeases.delete(this.analogGimbalLeaseKey(command.observer))
        continue
      }

      if (command?.type === 'stepFsmAxes') {
        this._analogFsmLeases.delete(this.analogFsmLeaseKey(command.observer))
        continue
      }

      if (command?.type === 'stepSensorZoom') {
        if (command.sensor) {
          this._analogZoomLeases.delete(this.analogZoomLeaseKey(command.observer, command.sensor))
        } else {
          for (const [key, lease] of this._analogZoomLeases.entries()) {
            if (lease.observer === command.observer) {
              this._analogZoomLeases.delete(key)
            }
          }
        }
      }
    }
    return translatedCommands
  }

  /**
   * Translate incoming commands into scheduled commands plus analog lease state changes.
   *
   * @param {object[]} commands Normalized commands.
   * @param {object|null} session Internal session record.
   * @returns {object[]} Commands to apply immediately.
   */
  translateIncomingCommands(commands, session) {
    const passthroughCommands = []
    const analogCommands = []
    for (const command of commands) {
      if (this.isAnalogRateCommand(command)) {
        analogCommands.push(command)
      } else {
        passthroughCommands.push(command)
      }
    }

    const translatedAnalogCommands = this.updateAnalogLeases(analogCommands, session)
    return [...passthroughCommands, ...translatedAnalogCommands]
  }

  /**
   * Schedule commands into the Universe and record ordered runtime events.
   *
   * @param {object[]} commands Commands to schedule.
   * @param {JulianDate} time Simulation time for the events.
   * @param {object} [options]
   */
  scheduleCommands(commands, time, { session = null, reason = undefined } = {}) {
    if (!this.universe || !Array.isArray(commands) || commands.length === 0) {
      return
    }

    const eventTime = JulianDate.clone(time ?? this.clock.currentTime, new JulianDate())
    this.recordRuntimeEvents(commands, eventTime, session)
    for (const command of commands) {
      const data = stripRuntimeMetadata(command)
      this.universe.scheduleEvent({
        time: JulianDate.clone(eventTime, new JulianDate()),
        type: command.type,
        data
      })
    }
    this.universe.update(eventTime, true)
    if (reason) {
      this.emitSnapshot(reason)
    }
  }

  /**
   * Expire stale analog-rate leases and schedule absolute stop commands.
   *
   * @param {number} nowMs Current wall-clock time in milliseconds.
   */
  expireAnalogLeases(nowMs) {
    if (!this.universe || !this.clock) {
      return
    }

    const commands = []
    for (const [key, lease] of this._analogGimbalLeases.entries()) {
      if (nowMs < lease.expiresAtMs) continue
      this._analogGimbalLeases.delete(key)
      commands.push(...this.buildAbsoluteStopCommands({
        observer: lease.observer,
        includeGimbal: true,
        session: lease.session
      }))
    }

    for (const [key, lease] of this._analogFsmLeases.entries()) {
      if (nowMs < lease.expiresAtMs) continue
      this._analogFsmLeases.delete(key)
      commands.push(...this.buildAbsoluteStopCommands({
        observer: lease.observer,
        includeFsm: true,
        session: lease.session
      }))
    }

    for (const [key, lease] of this._analogZoomLeases.entries()) {
      if (nowMs < lease.expiresAtMs) continue
      this._analogZoomLeases.delete(key)
      commands.push(...this.buildAbsoluteStopCommands({
        observer: lease.observer,
        sensor: lease.sensor,
        includeSensor: true,
        session: lease.session
      }))
    }

    this.scheduleCommands(commands, this.clock.currentTime, { reason: 'analog_lease_expired' })
  }

  /**
   * Stop all active analog-rate motion immediately.
   *
   * @param {object} [options]
   * @returns {void}
   */
  stopAnalogMotion({ reason = 'analog_stop' } = {}) {
    if (!this.universe || !this.clock) {
      this.clearAnalogLeases()
      return
    }

    const commands = []
    for (const lease of this._analogGimbalLeases.values()) {
      commands.push(...this.buildAbsoluteStopCommands({
        observer: lease.observer,
        includeGimbal: true,
        session: lease.session
      }))
    }

    for (const lease of this._analogFsmLeases.values()) {
      commands.push(...this.buildAbsoluteStopCommands({
        observer: lease.observer,
        includeFsm: true,
        session: lease.session
      }))
    }

    for (const lease of this._analogZoomLeases.values()) {
      commands.push(...this.buildAbsoluteStopCommands({
        observer: lease.observer,
        sensor: lease.sensor,
        includeSensor: true,
        session: lease.session
      }))
    }

    this.clearAnalogLeases()
    this.scheduleCommands(commands, this.clock.currentTime, { reason })
  }

  /**
   * Convert active analog-rate leases into absolute commands for the next tick.
   *
   * @param {JulianDate} nextTime Next simulation time.
   * @param {number} deltaSec Simulation seconds since the previous tick.
   * @returns {object[]} Absolute commands to schedule.
   */
  translateActiveAnalogCommands(nextTime, deltaSec) {
    if (!(deltaSec > 0) || !this.universe) {
      return []
    }

    const commands = []
    for (const lease of this._analogGimbalLeases.values()) {
      const observatory = this.getObservatoryByName(lease.observer)
      const gimbal = observatory?.gimbal
      if (!gimbal) continue

      const axes = {}
      for (const [axisName, rawRate] of Object.entries(lease.axes ?? {})) {
        const current = Number(gimbal?.[axisName])
        const rate = Number(rawRate)
        if (!Number.isFinite(current) || !Number.isFinite(rate) || rate === 0) continue
        axes[axisName] = current + (rate * deltaSec)
      }
      if (Object.keys(axes).length > 0) {
        commands.push(this.withRuntimeSession({
          type: 'setGimbalAxes',
          observer: lease.observer,
          axes
        }, lease.session))
      }
    }

    for (const lease of this._analogFsmLeases.values()) {
      const observatory = this.getObservatoryByName(lease.observer)
      const fsm = this.getObservatoryFsm(observatory)
      if (!fsm) continue

      const axes = {}
      for (const [axisName, rawRate] of Object.entries(lease.axes ?? {})) {
        const current = Number(fsm?.[axisName])
        const rate = Number(rawRate)
        if (!Number.isFinite(current) || !Number.isFinite(rate) || rate === 0) continue
        axes[axisName] = current + (rate * deltaSec)
      }
      if (Object.keys(axes).length > 0) {
        commands.push(this.withRuntimeSession({
          type: 'setFsmAxes',
          observer: lease.observer,
          axes
        }, lease.session))
      }
    }

    for (const lease of this._analogZoomLeases.values()) {
      const observatory = this.getObservatoryByName(lease.observer)
      const sensor = this.getSensorByName(observatory, lease.sensor)
      const currentZoomLevel = Number(sensor?.zoomLevel)
      const zoomRateLevelPerSec = Number(lease.zoomRateLevelPerSec)
      if (!sensor || !Number.isFinite(currentZoomLevel) || !Number.isFinite(zoomRateLevelPerSec) || zoomRateLevelPerSec === 0) {
        continue
      }
      commands.push(this.withRuntimeSession({
        type: 'setSensorZoom',
        observer: lease.observer,
        sensor: sensor.name,
        zoomLevel: clamp(currentZoomLevel + (zoomRateLevelPerSec * deltaSec), 0, 1)
      }, lease.session))
    }

    return commands
  }

  /**
   * Append commands to the runtime event log with session attribution.
   *
   * @param {object[]} commands Commands to record.
   * @param {JulianDate} time Simulation time for the events.
   * @param {object|null} fallbackSession Session to use when a command lacks metadata.
   */
  recordRuntimeEvents(commands, time, fallbackSession = null) {
    const timeIso = julianDateToIso(time)
    const receivedAtIso = new Date(this.now()).toISOString()
    for (const command of commands) {
      const session = command.__runtimeSession ?? fallbackSession
      this.runtimeEventSequence += 1
      this.runtimeEvents.push({
        sequence: this.runtimeEventSequence,
        generation: this.scenarioGeneration,
        receivedAtIso,
        timeIso,
        sessionId: session?.sessionId ?? null,
        holderLabel: session?.holderLabel ?? null,
        type: command.type,
        data: stripRuntimeMetadata(command)
      })
    }
  }

  /**
   * Return synchronization metadata for snapshots and event polling.
   *
   * @returns {object} Sync state.
   */
  getSyncState() {
    return {
      mode: this.syncMode,
      scenarioGeneration: this.scenarioGeneration,
      lastEventSequence: this.runtimeEventSequence
    }
  }

  /**
   * Return runtime events after a sequence number for the current or requested generation.
   *
   * @param {object} [options]
   * @returns {{sync: object, events: object[]}} Event polling response.
   */
  getRuntimeEvents({ after = 0, generation = undefined } = {}) {
    const requestedGeneration = Number.isFinite(Number(generation))
      ? Number(generation)
      : this.scenarioGeneration
    const requestedAfter = Math.max(0, Number(after) || 0)
    const generationMatches = requestedGeneration === this.scenarioGeneration

    return {
      sync: this.getSyncState(),
      events: generationMatches
        ? this.runtimeEvents.filter((event) => event.sequence > requestedAfter)
        : [...this.runtimeEvents]
    }
  }

  /**
   * Advance one runtime tick and emit a snapshot update.
   *
   * @returns {Promise<object>} Runtime snapshot after the tick.
   */
  async tick() {
    if (!this.universe || !this.clock) {
      return this.getSnapshot()
    }

    const nowMs = this.now()
    this.expireAnalogLeases(nowMs)
    const currentTime = JulianDate.clone(this.clock.currentTime, new JulianDate())
    const { nextTime, shouldPause } = this.advanceClock(nowMs)
    const deltaSec = JulianDate.secondsDifference(nextTime, currentTime)
    const translatedAnalogCommands = this.translateActiveAnalogCommands(nextTime, deltaSec)
    this.scheduleCommands(translatedAnalogCommands, nextTime)
    this.clock.currentTime = nextTime
    if (translatedAnalogCommands.length === 0) {
      this.universe.update(nextTime)
    }

    if (shouldPause && this.state === 'running') {
      this.clearTimer()
      this.clock.shouldAnimate = false
      this.state = 'paused'
    }

    return this.emitSnapshot(shouldPause ? 'clock_boundary' : 'tick')
  }

  /**
   * Compute the next simulation time from the current clock configuration.
   *
   * @param {number} nowMs Current wall-clock time in milliseconds.
   * @returns {{nextTime: JulianDate, shouldPause: boolean}} Clock advancement result.
   */
  advanceClock(nowMs) {
    const currentTime = JulianDate.clone(this.clock.currentTime, new JulianDate())
    if (this.state !== 'running') {
      return { nextTime: currentTime, shouldPause: false }
    }

    let nextTime
    switch (Number(this.clock.clockStep)) {
      case 0:
        nextTime = JulianDate.addSeconds(
          currentTime,
          Number(this.clock.multiplier) || 1,
          new JulianDate()
        )
        break
      case 2:
        nextTime = JulianDate.fromDate(new Date(nowMs))
        break
      case 1:
      default: {
        const deltaSec = Math.max(0, (nowMs - this._lastWallTimeMs) / 1000)
        nextTime = JulianDate.addSeconds(
          currentTime,
          deltaSec * (Number(this.clock.multiplier) || 1),
          new JulianDate()
        )
        break
      }
    }
    this._lastWallTimeMs = nowMs

    return this.applyClockRange(nextTime)
  }

  /**
   * Apply configured clock-range bounds to a candidate simulation time.
   *
   * @param {JulianDate} nextTime Candidate simulation time.
   * @returns {{nextTime: JulianDate, shouldPause: boolean}} Bounded time result.
   */
  applyClockRange(nextTime) {
    if (!(this.clock.startTime instanceof JulianDate) || !(this.clock.stopTime instanceof JulianDate)) {
      return { nextTime, shouldPause: false }
    }

    const rangeMode = Number(this.clock.clockRange)
    if (rangeMode === 0) {
      return { nextTime, shouldPause: false }
    }

    const startTime = this.clock.startTime
    const stopTime = this.clock.stopTime
    const spanSec = JulianDate.secondsDifference(stopTime, startTime)
    let boundedTime = JulianDate.clone(nextTime, new JulianDate())
    let shouldPause = false

    if (rangeMode === 1) {
      if (JulianDate.lessThan(boundedTime, startTime)) {
        boundedTime = JulianDate.clone(startTime, new JulianDate())
      }
      if (JulianDate.greaterThan(boundedTime, stopTime)) {
        boundedTime = JulianDate.clone(stopTime, new JulianDate())
        shouldPause = true
      }
      return { nextTime: boundedTime, shouldPause }
    }

    if (!(Number.isFinite(spanSec) && spanSec > 0)) {
      return { nextTime: JulianDate.clone(startTime, new JulianDate()), shouldPause: false }
    }

    if (JulianDate.lessThan(boundedTime, startTime) || JulianDate.greaterThan(boundedTime, stopTime)) {
      let offsetSec = JulianDate.secondsDifference(boundedTime, startTime)
      offsetSec = ((offsetSec % spanSec) + spanSec) % spanSec
      boundedTime = JulianDate.addSeconds(startTime, offsetSec, new JulianDate())
    }

    return { nextTime: boundedTime, shouldPause: false }
  }

  /**
   * Schedule the next wall-clock runtime tick when the runtime is running.
   */
  scheduleNextTick() {
    if (this._closed || this.state !== 'running' || this._timer) {
      return
    }

    this._timer = setTimeout(async () => {
      this._timer = null
      if (this._closed || this.state !== 'running') {
        return
      }
      if (this._tickInFlight) {
        this.scheduleNextTick()
        return
      }

      this._tickInFlight = true
      try {
        await this.tick()
      } catch (err) {
        this.handleError(err)
      } finally {
        this._tickInFlight = false
      }

      if (this.state === 'running') {
        this.scheduleNextTick()
      }
    }, this.tickMs)
  }

  /**
   * Clear any pending runtime tick timer.
   */
  clearTimer() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
  }

  /**
   * Move the runtime to error state and publish the error snapshot.
   *
   * @param {unknown} err Error raised by runtime ticking or hooks.
   * @returns {object} Runtime snapshot after entering error state.
   */
  handleError(err) {
    this.clearTimer()
    this.clock.shouldAnimate = false
    this.lastError = String(err?.message ?? err)
    this.state = 'error'
    this.clearAnalogLeases()
    this.resetRuntimeEvents()
    return this.emitSnapshot('error')
  }

  /**
   * Hook for subclasses to add domain-specific fields under `snapshot.runtime`.
   *
   * @returns {object} Runtime extension payload.
   */
  getRuntimeSnapshotExtension() {
    return {}
  }

  /**
   * Emit and return the current runtime snapshot.
   *
   * @param {string} reason Reason label for update subscribers.
   * @returns {object} Runtime snapshot.
   */
  emitSnapshot(reason) {
    const snapshot = this.getSnapshot()
    this.emit('update', { reason, snapshot })
    return snapshot
  }

  /**
   * Build a serializable runtime snapshot.
   *
   * @returns {object} Runtime snapshot.
   */
  getSnapshot() {
    return buildRuntimeSnapshot({
      runtimeId: this.runtimeId,
      state: this.state,
      scenario: this.loadedScenario,
      clock: this.clock,
      universe: this.universe,
      lastError: this.lastError,
      sync: this.getSyncState(),
      sessions: this.sessionManager.snapshot(),
      runtime: this.getRuntimeSnapshotExtension()
    })
  }

  /**
   * Stop timers and release runtime resources.
   */
  close() {
    this._closed = true
    this.clearTimer()
    this.clock.shouldAnimate = false
    if (this.state === 'running') {
      this.state = this.loadedScenario ? 'paused' : 'idle'
    }
    this.clearAnalogLeases()
    this.resetRuntimeEvents()
  }
}

export default SimulationRuntime
