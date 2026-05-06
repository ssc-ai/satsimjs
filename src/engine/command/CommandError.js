/**
 * Error raised by command validation or execution.
 */
class CommandError extends Error {
  constructor(message, {
    type = undefined,
    index = undefined,
    code = 'COMMAND_ERROR',
    statusCode = 400,
    errors = undefined,
    cause = undefined
  } = {}) {
    super(message)
    this.name = 'CommandError'
    this.type = type ?? null
    this.index = Number.isInteger(index) ? index : null
    this.code = String(code || 'COMMAND_ERROR')
    this.statusCode = Number.isFinite(Number(statusCode)) ? Number(statusCode) : 400
    if (Array.isArray(errors)) {
      this.errors = errors
    }
    if (cause !== undefined) {
      this.cause = cause
    }
  }

  toJSON() {
    return {
      index: this.index,
      type: this.type,
      code: this.code,
      statusCode: this.statusCode,
      message: this.message
    }
  }

  static from(error, fallback = {}) {
    if (error instanceof CommandError) {
      return new CommandError(error.message, {
        type: error.type ?? fallback.type,
        index: error.index ?? fallback.index,
        code: error.code,
        statusCode: error.statusCode,
        errors: error.errors,
        cause: error.cause
      })
    }

    return new CommandError(String(error?.message ?? error), {
      type: fallback.type,
      index: fallback.index,
      code: fallback.code ?? 'COMMAND_ERROR',
      statusCode: fallback.statusCode ?? 400,
      cause: error
    })
  }
}

export default CommandError
