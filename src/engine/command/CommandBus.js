import CommandError from './CommandError.js'
import { validateSchema } from './schemaValidator.js'

function normalizeType(type) {
  return String(type ?? '').trim().toLowerCase()
}

function commandType(command) {
  return String(command?.type ?? '').trim()
}

/**
 * Registry and execution facade for SatSim commands.
 */
class CommandBus {
  constructor({ commands = [] } = {}) {
    this._commands = new Map()
    commands.forEach((command) => this.register(command))
  }

  register(definition) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new CommandError('Command definition must be an object.', {
        code: 'COMMAND_DEFINITION_INVALID'
      })
    }

    const type = String(definition.type ?? '').trim()
    if (!type) {
      throw new CommandError('Command definition requires type.', {
        code: 'COMMAND_TYPE_REQUIRED'
      })
    }
    if (typeof definition.execute !== 'function') {
      throw new CommandError(`Command '${type}' requires execute().`, {
        type,
        code: 'COMMAND_EXECUTE_REQUIRED'
      })
    }

    const normalizedDefinition = {
      ...definition,
      type
    }
    const keys = [type, ...(Array.isArray(definition.aliases) ? definition.aliases : [])]
    keys.forEach((key) => {
      const normalizedKey = normalizeType(key)
      if (normalizedKey) {
        this._commands.set(normalizedKey, normalizedDefinition)
      }
    })
    return normalizedDefinition
  }

  unregister(type) {
    const definition = this.get(type)
    if (!definition) {
      return false
    }
    const keys = [definition.type, ...(Array.isArray(definition.aliases) ? definition.aliases : [])]
    keys.forEach((key) => this._commands.delete(normalizeType(key)))
    return true
  }

  get(type) {
    const key = normalizeType(type)
    return key ? this._commands.get(key) : undefined
  }

  prepare(command, context = {}, index = undefined) {
    if (!command || typeof command !== 'object' || Array.isArray(command)) {
      throw new CommandError('Command must be an object.', {
        index,
        code: 'COMMAND_INVALID',
        statusCode: 400
      })
    }

    const type = commandType(command)
    if (!type) {
      throw new CommandError('Command requires type.', {
        index,
        code: 'COMMAND_TYPE_REQUIRED',
        statusCode: 400
      })
    }

    const definition = this.get(type)
    if (!definition) {
      throw new CommandError(`Unknown command type: ${type}`, {
        type,
        index,
        code: 'COMMAND_UNKNOWN',
        statusCode: 400
      })
    }

    validateSchema(definition.schema, { ...command, type }, {
      type: definition.type,
      index
    })

    const commandContext = { ...context, commandBus: this }
    let normalized = { ...command, type: definition.type }
    if (typeof definition.normalize === 'function') {
      normalized = definition.normalize(normalized, commandContext)
      if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
        throw new CommandError(`Command '${definition.type}' normalize() must return an object.`, {
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
      definition,
      resolved,
      context: commandContext,
      index: Number.isInteger(index) ? index : null
    }
  }

  normalize(command, context = {}, index = undefined) {
    return this.prepare(command, context, index).command
  }

  validate(command, context = {}, index = undefined) {
    return this.prepare(command, context, index).command
  }

  prepareBatch(commands, context = {}) {
    if (!Array.isArray(commands)) {
      throw new CommandError('Commands must be an array.', {
        code: 'COMMAND_BATCH_INVALID',
        statusCode: 400
      })
    }

    const plans = []
    const errors = []
    commands.forEach((command, index) => {
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
      const statusCode = errors.some((error) => Number(error.statusCode) === 409) ? 409 : 400
      throw new CommandError('Command batch validation failed.', {
        code: 'COMMAND_BATCH_INVALID',
        statusCode,
        errors: errors.map((error) => error.toJSON())
      })
    }

    return plans
  }

  validateBatch(commands, context = {}) {
    return this.prepareBatch(commands, context).map((plan) => plan.command)
  }

  execute(command, context = {}, options = {}) {
    if (options.validate !== false) {
      return this.executePrepared(this.prepare(command, context, options.index))
    }

    const normalized = { ...command }
    const definition = this.get(normalized.type)
    if (!definition) {
      throw new CommandError(`Unknown command type: ${normalized.type}`, {
        type: normalized.type,
        index: options.index,
        code: 'COMMAND_UNKNOWN',
        statusCode: 400
      })
    }
    const commandContext = { ...context, commandBus: this }
    const resolved = definition.resolve?.(normalized, commandContext)
    return definition.execute(normalized, commandContext, resolved)
  }

  executeBatch(commands, context = {}, options = {}) {
    if (options.validate === false) {
      return commands.map((command, index) => this.execute(command, context, {
        validate: false,
        index
      }))
    }
    return this.executePreparedBatch(this.prepareBatch(commands, context))
  }

  executePrepared(plan) {
    return plan.definition.execute(plan.command, plan.context, plan.resolved)
  }

  executePreparedBatch(plans) {
    return plans.map((plan) => this.executePrepared(plan))
  }
}

export default CommandBus
