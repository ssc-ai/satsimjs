# SatSim Commands

SatSim commands use flat JSON objects. The canonical command name is camelCase in the `type` field; snake_case aliases are accepted where the schema lists them. Public command schemas live under `schemas/command/v1/`.

## Schema Files

- `command.schema.json` covers simulation commands executable by `CommandBus`.
- `scheduledCommand.schema.json` covers scenario events with a `time` field plus a simulation command.
- `runtimeCommand.schema.json` covers runtime API input. It includes every simulation command plus runtime-only control commands.
- `commands/<type>.schema.json` contains one command schema per canonical command type.

## Simulation Commands

Simulation commands are discrete mutations against the current `Universe`. They can be submitted through the runtime API or scheduled in a scenario event. Runtime submission executes them at the runtime clock's current simulation time and records them in the runtime event log. Scenario events execute them at their scheduled simulation time through `EventQueue` and `CommandBus`.

Current simulation command types:

- `trackObject`: put an observatory gimbal into tracking mode for a target object, or clear tracking with `target: null`.
- `setGimbalAxes`: set absolute gimbal axes in degrees.
- `stepGimbalAxes`: step gimbal axes by degree deltas.
- `setFsmAxes`: set absolute fast steering mirror axes in degrees.
- `stepFsmAxes`: step fast steering mirror axes by degree deltas.
- `setSensorZoom`: set normalized sensor zoom from `0` to `1`.
- `stepSensorZoom`: step normalized sensor zoom by a delta.
- `setDirectedEnergyActive`: enable or disable a directed-energy payload.
- `airVehicleManeuver`: apply one or more air vehicle velocity, acceleration, or heading changes.
- `setAirVehicleVelocityNed`: set air vehicle velocity in North-East-Down meters per second.
- `setAirVehicleAccelerationNed`: set air vehicle acceleration in North-East-Down meters per second squared.
- `setAirVehicleHeading`: set air vehicle heading in degrees clockwise from north.

## Runtime Control Commands

Runtime control commands are stateful control inputs, similar to joystick input. They are not valid scheduled scenario events. `SimulationRuntime` routes them to a `ControllerRegistry`; domain controllers validate the input, update short-lived control leases, and generate ordinary simulation commands for `CommandBus` when the control state needs to affect the `Universe`.

Current runtime control command types are rate controls:

- `setGimbalAxisRates`: handled by `GimbalController`; sets gimbal axis rates in degrees per second.
- `setFsmAxisRates`: handled by `FsmController`; sets fast steering mirror axis rates in degrees per second.
- `setSensorZoomRate`: handled by `SensorZoomController`; sets normalized zoom-level rate per second.

Runtime control behavior:

- A nonzero rate creates or renews a lease for `analogLeaseMs`.
- A zero rate removes the matching lease and emits an absolute hold command when there was an active lease.
- On each tick, active controller leases integrate `rate * deltaSeconds` against the current actuator state and generate `setGimbalAxes`, `setFsmAxes`, or `setSensorZoom`.
- Generated commands execute through `CommandBus` and are recorded in the runtime event log.
- Expired leases are removed and controllers emit absolute hold commands so the actuator stops at its current state.
- Invalid mixed command batches are atomic: schema and semantic validation finish before leases, runtime event logs, or Universe state are mutated.

The runtime derives controller routing from command metadata in `src/engine/command/schemas.js`. Do not add local hardcoded command-type maps in runtime code; add aliases, controller names, and control categories to the command schema entry instead.
