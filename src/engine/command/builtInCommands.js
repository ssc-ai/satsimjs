import CommandBus from './CommandBus.js'
import { airVehicleCommands } from './definitions/airVehicleCommands.js'
import { axisCommands } from './definitions/axisCommands.js'
import { sensorCommands } from './definitions/sensorCommands.js'

export const builtInCommands = [
  ...axisCommands,
  ...sensorCommands,
  ...airVehicleCommands
]

export function registerBuiltInCommands(commandBus) {
  builtInCommands.forEach((command) => commandBus.register(command))
  return commandBus
}

export function createDefaultCommandBus() {
  return registerBuiltInCommands(new CommandBus())
}
