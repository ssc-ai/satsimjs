import fs from 'node:fs'
import path from 'node:path'

import { commandSchemaValidator } from '../src/engine/command/schemaValidator.js'
import {
  buildCommandSchemaArtifacts,
  commandSchemas,
  getRuntimeAnalogCommandType,
  getRuntimeCommandMetadata,
  isRuntimeAnalogCommandType,
  runtimeAnalogCommandMetadataEntries,
  runtimeCommandSchemas,
  scheduledCommandUnionSchema
} from '../src/engine/command/index.js'

const schemaRoot = path.resolve(process.cwd(), 'schemas/command/v1')

describe('command JSON schemas', () => {
  test('checked-in schema artifacts match the JS schema source', () => {
    for (const [relativePath, expected] of buildCommandSchemaArtifacts()) {
      const actual = JSON.parse(fs.readFileSync(path.join(schemaRoot, relativePath), 'utf8'))
      expect(actual).toEqual(expected)
    }
  })

  test('schemas have descriptions and validating examples', () => {
    for (const schema of runtimeCommandSchemas) {
      expect(schema.title).toBeTruthy()
      expect(schema.description.length).toBeGreaterThan(40)
      expect(schema.examples.length).toBeGreaterThan(0)
      Object.values(schema.properties).forEach((property) => {
        expect(property.description).toBeTruthy()
      })

      const validate = commandSchemaValidator.getSchema(schema.$id)
      for (const example of schema.examples) {
        expect(validate(example)).toBe(true)
      }
    }
  })

  test('public command schemas reject unknown fields', () => {
    for (const schema of commandSchemas) {
      const validate = commandSchemaValidator.getSchema(schema.$id)
      expect(validate({ ...schema.examples[0], unknownPublicField: true })).toBe(false)
    }
  })

  test('scheduled command examples validate through the scheduled union schema', () => {
    const validate = commandSchemaValidator.getSchema(scheduledCommandUnionSchema.$id)
    for (const example of scheduledCommandUnionSchema.examples) {
      expect(validate(example)).toBe(true)
    }
  })

  test('command metadata classifies runtime analog command aliases', () => {
    expect(runtimeAnalogCommandMetadataEntries.map((entry) => entry.type)).toEqual([
      'setGimbalAxisRates',
      'setFsmAxisRates',
      'setSensorZoomRate'
    ])
    expect(getRuntimeAnalogCommandType('set_gimbal_axis_rates')).toBe('setGimbalAxisRates')
    expect(getRuntimeAnalogCommandType('set_fsm_axis_rates')).toBe('setFsmAxisRates')
    expect(getRuntimeAnalogCommandType('set_sensor_zoom_rate')).toBe('setSensorZoomRate')
    expect(isRuntimeAnalogCommandType('setGimbalAxes')).toBe(false)
    expect(getRuntimeCommandMetadata('setSensorZoomRate')).toMatchObject({
      type: 'setSensorZoomRate',
      category: 'runtime.analog',
      controller: 'sensorZoom',
      control: 'rate',
      runtimeOnly: true,
      analog: true
    })
    expect(getRuntimeCommandMetadata('setGimbalAxes')).toMatchObject({
      type: 'setGimbalAxes',
      runtimeOnly: false,
      analog: false
    })
  })
})
