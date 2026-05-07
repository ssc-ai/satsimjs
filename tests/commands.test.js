import { jest } from '@jest/globals'
import { Cartesian3, JulianDate } from 'cesium'

import CommandBus from '../src/engine/command/CommandBus.js'
import CommandError from '../src/engine/command/CommandError.js'
import { createDefaultCommandBus } from '../src/engine/command/index.js'

function createCommandContext() {
  const target = { name: 'Target', update: jest.fn() }
  const vehicle = {
    name: 'Drone',
    velocityNed: new Cartesian3(),
    accelerationNed: new Cartesian3(),
    heading: 0,
    update: jest.fn()
  }
  const gimbal = {
    name: 'Gimbal',
    trackMode: 'fixed',
    trackObject: null,
    az: 0,
    el: 90,
    clearAxisTargets: jest.fn(),
    setAxisTarget(axis, value) {
      this[axis] = value
    },
    stepAxisTarget(axis, delta, current) {
      this[axis] = current + delta
    }
  }
  const fsm = {
    name: 'FSM',
    tip: 0,
    tilt: 0,
    setAxisTarget(axis, value) {
      this[axis] = value
    },
    stepAxisTarget(axis, delta, current) {
      this[axis] = current + delta
    }
  }
  const camera = {
    name: 'Camera',
    zoomLevel: 0.25,
    setZoomLevel: jest.fn(function setZoomLevel(level) {
      this.zoomLevel = level
    }),
    stepZoomLevel: jest.fn(function stepZoomLevel(delta) {
      this.zoomLevel += delta
    })
  }
  const laser = {
    name: 'HEL',
    type: 'Laser',
    active: false
  }
  const observatory = {
    name: 'OBS',
    site: { name: 'OBS' },
    gimbal,
    fsm,
    sensor: camera,
    sensors: [camera, laser]
  }
  const universe = {
    _observatories: [observatory],
    getObject: jest.fn((name) => {
      if (name === 'Target') return target
      if (name === 'Drone') return vehicle
      return undefined
    })
  }
  const time = new JulianDate()
  return {
    context: { universe, time, source: 'test' },
    target,
    vehicle,
    gimbal,
    fsm,
    camera,
    laser
  }
}

describe('CommandBus built-in commands', () => {
  test('executes built-in observatory, sensor, laser, and air vehicle commands', () => {
    const commandBus = createDefaultCommandBus()
    const {
      context,
      target,
      vehicle,
      gimbal,
      fsm,
      camera,
      laser
    } = createCommandContext()

    commandBus.executeBatch([
      { type: 'trackObject', observer: 'OBS', target: 'Target' },
      { type: 'setGimbalAxes', observer: 'OBS', axes: { az: 10, el: 20 } },
      { type: 'stepGimbalAxes', observer: 'OBS', axes: { az: 5, el: -3 } },
      { type: 'setFsmAxes', observer: 'OBS', axes: { tip: 1, tilt: 2 } },
      { type: 'stepFsmAxes', observer: 'OBS', axes: { tip: 0.5, tilt: -0.25 } },
      { type: 'setSensorZoom', observer: 'OBS', sensor: 'Camera', zoomLevel: 0.75 },
      { type: 'stepSensorZoom', observer: 'OBS', sensor: 'Camera', deltaZoomLevel: -0.25 },
      { type: 'setDirectedEnergyActive', observer: 'OBS', device: 'HEL', active: true },
      {
        type: 'airVehicleManeuver',
        object: 'Drone',
        velocity_ned: [1, 2, 3],
        acceleration_ned: [0.1, 0.2, 0.3],
        heading: 90
      },
      { type: 'setAirVehicleVelocityNed', object: 'Drone', speed: 10, heading: 90 },
      { type: 'setAirVehicleAccelerationNed', object: 'Drone', acceleration_ned: [0, 0, 1] },
      { type: 'setAirVehicleHeading', object: 'Drone', heading: 180 }
    ], context)

    expect(target.update).not.toHaveBeenCalled()
    expect(gimbal.trackMode).toBe('fixed')
    expect(gimbal.trackObject).toBeNull()
    expect(gimbal.az).toBeCloseTo(15, 8)
    expect(gimbal.el).toBeCloseTo(17, 8)
    expect(fsm.tip).toBeCloseTo(1.5, 8)
    expect(fsm.tilt).toBeCloseTo(1.75, 8)
    expect(camera.zoomLevel).toBeCloseTo(0.5, 8)
    expect(laser.active).toBe(true)
    expect(vehicle.velocityNed.x).toBeCloseTo(0, 8)
    expect(vehicle.velocityNed.y).toBeCloseTo(10, 8)
    expect(vehicle.accelerationNed).toEqual(new Cartesian3(0, 0, 1))
    expect(vehicle.heading).toBeCloseTo(180, 8)
  })

  test('preflights command batches and reports ordered validation details', () => {
    const commandBus = createDefaultCommandBus()
    const { context } = createCommandContext()

    expect(() => commandBus.validateBatch([
      { type: 'setGimbalAxes', observer: 'OBS', axes: { az: 1 } },
      { type: 'trackObject', observer: 'OBS', target: 'Missing' },
      { type: 'setSensorZoom', observer: 'OBS', sensor: 'Camera' }
    ], context)).toThrow(CommandError)

    try {
      commandBus.validateBatch([
        { type: 'setGimbalAxes', observer: 'OBS', axes: { az: 1 } },
        { type: 'trackObject', observer: 'OBS', target: 'Missing' },
        { type: 'setSensorZoom', observer: 'OBS', sensor: 'Camera' }
      ], context)
    } catch (err) {
      expect(err.statusCode).toBe(409)
      expect(err.errors).toEqual([
        expect.objectContaining({
          index: 1,
          type: 'trackObject',
          code: 'COMMAND_TARGET_NOT_FOUND'
        }),
        expect.objectContaining({
          index: 2,
          type: 'setSensorZoom',
          code: 'COMMAND_SCHEMA_INVALID',
          errors: expect.arrayContaining([
            expect.objectContaining({
              keyword: 'anyOf'
            })
          ])
        })
      ])
    }
  })

  test('schema validation rejects unknown public fields before semantic validation', () => {
    const commandBus = createDefaultCommandBus()
    const { context } = createCommandContext()

    expect(() => commandBus.validate({
      type: 'setGimbalAxes',
      observer: 'Missing',
      axes: { az: 1 },
      typo: true
    }, context)).toThrow(CommandError)

    try {
      commandBus.validate({
        type: 'setGimbalAxes',
        observer: 'Missing',
        axes: { az: 1 },
        typo: true
      }, context)
    } catch (err) {
      expect(err).toMatchObject({
        type: 'setGimbalAxes',
        code: 'COMMAND_SCHEMA_INVALID',
        statusCode: 400
      })
      expect(err.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          keyword: 'additionalProperties'
        })
      ]))
    }
  })

  test('normalizes command type and field aliases to canonical command data', () => {
    const commandBus = createDefaultCommandBus()
    const { context } = createCommandContext()

    expect(commandBus.validate({
      type: 'set_sensor_zoom',
      observer: 'OBS',
      sensor_name: 'Camera',
      zoom_level: 0.6
    }, context)).toEqual({
      type: 'setSensorZoom',
      observer: 'OBS',
      sensor: 'Camera',
      zoomLevel: 0.6
    })
  })

  test('registers custom commands', () => {
    const commandBus = new CommandBus()
    const calls = []
    commandBus.register({
      type: 'customCommand',
      aliases: ['custom_command'],
      normalize(command) {
        return { ...command, value: Number(command.value) }
      },
      validate(command) {
        if (!Number.isFinite(command.value)) {
          throw new CommandError('value required', {
            type: command.type,
            code: 'VALUE_REQUIRED'
          })
        }
      },
      execute(command) {
        calls.push(command.value)
      }
    })

    commandBus.execute({ type: 'custom_command', value: '5' })
    expect(calls).toEqual([5])
    expect(commandBus.unregister('customCommand')).toBe(true)
    expect(commandBus.get('customCommand')).toBeUndefined()
  })
})
