import { defined, JulianDate } from 'cesium'

import { booleanOr, numberOrUndefined, resolveJulianDateInput } from '../engine/utils.js'

export const CLOCK_STEP_TICK_DEPENDENT = 0
export const CLOCK_STEP_SYSTEM_CLOCK_MULTIPLIER = 1
export const CLOCK_STEP_SYSTEM_CLOCK = 2
export const CLOCK_RANGE_UNBOUNDED = 0
export const CLOCK_RANGE_CLAMPED = 1
export const CLOCK_RANGE_LOOP_STOP = 2

export function isScenarioNowLiteral(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === 'now'
}

function cloneJulianDateOrNow(value, nowValue = undefined) {
  const resolved = resolveScenarioJulianDateInput(value, undefined, nowValue)
  return resolved instanceof JulianDate
    ? resolved
    : (nowValue instanceof JulianDate ? JulianDate.clone(nowValue, new JulianDate()) : JulianDate.now())
}

export function resolveScenarioJulianDateInput(value, fallback = undefined, nowValue = undefined) {
  if (isScenarioNowLiteral(value)) {
    return nowValue instanceof JulianDate
      ? JulianDate.clone(nowValue, new JulianDate())
      : JulianDate.now()
  }
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

export function resolveScenarioDurationSeconds(value, fallback = undefined) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  const seconds = numberOrUndefined(value)
  return (Number.isFinite(seconds) && seconds >= 0) ? seconds : fallback
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
  const nowAnchor = JulianDate.now()
  const seedTime = cloneJulianDateOrNow(
    initial?.currentTime ??
    initial?.startTime ??
    initial?.time,
    nowAnchor
  )
  const startTime = resolveScenarioJulianDateInput(initial?.startTime, seedTime, nowAnchor)
  const currentTime = resolveScenarioJulianDateInput(initial?.currentTime, startTime, nowAnchor)
  const stopTime = resolveScenarioJulianDateInput(
    initial?.stopTime,
    JulianDate.addSeconds(startTime, 24 * 3600, new JulianDate()),
    nowAnchor
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
