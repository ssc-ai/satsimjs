import { normalizeAxisSlewConfig, stepSlewAxis } from '../src/engine/dynamics/slew.js'

function normalizeAzimuthDeg(azDeg) {
  let wrapped = Number(azDeg) % 360
  if (wrapped < 0) wrapped += 360
  return wrapped
}

function shortestAzimuthErrorDeg(targetAzDeg, currentAzDeg) {
  let err = normalizeAzimuthDeg(targetAzDeg) - normalizeAzimuthDeg(currentAzDeg)
  if (err > 180) err -= 360
  if (err < -180) err += 360
  return err
}

describe('slew dynamics utilities', () => {
  test('normalizeAxisSlewConfig returns undefined for invalid inputs', () => {
    expect(normalizeAxisSlewConfig(undefined)).toBeUndefined()
    expect(normalizeAxisSlewConfig(null)).toBeUndefined()
    expect(normalizeAxisSlewConfig(-1)).toBeUndefined()
    expect(normalizeAxisSlewConfig({})).toBeUndefined()
    expect(normalizeAxisSlewConfig({ maxRateDegPerSec: 0 })).toBeUndefined()
  })

  test('normalizeAxisSlewConfig supports numeric shorthand and object aliases', () => {
    const fromNumber = normalizeAxisSlewConfig(12)
    expect(fromNumber.maxRateDegPerSec).toBeCloseTo(12, 8)
    expect(fromNumber.maxAccelDegPerSec2).toBeCloseTo(36, 8)

    const fromObject = normalizeAxisSlewConfig({
      max_rate: '9',
      max_accel: '18'
    })
    expect(fromObject.maxRateDegPerSec).toBeCloseTo(9, 8)
    expect(fromObject.maxAccelDegPerSec2).toBeCloseTo(18, 8)
  })

  test('stepSlewAxis jumps instantly when config is undefined', () => {
    const result = stepSlewAxis(0, 45, 2, 1.0, undefined)
    expect(result.positionDeg).toBeCloseTo(45, 8)
    expect(result.rateDegPerSec).toBe(0)
  })

  test('stepSlewAxis converges without bounce at large dt', () => {
    const cfg = normalizeAxisSlewConfig({
      maxRateDegPerSec: 10,
      maxAccelDegPerSec2: 20,
      maxIntegrationSubstepSec: 0.05
    })

    let angle = 0
    let rate = 0
    for (let i = 0; i < 6; i++) {
      const result = stepSlewAxis(angle, 80, rate, 2.0, cfg)
      angle = result.positionDeg
      rate = result.rateDegPerSec
    }

    expect(angle).toBeCloseTo(80, 3)
    expect(Math.abs(rate)).toBeLessThan(0.05)
  })

  test('stepSlewAxis supports wrapped azimuth error function', () => {
    const cfg = normalizeAxisSlewConfig({
      maxRateDegPerSec: 15,
      maxAccelDegPerSec2: 30
    })

    const result = stepSlewAxis(350, 10, 0, 1.0, cfg, {
      computeErrorDeg: shortestAzimuthErrorDeg,
      normalizePositionDeg: normalizeAzimuthDeg,
      normalizeTargetDeg: normalizeAzimuthDeg
    })

    // Should move toward +20 deg shortest-path direction and remain wrapped [0, 360)
    expect(result.positionDeg).toBeGreaterThanOrEqual(0)
    expect(result.positionDeg).toBeLessThan(360)
    expect(shortestAzimuthErrorDeg(10, result.positionDeg)).toBeLessThan(20)
  })
})
