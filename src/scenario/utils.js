import { defined, JulianDate } from 'cesium'

import { booleanOr, resolveJulianDateInput } from '../engine/utils.js'

export const CLOCK_STEP_TICK_DEPENDENT = 0
export const CLOCK_STEP_SYSTEM_CLOCK_MULTIPLIER = 1
export const CLOCK_STEP_SYSTEM_CLOCK = 2
export const CLOCK_RANGE_UNBOUNDED = 0
export const CLOCK_RANGE_CLAMPED = 1
export const CLOCK_RANGE_LOOP_STOP = 2

function cloneJulianDateOrNow(value) {
  const resolved = resolveScenarioJulianDateInput(value)
  return resolved instanceof JulianDate ? resolved : JulianDate.now()
}

export function resolveScenarioJulianDateInput(value, fallback = undefined) {
  if (typeof value === 'number') {
    const date = new Date(value)
    if (Number.isFinite(date.getTime())) {
      return JulianDate.fromDate(date)
    }
  }
  const resolved = resolveJulianDateInput(value)
  if (resolved instanceof JulianDate) {
    return resolved
  }
  return fallback instanceof JulianDate ? JulianDate.clone(fallback, new JulianDate()) : undefined
}

export function resolveClockStepValue(value, fallback = CLOCK_STEP_SYSTEM_CLOCK_MULTIPLIER) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  switch (String(value).toLowerCase()) {
    case 'tick_dependent':
      return CLOCK_STEP_TICK_DEPENDENT
    case 'system_clock_multiplier':
      return CLOCK_STEP_SYSTEM_CLOCK_MULTIPLIER
    case 'system_clock':
      return CLOCK_STEP_SYSTEM_CLOCK
    default:
      return Number(value)
  }
}

export function resolveClockRangeValue(value, fallback = CLOCK_RANGE_UNBOUNDED) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  switch (String(value).toLowerCase()) {
    case 'unbounded':
      return CLOCK_RANGE_UNBOUNDED
    case 'clamped':
      return CLOCK_RANGE_CLAMPED
    case 'loop_stop':
      return CLOCK_RANGE_LOOP_STOP
    default:
      return Number(value)
  }
}

export function resolveScenarioClockTarget(target) {
  if (defined(target?.clock)) {
    return target.clock
  }
  if (defined(target) && typeof target === 'object') {
    return target
  }
  return undefined
}

export function resolveScenarioViewerTarget(target) {
  if (!defined(target) || typeof target !== 'object') {
    return undefined
  }
  if (
    typeof target.addObjectVisualizer === 'function' ||
    typeof target.addObservatoryVisualizer === 'function'
  ) {
    return target
  }
  return undefined
}

export function createClockContext(initial = undefined) {
  const seedTime = cloneJulianDateOrNow(
    initial?.currentTime ??
    initial?.startTime ??
    initial?.time
  )
  const startTime = resolveScenarioJulianDateInput(initial?.startTime, seedTime)
  const currentTime = resolveScenarioJulianDateInput(initial?.currentTime, startTime)
  const stopTime = resolveScenarioJulianDateInput(
    initial?.stopTime,
    JulianDate.addSeconds(startTime, 24 * 3600, new JulianDate())
  )

  return {
    startTime,
    currentTime,
    stopTime,
    multiplier: Number(initial?.multiplier ?? initial?.timeStep ?? 1),
    clockStep: resolveClockStepValue(initial?.clockStep),
    clockRange: resolveClockRangeValue(initial?.clockRange),
    shouldAnimate: booleanOr(initial?.shouldAnimate, false)
  }
}
