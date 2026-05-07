export const commandSchemaVersion = 'satsim.command.v1'

export const COMMAND_SCHEMA_BASE_ID = 'https://satsimjs.org/schemas/command/v1'
export const DEFS_SCHEMA_ID = `${COMMAND_SCHEMA_BASE_ID}/defs.schema.json`

function ref(name) {
  return `${DEFS_SCHEMA_ID}#/definitions/${name}`
}

function cloneSchema(value) {
  return JSON.parse(JSON.stringify(value))
}

function commandMetadata(entry, { runtimeOnly = false } = {}) {
  const aliases = Object.freeze([...(entry.aliases ?? [])])
  return Object.freeze({
    type: entry.type,
    aliases,
    category: entry.category,
    runtimeOnly,
    analog: entry.category === 'runtime.analog',
    controller: entry.controller,
    control: entry.control,
    schema: entry.schema
  })
}

function requiredField(name) {
  return {
    properties: {
      [name]: {}
    },
    required: [name]
  }
}

function typedCommand({
  type,
  aliases = [],
  category,
  controller = undefined,
  control = undefined,
  description,
  properties,
  required = [],
  anyOf = undefined,
  allOf = undefined,
  examples
}) {
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: `${COMMAND_SCHEMA_BASE_ID}/commands/${type}.schema.json`,
    title: type,
    description,
    type: 'object',
    additionalProperties: false,
    required: ['type', ...required],
    properties: {
      type: {
        type: 'string',
        enum: [type, ...aliases],
        description: `Command discriminator. Use canonical '${type}' in newly generated commands.`
      },
      ...properties
    },
    examples
  }
  if (Array.isArray(anyOf) && anyOf.length > 0) {
    schema.anyOf = anyOf
  }
  if (Array.isArray(allOf) && allOf.length > 0) {
    schema.allOf = allOf
  }
  return {
    type,
    aliases,
    category,
    controller,
    control,
    schema
  }
}

function scheduledVariant(entry) {
  const schema = cloneSchema(entry.schema)
  delete schema.$schema
  schema.$id = `${COMMAND_SCHEMA_BASE_ID}/scheduled/${entry.type}.schema.json`
  schema.title = `Scheduled ${entry.type}`
  schema.description = `Scheduled scenario event for ${entry.type}. The time field is either seconds from scenario start or an absolute ISO 8601 date-time string. ${entry.schema.description}`
  schema.required = ['time', ...schema.required]
  schema.properties = {
    time: {
      oneOf: [
        {
          type: 'number',
          description: 'Relative event time in seconds from the scenario start time.'
        },
        {
          type: 'string',
          format: 'date-time',
          description: 'Absolute event time as an ISO 8601 date-time string.'
        }
      ],
      description: 'Scheduled event time.'
    },
    ...schema.properties
  }
  schema.examples = entry.schema.examples.map((example, index) => ({
    time: index === 0 ? 0 : '2026-04-03T16:00:05Z',
    ...example
  }))
  return schema
}

export const defsSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: DEFS_SCHEMA_ID,
  title: 'SatSim Command Shared Definitions',
  description: 'Shared JSON Schema definitions used by SatSim command and scheduled-command contracts.',
  definitions: {
    nonEmptyString: {
      type: 'string',
      minLength: 1,
      description: 'Non-empty string identifier. Whitespace-only values are not valid command targets.'
    },
    nullableObjectName: {
      oneOf: [
        { type: 'string', minLength: 1 },
        { type: 'null' }
      ],
      description: 'Object name, or null to explicitly clear the target.'
    },
    axisMap: {
      type: 'object',
      minProperties: 1,
      additionalProperties: {
        type: 'number',
        description: 'Axis value in degrees for absolute commands, or degrees per command/rate for step and runtime rate commands.'
      },
      description: 'Map of axis names to numeric degree values. Gimbal axes commonly use az/el; FSM axes commonly use tip/tilt.',
      examples: [{ az: 10, el: 20 }, { tip: 0.5, tilt: -0.25 }]
    },
    vector3Array: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'number',
        description: 'Vector component.'
      },
      description: 'Three numeric components.'
    },
    vector3Object: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y', 'z'],
      properties: {
        x: { type: 'number', description: 'X component.' },
        y: { type: 'number', description: 'Y component.' },
        z: { type: 'number', description: 'Z component.' }
      },
      description: 'Object-form vector with x/y/z numeric components.'
    },
    vector3: {
      oneOf: [
        { $ref: '#/definitions/vector3Array' },
        { $ref: '#/definitions/vector3Object' }
      ],
      description: 'Three-component vector accepted as [x, y, z] or {x, y, z}.'
    },
    zoomLevel: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Normalized sensor zoom level from 0 to 1.'
    }
  }
}

const observerProperty = {
  $ref: ref('nonEmptyString'),
  description: 'Observatory/site name that owns the target actuator or sensor.'
}

const sensorProperty = {
  $ref: ref('nonEmptyString'),
  description: 'Sensor or payload name. Omit to use the observatory primary sensor where the command allows it.'
}

const objectSelectorProperties = {
  object: {
    $ref: ref('nonEmptyString'),
    description: 'Canonical target air vehicle object name.'
  },
  vehicle: {
    $ref: ref('nonEmptyString'),
    description: 'Alias for object; accepted for command input compatibility.'
  },
  name: {
    $ref: ref('nonEmptyString'),
    description: 'Alias for object; accepted for command input compatibility.'
  },
  target: {
    $ref: ref('nonEmptyString'),
    description: 'Alias for object; accepted for command input compatibility.'
  }
}

const velocityProperties = {
  velocity_ned: {
    $ref: ref('vector3'),
    description: 'Velocity in North-East-Down meters per second. Canonical snake_case scenario field.'
  },
  velocityNed: {
    $ref: ref('vector3'),
    description: 'Alias for velocity_ned, using camelCase.'
  },
  velocity: {
    $ref: ref('vector3'),
    description: 'Alias for velocity_ned.'
  },
  velocity_enu: {
    $ref: ref('vector3'),
    description: 'Velocity in East-North-Up meters per second; converted to NED before execution.'
  },
  velocityEnu: {
    $ref: ref('vector3'),
    description: 'Alias for velocity_enu, using camelCase.'
  },
  speed: {
    type: 'number',
    description: 'Horizontal speed in meters per second, resolved with heading/direction into NED velocity.'
  },
  horizontal_speed: {
    type: 'number',
    description: 'Alias for speed.'
  },
  ground_speed: {
    type: 'number',
    description: 'Alias for speed.'
  },
  vertical_speed: {
    type: 'number',
    description: 'Vertical speed in meters per second, positive up; converted to NED down component.'
  },
  climb_rate: {
    type: 'number',
    description: 'Alias for vertical_speed.'
  }
}

const accelerationProperties = {
  acceleration_ned: {
    $ref: ref('vector3'),
    description: 'Acceleration in North-East-Down meters per second squared. Canonical snake_case scenario field.'
  },
  accelerationNed: {
    $ref: ref('vector3'),
    description: 'Alias for acceleration_ned, using camelCase.'
  },
  acceleration: {
    $ref: ref('vector3'),
    description: 'Alias for acceleration_ned.'
  },
  acceleration_enu: {
    $ref: ref('vector3'),
    description: 'Acceleration in East-North-Up meters per second squared; converted to NED before execution.'
  },
  accelerationEnu: {
    $ref: ref('vector3'),
    description: 'Alias for acceleration_enu, using camelCase.'
  }
}

const headingProperties = {
  heading: {
    type: 'number',
    description: 'Heading in degrees clockwise from north.'
  },
  direction: {
    type: 'number',
    description: 'Alias for heading.'
  }
}

const objectSelectorAnyOf = ['object', 'vehicle', 'name', 'target'].map(requiredField)

const velocityAnyOf = [
  'velocity_ned',
  'velocityNed',
  'velocity',
  'velocity_enu',
  'velocityEnu',
  'speed',
  'horizontal_speed',
  'ground_speed'
].map(requiredField)

const accelerationAnyOf = [
  'acceleration_ned',
  'accelerationNed',
  'acceleration',
  'acceleration_enu',
  'accelerationEnu'
].map(requiredField)

const headingAnyOf = ['heading', 'direction'].map(requiredField)

export const builtInCommandSchemaEntries = [
  typedCommand({
    type: 'trackObject',
    aliases: ['track_object'],
    category: 'observatory.gimbal',
    description: 'Points an observatory gimbal at a named simulation object. A null target clears tracking, sets the gimbal to fixed mode, and clears active axis targets.',
    required: ['observer', 'target'],
    properties: {
      observer: observerProperty,
      target: {
        $ref: ref('nullableObjectName'),
        description: 'Object name to track, or null to clear gimbal tracking.'
      }
    },
    examples: [
      { type: 'trackObject', observer: 'OBS-1', target: 'Drone-1' },
      { type: 'trackObject', observer: 'OBS-1', target: null }
    ]
  }),
  typedCommand({
    type: 'setGimbalAxes',
    aliases: ['set_gimbal_axes'],
    category: 'observatory.gimbal',
    description: 'Sets absolute gimbal axis targets in degrees and leaves the gimbal in fixed mode. Azimuth targets are normalized to 0-360 degrees.',
    required: ['observer', 'axes'],
    properties: {
      observer: observerProperty,
      axes: {
        $ref: ref('axisMap'),
        description: 'Absolute gimbal axis values in degrees, commonly az and el.'
      }
    },
    examples: [
      { type: 'setGimbalAxes', observer: 'OBS-1', axes: { az: 10, el: 20 } }
    ]
  }),
  typedCommand({
    type: 'stepGimbalAxes',
    aliases: ['step_gimbal_axes'],
    category: 'observatory.gimbal',
    description: 'Steps gimbal axes by degree deltas. Tracking is cleared before the step so manual control has one behavior across clients.',
    required: ['observer'],
    anyOf: [requiredField('axes'), requiredField('deltas')],
    properties: {
      observer: observerProperty,
      axes: {
        $ref: ref('axisMap'),
        description: 'Gimbal axis deltas in degrees, commonly az and el.'
      },
      deltas: {
        $ref: ref('axisMap'),
        description: 'Alias for axes; accepted for step command input compatibility.'
      }
    },
    examples: [
      { type: 'stepGimbalAxes', observer: 'OBS-1', axes: { az: 1, el: -0.5 } }
    ]
  }),
  typedCommand({
    type: 'setFsmAxes',
    aliases: ['set_fsm_axes'],
    category: 'observatory.fsm',
    description: 'Sets absolute fast steering mirror axis targets in degrees.',
    required: ['observer', 'axes'],
    properties: {
      observer: observerProperty,
      axes: {
        $ref: ref('axisMap'),
        description: 'Absolute FSM axis values in degrees, commonly tip and tilt.'
      }
    },
    examples: [
      { type: 'setFsmAxes', observer: 'OBS-1', axes: { tip: 0.1, tilt: -0.2 } }
    ]
  }),
  typedCommand({
    type: 'stepFsmAxes',
    aliases: ['step_fsm_axes'],
    category: 'observatory.fsm',
    description: 'Steps fast steering mirror axes by degree deltas.',
    required: ['observer'],
    anyOf: [requiredField('axes'), requiredField('deltas')],
    properties: {
      observer: observerProperty,
      axes: {
        $ref: ref('axisMap'),
        description: 'FSM axis deltas in degrees, commonly tip and tilt.'
      },
      deltas: {
        $ref: ref('axisMap'),
        description: 'Alias for axes; accepted for step command input compatibility.'
      }
    },
    examples: [
      { type: 'stepFsmAxes', observer: 'OBS-1', axes: { tip: 0.05, tilt: -0.05 } }
    ]
  }),
  typedCommand({
    type: 'setSensorZoom',
    aliases: ['set_sensor_zoom'],
    category: 'observatory.sensor',
    description: 'Sets a zoom-capable sensor to an absolute normalized zoom level. Omit sensor to use the observatory primary sensor.',
    required: ['observer'],
    anyOf: [requiredField('zoomLevel'), requiredField('zoom_level')],
    properties: {
      observer: observerProperty,
      sensor: sensorProperty,
      sensor_name: {
        $ref: ref('nonEmptyString'),
        description: 'Alias for sensor.'
      },
      zoomLevel: {
        $ref: ref('zoomLevel'),
        description: 'Canonical normalized zoom level from 0 to 1.'
      },
      zoom_level: {
        $ref: ref('zoomLevel'),
        description: 'Alias for zoomLevel.'
      }
    },
    examples: [
      { type: 'setSensorZoom', observer: 'OBS-1', sensor: 'Camera', zoomLevel: 0.75 }
    ]
  }),
  typedCommand({
    type: 'stepSensorZoom',
    aliases: ['step_sensor_zoom'],
    category: 'observatory.sensor',
    description: 'Steps a zoom-capable sensor by a normalized zoom-level delta. Omit sensor to use the observatory primary sensor.',
    required: ['observer'],
    anyOf: [requiredField('deltaZoomLevel'), requiredField('delta_zoom_level')],
    properties: {
      observer: observerProperty,
      sensor: sensorProperty,
      sensor_name: {
        $ref: ref('nonEmptyString'),
        description: 'Alias for sensor.'
      },
      deltaZoomLevel: {
        type: 'number',
        description: 'Canonical normalized zoom delta. Positive values zoom in; negative values zoom out.'
      },
      delta_zoom_level: {
        type: 'number',
        description: 'Alias for deltaZoomLevel.'
      }
    },
    examples: [
      { type: 'stepSensorZoom', observer: 'OBS-1', sensor: 'Camera', deltaZoomLevel: -0.1 }
    ]
  }),
  typedCommand({
    type: 'setDirectedEnergyActive',
    aliases: ['set_directed_energy_active'],
    category: 'observatory.payload',
    description: 'Enables or disables a laser directed-energy payload without changing gimbal tracking state.',
    required: ['observer', 'active'],
    properties: {
      observer: observerProperty,
      device: {
        $ref: ref('nonEmptyString'),
        description: 'Canonical directed-energy payload name.'
      },
      sensor: sensorProperty,
      sensor_name: {
        $ref: ref('nonEmptyString'),
        description: 'Alias for sensor.'
      },
      active: {
        type: 'boolean',
        description: 'True to activate the laser payload, false to deactivate it.'
      }
    },
    examples: [
      { type: 'setDirectedEnergyActive', observer: 'OBS-1', device: 'Laser', active: true }
    ]
  }),
  typedCommand({
    type: 'airVehicleManeuver',
    aliases: ['air_vehicle_maneuver'],
    category: 'airVehicle',
    description: 'Applies one or more manual air vehicle state changes. Velocity and acceleration vectors use NED unless an ENU alias is explicitly supplied.',
    allOf: [
      { anyOf: objectSelectorAnyOf },
      { anyOf: [...velocityAnyOf, ...accelerationAnyOf, ...headingAnyOf] }
    ],
    properties: {
      ...objectSelectorProperties,
      ...velocityProperties,
      ...accelerationProperties,
      ...headingProperties
    },
    examples: [
      { type: 'airVehicleManeuver', object: 'Drone-1', velocity_ned: [1, 2, 3], acceleration_ned: [0, 0, 0.1], heading: 90 }
    ]
  }),
  typedCommand({
    type: 'setAirVehicleVelocityNed',
    aliases: ['set_air_vehicle_velocity_ned'],
    category: 'airVehicle',
    description: 'Sets air vehicle velocity in NED meters per second. Speed plus heading may be used to derive horizontal NED velocity.',
    allOf: [
      { anyOf: objectSelectorAnyOf },
      { anyOf: velocityAnyOf }
    ],
    properties: {
      ...objectSelectorProperties,
      ...velocityProperties,
      ...headingProperties
    },
    examples: [
      { type: 'setAirVehicleVelocityNed', object: 'Drone-1', speed: 10, heading: 90 }
    ]
  }),
  typedCommand({
    type: 'setAirVehicleAccelerationNed',
    aliases: ['set_air_vehicle_acceleration_ned'],
    category: 'airVehicle',
    description: 'Sets air vehicle acceleration in NED meters per second squared.',
    allOf: [
      { anyOf: objectSelectorAnyOf },
      { anyOf: accelerationAnyOf }
    ],
    properties: {
      ...objectSelectorProperties,
      ...accelerationProperties
    },
    examples: [
      { type: 'setAirVehicleAccelerationNed', object: 'Drone-1', acceleration_ned: [0, 0, 1] }
    ]
  }),
  typedCommand({
    type: 'setAirVehicleHeading',
    aliases: ['set_air_vehicle_heading'],
    category: 'airVehicle',
    description: 'Sets air vehicle heading in degrees clockwise from north.',
    allOf: [
      { anyOf: objectSelectorAnyOf },
      { anyOf: headingAnyOf }
    ],
    properties: {
      ...objectSelectorProperties,
      ...headingProperties
    },
    examples: [
      { type: 'setAirVehicleHeading', object: 'Drone-1', heading: 180 }
    ]
  })
]

export const runtimeOnlyCommandSchemaEntries = [
  typedCommand({
    type: 'setGimbalAxisRates',
    aliases: ['set_gimbal_axis_rates'],
    category: 'runtime.analog',
    controller: 'gimbal',
    control: 'rate',
    description: 'Starts, updates, or stops continuous runtime gimbal axis-rate control. Rates are degrees per second; zero rates stop the active lease and freeze the actuator at its current state.',
    required: ['observer', 'axes'],
    properties: {
      observer: observerProperty,
      axes: {
        $ref: ref('axisMap'),
        description: 'Gimbal axis rates in degrees per second, commonly az and el.'
      }
    },
    examples: [
      { type: 'setGimbalAxisRates', observer: 'OBS-1', axes: { az: 5, el: 0 } }
    ]
  }),
  typedCommand({
    type: 'setFsmAxisRates',
    aliases: ['set_fsm_axis_rates'],
    category: 'runtime.analog',
    controller: 'fsm',
    control: 'rate',
    description: 'Starts, updates, or stops continuous runtime FSM axis-rate control. Rates are degrees per second; zero rates stop the active lease and freeze the actuator at its current state.',
    required: ['observer', 'axes'],
    properties: {
      observer: observerProperty,
      axes: {
        $ref: ref('axisMap'),
        description: 'FSM axis rates in degrees per second, commonly tip and tilt.'
      }
    },
    examples: [
      { type: 'setFsmAxisRates', observer: 'OBS-1', axes: { tip: 0.25, tilt: -0.25 } }
    ]
  }),
  typedCommand({
    type: 'setSensorZoomRate',
    aliases: ['set_sensor_zoom_rate'],
    category: 'runtime.analog',
    controller: 'sensorZoom',
    control: 'rate',
    description: 'Starts, updates, or stops continuous runtime zoom-rate control for a zoom-capable sensor. Zero rate stops the active lease and freezes current zoom.',
    required: ['observer', 'zoomRateLevelPerSec'],
    properties: {
      observer: observerProperty,
      sensor: sensorProperty,
      sensor_name: {
        $ref: ref('nonEmptyString'),
        description: 'Alias for sensor.'
      },
      zoomRateLevelPerSec: {
        type: 'number',
        description: 'Normalized zoom level change per second. Positive values zoom in; negative values zoom out.'
      },
      zoom_rate_level_per_sec: {
        type: 'number',
        description: 'Alias for zoomRateLevelPerSec.'
      }
    },
    examples: [
      { type: 'setSensorZoomRate', observer: 'OBS-1', sensor: 'Camera', zoomRateLevelPerSec: 0.5 }
    ]
  })
]

function unionSchema({ id, title, description, entries }) {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: id,
    title,
    description,
    oneOf: entries.map((entry) => ({ $ref: entry.schema.$id })),
    examples: entries.flatMap((entry) => entry.schema.examples.slice(0, 1))
  }
}

export const commandSchemaEntries = builtInCommandSchemaEntries
export const runtimeCommandSchemaEntries = [...builtInCommandSchemaEntries, ...runtimeOnlyCommandSchemaEntries]
export const commandSchemas = commandSchemaEntries.map((entry) => entry.schema)
export const runtimeCommandSchemas = runtimeCommandSchemaEntries.map((entry) => entry.schema)

export const commandMetadataEntries = commandSchemaEntries.map((entry) => commandMetadata(entry))
export const runtimeOnlyCommandMetadataEntries = runtimeOnlyCommandSchemaEntries.map((entry) => commandMetadata(entry, {
  runtimeOnly: true
}))
export const runtimeCommandMetadataEntries = [...commandMetadataEntries, ...runtimeOnlyCommandMetadataEntries]
export const runtimeAnalogCommandMetadataEntries = runtimeCommandMetadataEntries.filter((entry) => entry.analog)

export const commandUnionSchema = unionSchema({
  id: `${COMMAND_SCHEMA_BASE_ID}/command.schema.json`,
  title: 'SatSim Command',
  description: 'Union schema for SatSim simulation commands executable by CommandBus.',
  entries: commandSchemaEntries
})

export const runtimeCommandUnionSchema = unionSchema({
  id: `${COMMAND_SCHEMA_BASE_ID}/runtimeCommand.schema.json`,
  title: 'SatSim Runtime Command',
  description: 'Union schema for runtime API commands, including simulation commands and runtime-only control commands.',
  entries: runtimeCommandSchemaEntries
})

export const scheduledCommandSchemas = commandSchemaEntries.map((entry) => scheduledVariant(entry))

export const scheduledCommandUnionSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: `${COMMAND_SCHEMA_BASE_ID}/scheduledCommand.schema.json`,
  title: 'SatSim Scheduled Command',
  description: 'Union schema for scenario events. A scheduled command is a normal command with a time field.',
  oneOf: scheduledCommandSchemas,
  examples: scheduledCommandSchemas.flatMap((schema) => schema.examples.slice(0, 1))
}

const commandSchemaByType = new Map()
runtimeCommandSchemaEntries.forEach((entry) => {
  commandSchemaByType.set(entry.type, entry.schema)
  entry.aliases.forEach((alias) => commandSchemaByType.set(alias, entry.schema))
})

const commandMetadataByType = new Map()
runtimeCommandMetadataEntries.forEach((entry) => {
  commandMetadataByType.set(entry.type, entry)
  entry.aliases.forEach((alias) => commandMetadataByType.set(alias, entry))
})

export function getCommandSchema(type) {
  return commandSchemaByType.get(String(type ?? '').trim())
}

export function getRuntimeCommandSchema(type) {
  return commandSchemaByType.get(String(type ?? '').trim())
}

export function getRuntimeCommandMetadata(type) {
  return commandMetadataByType.get(String(type ?? '').trim())
}

export function getRuntimeAnalogCommandType(type) {
  const metadata = getRuntimeCommandMetadata(type)
  return metadata?.analog ? metadata.type : undefined
}

export function isRuntimeAnalogCommandType(type) {
  return Boolean(getRuntimeAnalogCommandType(type))
}

export function buildCommandSchemaArtifacts() {
  const artifacts = new Map()
  artifacts.set('defs.schema.json', defsSchema)
  artifacts.set('command.schema.json', commandUnionSchema)
  artifacts.set('runtimeCommand.schema.json', runtimeCommandUnionSchema)
  artifacts.set('scheduledCommand.schema.json', scheduledCommandUnionSchema)
  commandSchemaEntries.forEach((entry) => {
    artifacts.set(`commands/${entry.type}.schema.json`, entry.schema)
  })
  runtimeOnlyCommandSchemaEntries.forEach((entry) => {
    artifacts.set(`commands/${entry.type}.schema.json`, entry.schema)
  })
  return artifacts
}
