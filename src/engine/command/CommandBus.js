import CommandError from './CommandError.js'

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

  normalize(command, context = {}, index = undefined) {
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

    let normalized = { ...command, type: definition.type }
    if (typeof definition.normalize === 'function') {
      normalized = definition.normalize(normalized, { ...context, commandBus: this })
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
    return normalized
  }

  validate(command, context = {}, index = undefined) {
    const normalized = this.normalize(command, context, index)
    const definition = this.get(normalized.type)
    try {
      definition.validate?.(normalized, { ...context, commandBus: this })
    } catch (error) {
      throw CommandError.from(error, {
        type: normalized.type,
        index,
        statusCode: error?.statusCode ?? 400
      })
    }
    return normalized
  }

  validateBatch(commands, context = {}) {
    if (!Array.isArray(commands)) {
      throw new CommandError('Commands must be an array.', {
        code: 'COMMAND_BATCH_INVALID',
        statusCode: 400
      })
    }

    const normalizedCommands = []
    const errors = []
    commands.forEach((command, index) => {
      try {
        normalizedCommands.push(this.validate(command, context, index))
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

    return normalizedCommands
  }

  execute(command, context = {}, options = {}) {
    const normalized = options.validate === false
      ? { ...command }
      : this.validate(command, context, options.index)
    const definition = this.get(normalized.type)
    if (!definition) {
      throw new CommandError(`Unknown command type: ${normalized.type}`, {
        type: normalized.type,
        index: options.index,
        code: 'COMMAND_UNKNOWN',
        statusCode: 400
      })
    }
    return definition.execute(normalized, { ...context, commandBus: this })
  }

  executeBatch(commands, context = {}, options = {}) {
    const normalizedCommands = options.validate === false
      ? commands
      : this.validateBatch(commands, context)
    return normalizedCommands.map((command, index) => {
      return this.execute(command, context, {
        validate: false,
        index
      })
    })
  }
}

export default CommandBus
