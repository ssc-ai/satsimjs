import Universe from '../engine/Universe.js'
import {
  createDefaultCommandBus,
  getRuntimeAnalogCommandType
} from '../engine/command/index.js'
import CommandError from '../engine/command/CommandError.js'
import { Cartesian3, JulianDate } from '../cesiumExports.js'
import { createClockContext, loadScenarioRuntime } from '../scenario/index.js'
import { createRuntimeError } from './errors.js'
import SessionManager from './SessionManager.js'
import { buildRuntimeSnapshot } from './snapshot.js'
import { createDefaultControllerRegistry } from './controllers/index.js'

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
 * session enforcement, ordered command/event logging, and runtime control leases.
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
   * @param {object} [options.commandBus] Command bus for discrete simulation commands.
   * @param {object} [options.controllerRegistry] Registry for stateful runtime control commands.
   * @param {() => Universe} [options.createUniverse] Factory used for each scenario load.
   * @param {number} [options.tickMs=40] Wall-clock tick interval in milliseconds.
   * @param {() => number} [options.now=Date.now] Clock used for ticks, events, and leases.
   * @param {SessionManager} [options.sessionManager] Session manager to use.
   * @param {'multi'|'single'|'readOnly'} [options.writePolicy='multi'] Policy for created sessions.
   * @param {boolean} [options.requireWriteSession=true] Whether mutating calls require a write session.
   * @param {number} [options.analogLeaseMs=250] Runtime rate-control lease duration.
   */
  constructor({
    runtimeId = createRuntimeId(),
    scenarioRegistry,
    commandBus = createDefaultCommandBus(),
    controllerRegistry = undefined,
    createUniverse = undefined,
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
    this.commandBus = commandBus
    this.controllerRegistry = controllerRegistry ?? createDefaultControllerRegistry()
    this.createUniverse = createUniverse ?? (() => new Universe({ commandBus: this.commandBus }))
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

    this._timer = null
    this._tickInFlight = false
    this._lastWallTimeMs = 0
    this._closed = false
  }

  get _analogGimbalLeases() {
    return this.controllerRegistry?.get('gimbal')?.leases ?? new Map()
  }

  get _analogFsmLeases() {
    return this.controllerRegistry?.get('fsm')?.leases ?? new Map()
  }

  get _analogZoomLeases() {
    return this.controllerRegistry?.get('sensorZoom')?.leases ?? new Map()
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
    if (this.commandBus && nextUniverse) {
      nextUniverse.commandBus = this.commandBus
    }
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
    const commandItems = normalizedCommands.map((command, index) => ({ command, index }))
    const runtimeCommands = commandItems
      .filter(({ command }) => this.isRuntimeOnlyCommand(command))
      .map(({ command }) => command)
    const controllerCommandItems = commandItems.filter(({ command }) => !this.isRuntimeOnlyCommand(command) && this.isControllerCommand(command))
    const scheduledCommandItems = commandItems.filter(({ command }) => !this.isRuntimeOnlyCommand(command) && !this.isControllerCommand(command))
    const commandContext = this.createCommandContext(currentTime, session, 'runtime')
    const { scheduledPlans, controllerPlans } = this.prepareRuntimeCommandPlans(
      scheduledCommandItems,
      controllerCommandItems,
      commandContext
    )
    const controllerInputPlans = [...scheduledPlans, ...controllerPlans]
      .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
    const controllerCommitPlan = this.controllerRegistry.planPreparedBatch(controllerInputPlans, {
      nowMs: this.now(),
      analogLeaseMs: this.analogLeaseMs
    })
    const translatedControllerPlans = controllerCommitPlan.commandPlans.length === controllerCommitPlan.commandItems.length
      ? controllerCommitPlan.commandPlans
      : this.prepareGeneratedCommandItems(controllerCommitPlan.commandItems, commandContext)
    const executionPlans = [...scheduledPlans, ...translatedControllerPlans]
      .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))

    this.applyRuntimeOnlyCommands(runtimeCommands, { session, currentTime })
    this.controllerRegistry.commit(controllerCommitPlan)
    this.schedulePreparedCommands(executionPlans, currentTime, {
      session,
      source: 'runtime'
    })
    await this.afterCommandsApplied([
      ...runtimeCommands,
      ...executionPlans.map((plan) => plan.command)
    ], { session, currentTime })
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

  /**
   * Remove all active runtime control leases.
   */
  clearAnalogLeases() {
    this.controllerRegistry.clear()
  }

  /**
   * Return true when a command is handled by a runtime controller.
   *
   * @param {object} command Command to inspect.
   * @returns {boolean} Whether the command is a controller command.
   */
  isControllerCommand(command) {
    return this.controllerRegistry.isControllerCommand(command)
  }

  /**
   * Return true when a command represents continuous analog-rate control.
   *
   * @param {object} command Command to inspect.
   * @returns {boolean} Whether the command is an analog-rate command.
   */
  isAnalogRateCommand(command) {
    return this.isControllerCommand(command) && Boolean(getRuntimeAnalogCommandType(command?.type))
  }

  throwCommandBatchError(errors) {
    const orderedErrors = [...errors].sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
    const statusCode = orderedErrors.some((error) => Number(error.statusCode) === 409) ? 409 : 400
    throw new CommandError('Command batch validation failed.', {
      code: 'COMMAND_BATCH_INVALID',
      statusCode,
      errors: orderedErrors.map((error) => error.toJSON())
    })
  }

  prepareRuntimeCommandPlans(scheduledItems, controllerItems, context = {}) {
    const scheduledPlans = []
    const controllerPlans = []
    const errors = []
    scheduledItems.forEach(({ command, index }) => {
      try {
        scheduledPlans.push(this.commandBus.prepare(command, context, index))
      } catch (error) {
        errors.push(CommandError.from(error, {
          type: command?.type,
          index,
          statusCode: error?.statusCode ?? 400
        }))
      }
    })
    controllerItems.forEach(({ command, index }) => {
      try {
        controllerPlans.push(this.controllerRegistry.prepare(command, context, index))
      } catch (error) {
        errors.push(CommandError.from(error, {
          type: command?.type,
          index,
          statusCode: error?.statusCode ?? 400
        }))
      }
    })

    if (errors.length > 0) {
      this.throwCommandBatchError(errors)
    }

    return { scheduledPlans, controllerPlans }
  }

  prepareGeneratedCommandItems(items, context = {}) {
    return this.prepareCommandItems(items, context)
  }

  prepareCommandItems(items, context = {}) {
    const plans = []
    const errors = []
    items.forEach(({ command, index }) => {
      try {
        plans.push(this.commandBus.prepare(command, context, index))
      } catch (error) {
        errors.push(CommandError.from(error, {
          type: command?.type,
          index,
          statusCode: error?.statusCode ?? 400
        }))
      }
    })

    if (errors.length > 0) {
      this.throwCommandBatchError(errors)
    }

    return plans
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
   * Build command execution context for the shared command bus.
   *
   * @param {JulianDate} time Simulation time.
   * @param {object|null} session Runtime session, if any.
   * @param {string} source Command source label.
   * @returns {object} Command context.
   */
  createCommandContext(time, session = null, source = 'runtime') {
    return {
      universe: this.universe,
      time,
      source,
      session,
      commandBus: this.commandBus,
      controllerRegistry: this.controllerRegistry
    }
  }

  /**
   * Schedule commands into the Universe and record ordered runtime events.
   *
   * @param {object[]} commands Commands to schedule.
   * @param {JulianDate} time Simulation time for the events.
   * @param {object} [options]
   */
  scheduleCommands(commands, time, { session = null, reason = undefined, source = 'runtime' } = {}) {
    if (!this.universe || !Array.isArray(commands) || commands.length === 0) {
      return
    }

    const eventTime = JulianDate.clone(time ?? this.clock.currentTime, new JulianDate())
    const commandContext = this.createCommandContext(eventTime, session, source)
    this.schedulePreparedCommands(this.commandBus.prepareBatch(commands, commandContext), eventTime, {
      session,
      reason
    })
  }

  schedulePreparedCommands(plans, time, { session = null, reason = undefined } = {}) {
    if (!this.universe || !Array.isArray(plans) || plans.length === 0) {
      return
    }

    const eventTime = JulianDate.clone(time ?? this.clock.currentTime, new JulianDate())
    const commandsToExecute = plans.map((plan) => plan.command)
    this.recordRuntimeEvents(commandsToExecute, eventTime, session)
    this.commandBus.executePreparedBatch(plans)
    this.universe.update(eventTime, true)
    if (reason) {
      this.emitSnapshot(reason)
    }
  }

  /**
   * Expire stale runtime control leases and schedule absolute stop commands.
   *
   * @param {number} nowMs Current wall-clock time in milliseconds.
   */
  expireAnalogLeases(nowMs) {
    if (!this.universe || !this.clock) {
      return
    }

    const commands = this.controllerRegistry.expire({
      universe: this.universe,
      time: this.clock.currentTime,
      nowMs
    })

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

    const commands = this.controllerRegistry.stopAll({
      universe: this.universe,
      time: this.clock.currentTime
    })
    this.scheduleCommands(commands, this.clock.currentTime, { reason })
  }

  /**
   * Convert active runtime control leases into absolute commands for the next tick.
   *
   * @param {JulianDate} nextTime Next simulation time.
   * @param {number} deltaSec Simulation seconds since the previous tick.
   * @returns {object[]} Absolute commands to schedule.
   */
  translateActiveAnalogCommands(nextTime, deltaSec) {
    return this.controllerRegistry.tick({
      universe: this.universe,
      time: nextTime,
      deltaSec
    })
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
