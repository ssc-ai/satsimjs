import { Cartesian3, JulianDate, defined } from "cesium";
import SimObject from "./SimObject";
import Universe from "../Universe";

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
  }

  /**
   * Gets the range to the track object.
   * @returns {number} - The range to the tracked object.
   */
  get range() {
    if (this.trackMode === 'rate')
      return this._range
    else {
      return 45000000.0
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
    if(value === this || value.parent === this) {
      console.warn('Gimbal.trackObject cannot be set to self or child.');
      return;
    }
    
    this._trackObject = value;
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