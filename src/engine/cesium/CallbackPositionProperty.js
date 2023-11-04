import { defined, DeveloperError, Event, PositionProperty, ReferenceFrame, defaultValue } from "cesium";

/**
 * A {@link Property} whose value is lazily evaluated by a callback function.
 *
 * @alias CallbackPositionProperty
 * @constructor
 *
 * @param {CallbackPositionProperty.Callback} callback The function to be called when the property is evaluated.
 * @param {boolean} isConstant <code>true</code> when the callback function returns the same value every time, <code>false</code> if the value will change.
 */
function CallbackPositionProperty(callback, isConstant, referenceFrame) {

  this._callback = undefined;
  this._isConstant = undefined;
  this._definitionChanged = new Event();
  this._referenceFrame = defaultValue(referenceFrame, () => ReferenceFrame.FIXED);
  this.setCallback(callback, isConstant);
}

Object.defineProperties(CallbackPositionProperty.prototype, {
  /**
   * Gets a value indicating if this property is constant.
   * @memberof CallbackPositionProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return this._isConstant;
    },
  },
  /**
   * Gets the event that is raised whenever the definition of this property changes.
   * The definition is changed whenever setCallback is called.
   * @memberof CallbackPositionProperty.prototype
   *
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },

  /**
   * Gets the reference frame that the position is defined in.
   * @memberof PositionProperty.prototype
   * @type {ReferenceFrame}
   */
  referenceFrame: {
    get: function () {
      return this._referenceFrame();
    },
  },
});

/**
 * Gets the value of the property.
 *
 * @param {JulianDate} time The time for which to retrieve the value.
 * @param {object} [result] The object to store the value into, if omitted, a new instance is created and returned.
 * @returns {object} The modified result parameter or a new instance if the result parameter was not supplied or is unsupported.
 */
CallbackPositionProperty.prototype.getValue = function (time, result) {
//  return this._callback(time, result);
  return this.getValueInReferenceFrame(time, ReferenceFrame.FIXED, result)
};

/**
 * Sets the callback to be used.
 *
 * @param {CallbackPositionProperty.Callback} callback The function to be called when the property is evaluated.
 * @param {boolean} isConstant <code>true</code> when the callback function returns the same value every time, <code>false</code> if the value will change.
 */
CallbackPositionProperty.prototype.setCallback = function (callback, isConstant) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(callback)) {
    throw new DeveloperError("callback is required.");
  }
  if (!defined(isConstant)) {
    throw new DeveloperError("isConstant is required.");
  }
  //>>includeEnd('debug');

  const changed =
    this._callback !== callback || this._isConstant !== isConstant;

  this._callback = callback;
  this._isConstant = isConstant;

  if (changed) {
    this._definitionChanged.raiseEvent(this);
  }
};

/**
 * Compares this property to the provided property and returns
 * <code>true</code> if they are equal, <code>false</code> otherwise.
 *
 * @param {Property} [other] The other property.
 * @returns {boolean} <code>true</code> if left and right are equal, <code>false</code> otherwise.
 */
CallbackPositionProperty.prototype.equals = function (other) {
  return (
    this === other ||
    (other instanceof CallbackPositionProperty &&
      this._callback === other._callback &&
      this._isConstant === other._isConstant)
  );
};

/**
 * Gets the value of the property at the provided time and in the provided reference frame.
 *
 * @param {JulianDate} time The time for which to retrieve the value.
 * @param {ReferenceFrame} referenceFrame The desired referenceFrame of the result.
 * @param {Cartesian3} [result] The object to store the value into, if omitted, a new instance is created and returned.
 * @returns {Cartesian3} The modified result parameter or a new instance if the result parameter was not supplied.
 */
CallbackPositionProperty.prototype.getValueInReferenceFrame = function (
  time,
  referenceFrame,
  result
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(time)) {
    throw new DeveloperError("time is required.");
  }
  if (!defined(referenceFrame)) {
    return this._callback(time, result);
  }
  //>>includeEnd('debug');

  let p = this._callback(time, result);
  return PositionProperty.convertToReferenceFrame(
    time,
    p,
    this._referenceFrame(),
    referenceFrame,
    result
  );
};

/**
 * A function that returns the value of the property.
 * @callback CallbackPositionProperty.Callback
 *
 * @param {JulianDate} time The time for which to retrieve the value.
 * @param {object} [result] The object to store the value into. If omitted, the function must create and return a new instance.
 * @returns {object} The modified result parameter, or a new instance if the result parameter was not supplied or is unsupported.
 */
export default CallbackPositionProperty;