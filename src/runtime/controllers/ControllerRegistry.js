import CommandError from '../../engine/command/CommandError.js'
import { validateSchema } from '../../engine/command/schemaValidator.js'

function normalizeKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

function commandType(command) {
  return String(command?.type ?? '').trim()
}

function commandItem(item, fallbackIndex) {
  if (item && typeof item === 'object' && !Array.isArray(item) && Object.prototype.hasOwnProperty.call(item, 'command')) {
    return {
      command: item.command,
      index: Number.isInteger(item.index) ? item.index : fallbackIndex
    }
  }
  return {
    command: item,
    index: fallbackIndex
  }
}

function isControllerPlan(plan) {
  return Boolean(plan?.controller && typeof plan?.definition?.apply === 'function')
}

function observesCommand(controller, command) {
  if (typeof controller?.observeCommand !== 'function') {
    return false
  }
  const observedTypes = controller.observedCommandTypes
  if (!observedTypes) {
    return true
  }
  const type = normalizeKey(command?.type)
  if (!type) {
    return false
  }
  if (typeof observedTypes.has === 'function' && observedTypes.has(type)) {
    return true
  }
  if (typeof observedTypes[Symbol.iterator] === 'function') {
    return Array.from(observedTypes).some((observedType) => normalizeKey(observedType) === type)
  }
  return false
}

function controllerState(controller, controllerStates) {
  let state = controllerStates.get(controller)
  if (!state) {
    state = typeof controller.cloneState === 'function' ? controller.cloneState() : {}
    controllerStates.set(controller, state)
  }
  return state
}

function generatedCommandItems(generated, index) {
  const generatedCommands = Array.isArray(generated)
    ? generated
    : (generated ? [generated] : [])
  return generatedCommands.map((command) => ({ command, index }))
}

function prepareGeneratedCommand(item, planContext) {
  if (typeof planContext.commandBus?.prepare !== 'function') {
    return {
      item,
      plan: null,
      observePlan: item
    }
  }
  const plan = planContext.commandBus.prepare(item.command, planContext, item.index)
  return {
    item: {
      command: plan.command,
      index: plan.index
    },
    plan,
    observePlan: plan
  }
}

function observerReturnedCommands(output) {
  if (Array.isArray(output)) {
    return output.length > 0
  }
  return Boolean(output)
}

function observeCommand(plan, planContext, controllers, controllerStates) {
  for (const controller of controllers) {
    if (!observesCommand(controller, plan.command)) continue
    const state = controllerState(controller, controllerStates)
    const output = controller.observeCommand(plan.command, planContext, state, plan.resolved)
    if (observerReturnedCommands(output)) {
      throw new CommandError(`Controller '${controller.name}' observeCommand() must not return commands.`, {
        type: plan.command?.type,
        index: plan.index,
        code: 'CONTROLLER_OBSERVER_OUTPUT_UNSUPPORTED',
        statusCode: 400
      })
    }
  }
}

function emitGeneratedCommands(commandItems, commandPlans, generated, plan, planContext, controllers, controllerStates) {
  generatedCommandItems(generated, plan.index).forEach((item) => {
    const prepared = prepareGeneratedCommand(item, planContext)
    commandItems.push(prepared.item)
    if (prepared.plan) {
      commandPlans.push(prepared.plan)
    }
    observeCommand(prepared.observePlan, planContext, controllers, controllerStates)
  })
}

function batchError(errors) {
  const orderedErrors = [...errors].sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
  const statusCode = orderedErrors.some((error) => Number(error.statusCode) === 409) ? 409 : 400
  throw new CommandError('Controller command batch validation failed.', {
    code: 'COMMAND_BATCH_INVALID',
    statusCode,
    errors: orderedErrors.map((error) => error.toJSON())
  })
}

/**
 * Registry and execution planner for stateful runtime controllers.
 */
class ControllerRegistry {
  constructor({ controllers = [] } = {}) {
    this._controllers = new Map()
    this._commands = new Map()
    controllers.forEach((controller) => this.register(controller))
  }

  register(controller) {
    if (!controller || typeof controller !== 'object' || Array.isArray(controller)) {
      throw new CommandError('Controller definition must be an object.', {
        code: 'CONTROLLER_DEFINITION_INVALID'
      })
    }

    const name = String(controller.name ?? '').trim()
    if (!name) {
      throw new CommandError('Controller definition requires name.', {
        code: 'CONTROLLER_NAME_REQUIRED'
      })
    }

    const definitions = controller.commandDefinitions ?? controller.commands
    if (!Array.isArray(definitions)) {
      throw new CommandError(`Controller '${name}' requires commandDefinitions.`, {
        code: 'CONTROLLER_COMMANDS_REQUIRED'
      })
    }

    const replacedController = this.get(name)
    const normalizedDefinitions = definitions.map((definition) => {
      const type = String(definition?.type ?? '').trim()
      if (!type) {
        throw new CommandError(`Controller '${name}' has a command definition without type.`, {
          code: 'CONTROLLER_COMMAND_TYPE_REQUIRED'
        })
      }
      if (typeof definition.apply !== 'function') {
        throw new CommandError(`Controller command '${type}' requires apply().`, {
          type,
          code: 'CONTROLLER_COMMAND_APPLY_REQUIRED'
        })
      }
      return {
        ...definition,
        type,
        aliases: Array.isArray(definition.aliases) ? definition.aliases : []
      }
    })

    normalizedDefinitions.forEach((definition) => {
      const keys = [definition.type, ...definition.aliases]
      keys.forEach((key) => {
        const normalizedKey = normalizeKey(key)
        if (!normalizedKey) return
        const existing = this._commands.get(normalizedKey)
        if (existing && existing.controller !== replacedController && existing.controller !== controller) {
          throw new CommandError(`Controller command '${key}' is already registered.`, {
            type: definition.type,
            code: 'CONTROLLER_COMMAND_CONFLICT'
          })
        }
      })
    })

    this.unregister(name)
    this._controllers.set(normalizeKey(name), controller)
    normalizedDefinitions.forEach((definition) => {
      const keys = [definition.type, ...definition.aliases]
      keys.forEach((key) => {
        const normalizedKey = normalizeKey(key)
        if (normalizedKey) {
          this._commands.set(normalizedKey, { controller, definition })
        }
      })
    })
    return controller
  }

  unregister(name) {
    const controller = this.get(name)
    if (!controller) {
      return false
    }
    this._controllers.delete(normalizeKey(name))
    for (const [key, entry] of this._commands.entries()) {
      if (entry.controller === controller) {
        this._commands.delete(key)
      }
    }
    return true
  }

  get(name) {
    const key = normalizeKey(name)
    return key ? this._controllers.get(key) : undefined
  }

  getCommandDefinition(type) {
    return this._commands.get(normalizeKey(type))?.definition
  }

  getCommandController(type) {
    return this._commands.get(normalizeKey(type))?.controller
  }

  isControllerCommand(command) {
    return Boolean(this.getCommandDefinition(command?.type))
  }

  prepare(command, context = {}, index = undefined) {
    if (!command || typeof command !== 'object' || Array.isArray(command)) {
      throw new CommandError('Controller command must be an object.', {
        index,
        code: 'COMMAND_INVALID',
        statusCode: 400
      })
    }

    const type = commandType(command)
    if (!type) {
      throw new CommandError('Controller command requires type.', {
        index,
        code: 'COMMAND_TYPE_REQUIRED',
        statusCode: 400
      })
    }

    const entry = this._commands.get(normalizeKey(type))
    if (!entry) {
      throw new CommandError(`Unknown controller command type: ${type}`, {
        type,
        index,
        code: 'COMMAND_UNKNOWN',
        statusCode: 400
      })
    }

    const { controller, definition } = entry
    validateSchema(definition.schema, { ...command, type }, {
      type: definition.type,
      index
    })

    const commandContext = { ...context, controllerRegistry: this }
    let normalized = { ...command, type: definition.type }
    if (typeof definition.normalize === 'function') {
      normalized = definition.normalize(normalized, commandContext)
      if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
        throw new CommandError(`Controller command '${definition.type}' normalize() must return an object.`, {
          type: definition.type,
          index,
          code: 'COMMAND_NORMALIZE_INVALID',
          statusCode: 400
        })
      }
      normalized = { ...normalized, type: definition.type }
    }

    let resolved
    try {
      resolved = definition.resolve?.(normalized, commandContext)
      definition.validate?.(normalized, commandContext, resolved)
    } catch (error) {
      throw CommandError.from(error, {
        type: normalized.type,
        index,
        statusCode: error?.statusCode ?? 400
      })
    }

    return {
      command: normalized,
      controller,
      definition,
      resolved,
      context: commandContext,
      index: Number.isInteger(index) ? index : null
    }
  }

  prepareBatch(commandItems, context = {}) {
    if (!Array.isArray(commandItems)) {
      throw new CommandError('Controller commands must be an array.', {
        code: 'COMMAND_BATCH_INVALID',
        statusCode: 400
      })
    }

    const plans = []
    const errors = []
    commandItems.forEach((item, fallbackIndex) => {
      const { command, index } = commandItem(item, fallbackIndex)
      try {
        plans.push(this.prepare(command, context, index))
      } catch (error) {
        errors.push(CommandError.from(error, {
          type: commandType(command) || undefined,
          index,
          statusCode: error?.statusCode ?? 400
        }))
      }
    })

    if (errors.length > 0) {
      batchError(errors)
    }

    return plans
  }

  planPreparedBatch(plans, context = {}) {
    const controllerStates = new Map()
    const commandItems = []
    const commandPlans = []
    const errors = []
    const controllers = Array.from(this._controllers.values())

    plans.forEach((plan) => {
      try {
        const planContext = {
          ...plan.context,
          ...context,
          controllerRegistry: this
        }
        if (isControllerPlan(plan)) {
          const state = controllerState(plan.controller, controllerStates)
          emitGeneratedCommands(
            commandItems,
            commandPlans,
            plan.definition.apply(plan.command, planContext, plan.resolved, state),
            plan,
            planContext,
            controllers,
            controllerStates
          )
          return
        }

        observeCommand(plan, planContext, controllers, controllerStates)
      } catch (error) {
        errors.push(CommandError.from(error, {
          type: plan.command?.type,
          index: plan.index,
          statusCode: error?.statusCode ?? 400
        }))
      }
    })

    if (errors.length > 0) {
      batchError(errors)
    }

    return {
      controllerStates,
      commandItems,
      commandPlans,
      commands: commandItems.map((item) => item.command)
    }
  }

  commit(plan) {
    if (!plan?.controllerStates) {
      return
    }
    for (const [controller, state] of plan.controllerStates.entries()) {
      controller.commit?.(state)
    }
  }

  tick(context = {}) {
    const commands = []
    for (const controller of this._controllers.values()) {
      const generated = controller.tick?.(context)
      if (Array.isArray(generated)) {
        commands.push(...generated)
      }
    }
    return commands
  }

  expire(context = {}) {
    const commands = []
    for (const controller of this._controllers.values()) {
      const generated = controller.expire?.(context)
      if (Array.isArray(generated)) {
        commands.push(...generated)
      }
    }
    return commands
  }

  stopAll(context = {}) {
    const commands = []
    for (const controller of this._controllers.values()) {
      const generated = controller.stopAll?.(context)
      if (Array.isArray(generated)) {
        commands.push(...generated)
      }
    }
    return commands
  }

  clear() {
    for (const controller of this._controllers.values()) {
      controller.clear?.()
    }
  }
}

export default ControllerRegistry
