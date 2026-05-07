import Ajv from 'ajv'
import addFormats from 'ajv-formats'

import CommandError from './CommandError.js'
import {
  defsSchema,
  getRuntimeCommandSchema,
  runtimeCommandSchemas,
  scheduledCommandUnionSchema
} from './schemas.js'

const INTERNAL_COMMAND_FIELDS = new Set(['__runtimeSession'])

export function stripInternalCommandFields(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    return command
  }
  const out = {}
  Object.keys(command).forEach((key) => {
    if (!INTERNAL_COMMAND_FIELDS.has(key)) {
      out[key] = command[key]
    }
  })
  return out
}

export function createSchemaValidator(schemas = []) {
  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    strictRequired: true,
    validateSchema: true
  })
  addFormats(ajv)
  ajv.addSchema(defsSchema)
  schemas.forEach((schema) => ajv.addSchema(schema))
  return ajv
}

export const commandSchemaValidator = createSchemaValidator([
  ...runtimeCommandSchemas,
  scheduledCommandUnionSchema
])

function schemaErrorDetails(errors = []) {
  return errors.map((error) => ({
    path: error.instancePath || '/',
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message,
    params: error.params
  }))
}

export function validateSchema(schema, value, {
  type = value?.type,
  index = undefined,
  statusCode = 400,
  message = 'Command schema validation failed.'
} = {}) {
  if (!schema) {
    return value
  }

  const publicValue = stripInternalCommandFields(value)
  const validate = commandSchemaValidator.getSchema(schema.$id) ?? commandSchemaValidator.compile(schema)
  if (!validate(publicValue)) {
    throw new CommandError(message, {
      type,
      index,
      code: 'COMMAND_SCHEMA_INVALID',
      statusCode,
      errors: schemaErrorDetails(validate.errors)
    })
  }
  return publicValue
}

export function validateCommandShape(command, options = {}) {
  const schema = getRuntimeCommandSchema(command?.type)
  return validateSchema(schema, command, options)
}

export function validateScheduledCommandShape(command, options = {}) {
  return validateSchema(scheduledCommandUnionSchema, command, {
    ...options,
    message: 'Scheduled command schema validation failed.'
  })
}
