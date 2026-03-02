import { Cartesian3, JulianDate, defined } from "cesium";
import SimObject from "./SimObject.js";
import { normalizeAxisSlewConfig, stepSlewAxis } from "../dynamics/slew.js";

const DEFAULT_IDLE_RANGE_METERS = 45000000.0

/**
 * Represents a base gimbal object that can track another object.
 * @extends SimObject
 * 
 */
class Gimbal extends SimObject {
  /**
   * Creates a new Gimbal object.
   * @param {string} [name='Gimbal'] - The name of the Gimbal object.
   */
  constructor(name='Gimbal') {
    super(name);
    this._trackObject = null;
    this._trackMode = 'fixed';
    this._sidereal = null;
    this._range = 0
    this._maxRange = DEFAULT_IDLE_RANGE_METERS
    this._axisSlewConfigs = new Map();
    this._axisSlewState = new Map();
    this._lastSlewUpdate = undefined;
  }

  /**
   * Gets the range to the track object.
   * @returns {number} - The range to the tracked object.
   */
  get range() {
    if (this.trackMode === 'rate')
      return this._range
    else {
      return this._maxRange
    }
  }

  /**
   * Gets fallback range used when not actively tracking.
   * @returns {number}
   */
  get maxRange() {
    return this._maxRange
  }

  /**
   * Sets fallback range used when not actively tracking.
   * Values must be finite and > 0.
   * @param {number} value
   */
  set maxRange(value) {
    const range = Number(value)
    if (Number.isFinite(range) && range > 0) {
      this._maxRange = range
    }
  }

  /**
   * Gets the track mode of the Gimbal object.
   * @returns {string} - The track mode of the Gimbal object.
   */
  get trackMode() {
    return this._trackMode;
  }

  /**
   * Sets the track mode of the Gimbal object.
   * @param {string} value - The track mode to set.
   */
  set trackMode(value) {
    this._trackMode = value;
  }

  /**
   * Gets the object that the Gimbal object is tracking.
   * @returns {SimObject} - The object that the Gimbal object is tracking.
   */
  get trackObject() {
    return this._trackObject;
  }

  /**
   * Sets the object that the Gimbal object is tracking.
   * @param {SimObject} value - The object to track.
   */
  set trackObject(value) {
    if(defined(value) && (value === this || value.parent === this)) {
      console.warn('Gimbal.trackObject cannot be set to self or child.');
      return;
    }

    this._trackObject = value;
  }

  /**
   * Configure per-axis slew limits.
   *
   * The object key is the axis name and value is either:
   * - number: max rate in deg/sec
   * - object: { maxRateDegPerSec, maxAccelDegPerSec2, ... }
   *
   * Omitted axes use instantaneous motion.
   *
   * @param {Object<string, number|Object>|undefined} ratesByAxis
   */
  setAxisSlewRates(ratesByAxis) {
    this._axisSlewConfigs.clear()
    this._axisSlewState.clear()
    this._lastSlewUpdate = undefined

    if (!defined(ratesByAxis) || typeof ratesByAxis !== 'object' || Array.isArray(ratesByAxis)) {
      return
    }

    Object.keys(ratesByAxis).forEach((axisName) => {
      const axis = String(axisName).trim()
      if (!axis) return
      const cfg = normalizeAxisSlewConfig(ratesByAxis[axisName])
      if (cfg) {
        this._axisSlewConfigs.set(axis, cfg)
      }
    })
  }

  /**
   * Returns active per-axis slew settings.
   * @returns {Object<string, Object>}
   */
  getAxisSlewRates() {
    const out = {}
    this._axisSlewConfigs.forEach((cfg, axisName) => {
      out[axisName] = { ...cfg }
    })
    return out
  }

  /**
   * Set an axis target in degrees.
   * @param {string} axisName
   * @param {number} targetDeg
   * @param {Object} [options]
   * @param {(deg:number)=>number} [options.normalizeTargetDeg]
   */
  setAxisTarget(axisName, targetDeg, options = {}) {
    const axis = String(axisName ?? '').trim()
    if (!axis) return
    const target = Number(targetDeg)
    if (!Number.isFinite(target)) return
    const normalizeTargetDeg = (typeof options.normalizeTargetDeg === 'function')
      ? options.normalizeTargetDeg
      : (deg) => deg

    const state = this._axisSlewState.get(axis) || { targetDeg: target, rateDegPerSec: 0 }
    state.targetDeg = normalizeTargetDeg(target)
    if (!Number.isFinite(state.rateDegPerSec)) state.rateDegPerSec = 0
    this._axisSlewState.set(axis, state)
  }

  /**
   * Step an axis target by a delta (deg).
   * @param {string} axisName
   * @param {number} deltaDeg
   * @param {number} [currentDeg=0]
   * @param {Object} [options]
   * @param {(deg:number)=>number} [options.normalizeTargetDeg]
   */
  stepAxisTarget(axisName, deltaDeg, currentDeg = 0, options = {}) {
    const axis = String(axisName ?? '').trim()
    if (!axis) return
    const delta = Number(deltaDeg)
    if (!Number.isFinite(delta)) return
    const normalizeTargetDeg = (typeof options.normalizeTargetDeg === 'function')
      ? options.normalizeTargetDeg
      : (deg) => deg

    const existing = this._axisSlewState.get(axis)
    const base = Number.isFinite(existing?.targetDeg) ? existing.targetDeg : Number(currentDeg)
    if (!Number.isFinite(base)) return

    const state = existing || { targetDeg: base, rateDegPerSec: 0 }
    state.targetDeg = normalizeTargetDeg(base + delta)
    if (!Number.isFinite(state.rateDegPerSec)) state.rateDegPerSec = 0
    this._axisSlewState.set(axis, state)
  }

  /**
   * Get currently-commanded target for an axis.
   * @param {string} axisName
   * @returns {number|undefined}
   */
  getAxisTarget(axisName) {
    const axis = String(axisName ?? '').trim()
    if (!axis) return undefined
    const state = this._axisSlewState.get(axis)
    return state?.targetDeg
  }

  /**
   * Clear axis target/rate state.
   * @param {boolean} [syncToCurrent=false] - If true, preserve targets at current axis values.
   */
  clearAxisTargets(syncToCurrent = false) {
    if (!syncToCurrent) {
      this._axisSlewState.clear()
      this._lastSlewUpdate = undefined
      return
    }

    const axisNames = new Set([
      ...this._axisSlewConfigs.keys(),
      ...this._axisSlewState.keys()
    ])
    axisNames.forEach((axisName) => {
      const current = Number(this[axisName])
      const state = this._axisSlewState.get(axisName) || { targetDeg: 0, rateDegPerSec: 0 }
      if (Number.isFinite(current)) {
        state.targetDeg = current
      }
      state.rateDegPerSec = 0
      this._axisSlewState.set(axisName, state)
    })
    this._lastSlewUpdate = undefined
  }

  /**
   * Updates the Gimbal object.
   * @param {JulianDate} time - The current time.
   * @param {Universe} universe - The universe object.
   * @override
   */
  update(time, universe) {
    super.update(time, universe, true, true) // always force update for now since gimbal can moved when time stops
  }

  /**
   * Gets the local vector of the Gimbal object based on tracking mode and track object.
   * @param {JulianDate} time - The current time.
   * @param {Universe} universe - The universe object.
   * @returns {Cartesian3|null} - The local vector of the Gimbal object.
   * @private
   */
  _trackToLocalVector(time, universe) {
    let localVector = new Cartesian3();
    if (defined(this._trackObject) && this._trackMode === 'rate') {
      this._trackObject.update(time, universe);
      localVector = this._trackObject.transformPointTo(this.parent, Cartesian3.ZERO, localVector);
    } else if (this._trackMode === 'sidereal') {
      console.log('sidereal not implemented');
    } else {
      return null; // fixed mode, do nothing
    }
    return localVector;
  }

  /**
   * Compute elapsed simulation seconds since the last slew step.
   * @param {JulianDate} time
   * @returns {number}
   * @protected
   */
  _consumeSlewDeltaTime(time) {
    if (!(time instanceof JulianDate)) return 0
    if (!(this._lastSlewUpdate instanceof JulianDate)) {
      this._lastSlewUpdate = JulianDate.clone(time, new JulianDate())
      return 0
    }

    const dtSec = JulianDate.secondsDifference(time, this._lastSlewUpdate)
    JulianDate.clone(time, this._lastSlewUpdate)
    if (!Number.isFinite(dtSec) || dtSec <= 0) {
      if (dtSec < 0) {
        this._axisSlewState.forEach((state) => {
          state.rateDegPerSec = 0
        })
      }
      return 0
    }
    return dtSec
  }

  /**
   * Slew an axis toward target according to axis configuration.
   * If no slew config is set for this axis, target is applied instantly.
   *
   * @param {string} axisName
   * @param {number} currentDeg
   * @param {number} targetDeg
   * @param {number} dtSec
   * @param {Object} [options]
   * @param {(targetDeg:number,currentDeg:number)=>number} [options.computeErrorDeg]
   * @param {(deg:number)=>number} [options.normalizePositionDeg]
   * @param {(deg:number)=>number} [options.normalizeTargetDeg]
   * @returns {number}
   * @protected
   */
  _slewAxis(axisName, currentDeg, targetDeg, dtSec, options = {}) {
    const axis = String(axisName ?? '').trim()
    if (!axis) return Number(currentDeg)

    const current = Number(currentDeg)
    if (!Number.isFinite(current)) return currentDeg

    const axisConfig = this._axisSlewConfigs.get(axis)
    const rawTargetDeg = Number(targetDeg)
    if (!axisConfig) {
      const immediateTarget = Number.isFinite(rawTargetDeg) ? rawTargetDeg : current
      this._axisSlewState.set(axis, {
        targetDeg: immediateTarget,
        rateDegPerSec: 0
      })
      return immediateTarget
    }

    const normalizeTargetDeg = (typeof options.normalizeTargetDeg === 'function')
      ? options.normalizeTargetDeg
      : (deg) => deg
    const normalizePositionDeg = (typeof options.normalizePositionDeg === 'function')
      ? options.normalizePositionDeg
      : (deg) => deg

    const state = this._axisSlewState.get(axis) || { targetDeg: current, rateDegPerSec: 0 }
    state.targetDeg = Number.isFinite(rawTargetDeg) ? normalizeTargetDeg(rawTargetDeg) : state.targetDeg
    if (!Number.isFinite(state.targetDeg)) state.targetDeg = normalizeTargetDeg(current)
    if (!Number.isFinite(state.rateDegPerSec)) state.rateDegPerSec = 0
    this._axisSlewState.set(axis, state)

    const result = stepSlewAxis(
      normalizePositionDeg(current),
      state.targetDeg,
      state.rateDegPerSec,
      Number(dtSec),
      axisConfig,
      options
    )
    state.targetDeg = result.targetDeg
    state.rateDegPerSec = result.rateDegPerSec
    this._axisSlewState.set(axis, state)

    return result.positionDeg
  }

  /**
   * Override this function to update gimbal orientation.
   * @param {JulianDate} time - The time to update the object to.
   * @param {Universe} universe - The universe object.
   * @abstract
   */
  _update(time, universe) {
    throw new Error('Gimbal._update must be implemented in derived classes.');
  }  
}

export default Gimbal;
