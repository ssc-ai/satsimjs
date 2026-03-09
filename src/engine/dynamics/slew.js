import { clampSymmetric, numberOr, positiveNumberOr } from '../utils.js'

const DEFAULT_ACCEL_MULTIPLIER = 3.0
const DEFAULT_SNAP_ERROR_DEG = 0.01
const DEFAULT_SNAP_RATE_DEG_PER_SEC = 0.02
const DEFAULT_MAX_INTEGRATION_SUBSTEP_SEC = 0.1
const DEFAULT_MAX_INTEGRATION_STEPS = 240

/**
 * Normalize a single-axis slew configuration.
 *
 * Supported forms:
 * - number: max rate (deg/sec)
 * - object: max rate + optional acceleration/tolerances
 *
 * @param {number|Object} input
 * @returns {Object|undefined}
 */
export function normalizeAxisSlewConfig(input) {
  let maxRateDegPerSec
  let maxAccelDegPerSec2
  let snapErrorDeg
  let snapRateDegPerSec
  let maxIntegrationSubstepSec
  let maxIntegrationSteps

  if (typeof input === 'number' || typeof input === 'string') {
    maxRateDegPerSec = Number(input)
  } else if (input && typeof input === 'object') {
    maxRateDegPerSec = Number(
      input.max_rate ??
      input.maxRate ??
      input.maxRateDegPerSec ??
      input.max_rate_deg_per_sec ??
      input.max_rate_deg_s ??
      input.rate ??
      input.slew_rate_deg_per_sec
    )
    maxAccelDegPerSec2 = Number(
      input.max_accel ??
      input.maxAccel ??
      input.maxAccelDegPerSec2 ??
      input.max_accel_deg_per_sec2 ??
      input.max_accel_deg_s2 ??
      input.accel ??
      input.acceleration_deg_per_sec2
    )
    snapErrorDeg = Number(input.snapErrorDeg ?? input.snap_error_deg)
    snapRateDegPerSec = Number(input.snapRateDegPerSec ?? input.snap_rate_deg_per_sec)
    maxIntegrationSubstepSec = Number(
      input.maxIntegrationSubstepSec ??
      input.max_integration_substep_sec
    )
    maxIntegrationSteps = Number(
      input.maxIntegrationSteps ??
      input.max_integration_steps
    )
  }

  if (!(Number.isFinite(maxRateDegPerSec) && maxRateDegPerSec > 0)) {
    return undefined
  }

  if (!(Number.isFinite(maxAccelDegPerSec2) && maxAccelDegPerSec2 > 0)) {
    maxAccelDegPerSec2 = maxRateDegPerSec * DEFAULT_ACCEL_MULTIPLIER
  }

  return {
    maxRateDegPerSec,
    maxAccelDegPerSec2,
    snapErrorDeg: positiveNumberOr(snapErrorDeg, DEFAULT_SNAP_ERROR_DEG),
    snapRateDegPerSec: positiveNumberOr(snapRateDegPerSec, DEFAULT_SNAP_RATE_DEG_PER_SEC),
    maxIntegrationSubstepSec: positiveNumberOr(maxIntegrationSubstepSec, DEFAULT_MAX_INTEGRATION_SUBSTEP_SEC),
    maxIntegrationSteps: Math.max(1, Math.floor(positiveNumberOr(maxIntegrationSteps, DEFAULT_MAX_INTEGRATION_STEPS)))
  }
}

/**
 * Advance one axis toward its target under rate + acceleration limits.
 *
 * @param {number} currentDeg - Current axis angle (deg).
 * @param {number} targetDeg - Target axis angle (deg).
 * @param {number} currentRateDegPerSec - Current axis rate (deg/sec).
 * @param {number} dtSec - Time step (sec).
 * @param {Object|undefined} config - Normalized slew config; if undefined, jumps instantly.
 * @param {Object} [options]
 * @param {(targetDeg:number,currentDeg:number)=>number} [options.computeErrorDeg]
 * @param {(deg:number)=>number} [options.normalizePositionDeg]
 * @param {(deg:number)=>number} [options.normalizeTargetDeg]
 * @returns {{ positionDeg:number, rateDegPerSec:number, targetDeg:number }}
 */
export function stepSlewAxis(currentDeg, targetDeg, currentRateDegPerSec, dtSec, config, options = {}) {
  const normalizePositionDeg = (typeof options.normalizePositionDeg === 'function')
    ? options.normalizePositionDeg
    : (deg) => deg
  const normalizeTargetDeg = (typeof options.normalizeTargetDeg === 'function')
    ? options.normalizeTargetDeg
    : normalizePositionDeg
  const computeErrorDeg = (typeof options.computeErrorDeg === 'function')
    ? options.computeErrorDeg
    : (target, current) => target - current

  let positionDeg = normalizePositionDeg(numberOr(currentDeg))
  const resolvedTargetDeg = normalizeTargetDeg(numberOr(targetDeg, positionDeg))
  let rateDegPerSec = numberOr(currentRateDegPerSec)

  const slewDisabled = !config ||
    !(Number.isFinite(config.maxRateDegPerSec) && config.maxRateDegPerSec > 0)
  if (slewDisabled) {
    return { positionDeg: resolvedTargetDeg, rateDegPerSec: 0, targetDeg: resolvedTargetDeg }
  }

  if (!(dtSec > 0)) {
    return { positionDeg, rateDegPerSec, targetDeg: resolvedTargetDeg }
  }

  const maxRateDegPerSec = positiveNumberOr(config.maxRateDegPerSec, Number.POSITIVE_INFINITY)
  const maxAccelDegPerSec2 = positiveNumberOr(config.maxAccelDegPerSec2, Number.POSITIVE_INFINITY)
  const snapErrorDeg = positiveNumberOr(config.snapErrorDeg, DEFAULT_SNAP_ERROR_DEG)
  const snapRateDegPerSec = positiveNumberOr(config.snapRateDegPerSec, DEFAULT_SNAP_RATE_DEG_PER_SEC)
  const maxIntegrationSubstepSec = positiveNumberOr(config.maxIntegrationSubstepSec, DEFAULT_MAX_INTEGRATION_SUBSTEP_SEC)
  const maxIntegrationSteps = Math.max(1, Math.floor(positiveNumberOr(config.maxIntegrationSteps, DEFAULT_MAX_INTEGRATION_STEPS)))
  const suggestedSteps = Math.ceil(dtSec / maxIntegrationSubstepSec)
  const integrationSteps = Math.max(1, Math.min(maxIntegrationSteps, suggestedSteps))
  const substepSec = dtSec / integrationSteps

  const crossedTarget = (previousErrorDeg, nextErrorDeg) => {
    if (Math.abs(nextErrorDeg) <= snapErrorDeg) return true
    if (previousErrorDeg === 0) return true
    return (
      (previousErrorDeg > 0 && nextErrorDeg < 0) ||
      (previousErrorDeg < 0 && nextErrorDeg > 0)
    )
  }

  for (let i = 0; i < integrationSteps; i++) {
    const errorDeg = computeErrorDeg(resolvedTargetDeg, positionDeg)
    if (Math.abs(errorDeg) <= snapErrorDeg && Math.abs(rateDegPerSec) <= snapRateDegPerSec) {
      return { positionDeg: resolvedTargetDeg, rateDegPerSec: 0, targetDeg: resolvedTargetDeg }
    }

    const desiredRateMag = Math.min(
      maxRateDegPerSec,
      Math.sqrt(Math.max(0, 2.0 * maxAccelDegPerSec2 * Math.abs(errorDeg)))
    )
    const desiredRateDegPerSec = Math.sign(errorDeg) * desiredRateMag
    const maxRateDeltaPerSubstep = maxAccelDegPerSec2 * substepSec
    rateDegPerSec += clampSymmetric(desiredRateDegPerSec - rateDegPerSec, maxRateDeltaPerSubstep)
    rateDegPerSec = clampSymmetric(rateDegPerSec, maxRateDegPerSec)

    const candidatePositionDeg = normalizePositionDeg(positionDeg + rateDegPerSec * substepSec)
    const candidateErrorDeg = computeErrorDeg(resolvedTargetDeg, candidatePositionDeg)
    if (crossedTarget(errorDeg, candidateErrorDeg)) {
      return { positionDeg: resolvedTargetDeg, rateDegPerSec: 0, targetDeg: resolvedTargetDeg }
    }

    positionDeg = candidatePositionDeg
  }

  return { positionDeg, rateDegPerSec, targetDeg: resolvedTargetDeg }
}
