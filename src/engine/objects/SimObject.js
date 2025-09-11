import { ReferenceFrame, Cartesian3, JulianDate, Matrix4, defined, Entity } from "cesium";
import TransformGroup from "../graph/TransformGroup.js";

/**
 * A base class for all simulation objects.
 * @extends TransformGroup
 */
class SimObject extends TransformGroup {
  /**
   * Creates a new SimObject.
   * @param {string} [name='undefined'] - The name of the object.
   * @param {ReferenceFrame} [referenceFrame=undefined] - The reference frame of the object.
   */
  constructor(name='undefined', referenceFrame=undefined) {
    super();
    this._name = name;
    this._referenceFrame = referenceFrame;

    this._position = new Cartesian3();
    this._velocity = new Cartesian3();

    this._localToWorldTransform = new Matrix4();
    this._worldToLocalTransform = new Matrix4();

    this._lastUpdate = new JulianDate();
    this._lastUniverse = undefined;
    this._transformDirty = true;

    this._visualizer = {};
    this._updateListeners = [];
  }

  /**
   * The eccentricity of the object's orbit.
   * @type {number}
   * @readonly
   */
  get eccentricity() {
    return this._eccentricity;
  }

  /**
   * The period of the object's orbit.
   * @type {number}
   * @readonly
   */
  get period() {
    return this._period;
  }

  /**
   * Sets the visualizer for the object.
   * @type {Entity}
   */
  set visualizer(visualizer) {
    this._visualizer = visualizer;
  }

  /**
   * Gets the visualizer for the object.
   * @type {Entity}
   * @readonly
   */
  get visualizer() {
    return this._visualizer;
  }

  /**
   * Gets the update listeners for the object.
   * @type {Array}
   * @readonly
   */
  get updateListeners() {
    return this._updateListeners;
  }

  /**
   * Gets the reference frame of the object.
   * @type {ReferenceFrame}
   * @readonly
   */
  get referenceFrame() {
    return this._referenceFrame ?? (defined(this.parent) ? this.parent.referenceFrame : undefined);
  }

  /**
   * Gets the position of the object.
   * @type {Cartesian3}
   * @readonly
   */
  get position() {
    return defined(this._referenceFrame) ? this._position : defined(this.parent) ? this.parent.position : undefined;
  }

  /**
   * Gets the velocity of the object.
   * @type {Cartesian3}
   * @readonly
   */
  get velocity() {
    return defined(this._referenceFrame) ? this._velocity : defined(this._velocity) ? this.parent._velocity : undefined;
  }

  /**
   * Gets the time of the last update for the object.
   * @type {JulianDate}
   * @readonly
   */
  get time() {
    return this._lastUpdate;
  }

  /**
   * Gets the name of the object.
   * @type {string}
   * @readonly
   */
  get name() {
    return this._name;
  }

  /**
   * Gets the world to local transform matrix for the object.
   * @type {Matrix4}
   * @readonly
   */
  get worldToLocalTransform() {
    this._updateTransformsIfDirty()
    return this._worldToLocalTransform;
  }

  /**
   * Gets the local to world transform matrix for the object.
   * @type {Matrix4}
   * @readonly
   */
  get localToWorldTransform() {
    this._updateTransformsIfDirty()
    return this._localToWorldTransform;
  }

  /**
   * Gets the world position (ECI) of the object.
   * @type {Cartesian3}
   * @readonly
   */
  get worldPosition() {
    if(this._referenceFrame === ReferenceFrame.INERTIAL)
      return this.position;
    else
      return this.transformPointToWorld(Cartesian3.ZERO);
  }

  /**
   * Gets the world velocity (ECI) of the object.
   * @type {Cartesian3}
   * @readonly
   */
  get worldVelocity() {
    if(this._referenceFrame === ReferenceFrame.INERTIAL)
      return this._velocity;
    else
      return undefined; //TODO
  }

  /**
   * Rotates this group around the X axis.
   * @param {Number} angle - The angle to rotate, in radians.
   * @override
   */
  rotateX(angle) {
    super.rotateX(angle);
    this._transformDirty = true;
  }

  /**
   * Rotates this group around the Y axis.
   * @param {Number} angle - The angle to rotate, in radians.
   * @override
   */
  rotateY(angle) {
    super.rotateY(angle);
    this._transformDirty = true;
  }

  /**
   * Rotates this group around the Z axis.
   * @param {Number} angle - The angle to rotate, in radians.
   * @override
   */
  rotateZ(angle) {
    super.rotateZ(angle);
    this._transformDirty = true;
  }

  /**
   * Translates this group.
   * @param {Cartesian3} cartesian3 - The translation vector.
   * @override
   */
  translate(cartesian3) {
    super.translate(cartesian3);
    this._transformDirty = true;
  }

  /**
   * Sets the translation of this group.
   * @param {Cartesian3} cartesian3 - The translation vector.
   * @override
   */
  setTranslation(cartesian3) {
    super.setTranslation(cartesian3);
    this._transformDirty = true;
  }

  /**
   * Sets the rotation of this group.
   * @param {Matrix3} matrix3 - The rotation matrix.
   * @override
   */
  setRotation(matrix3) {
    super.setRotation(matrix3);
    this._transformDirty = true;
  }

  /**
   * Sets the columns of this group's transformation matrix.
   * @param {Cartesian3} x - The X column.
   * @param {Cartesian3} y - The Y column.
   * @param {Cartesian3} z - The Z column.
   * @override
   */
  setColumns(x, y, z) {
    super.setColumns(x, y, z);
    this._transformDirty = true;
  }

  /**
   * Resets this group's transformation matrix to the identity matrix.
   * @override
   */
  reset() {
    super.reset();
    this._transformDirty = true;
  }  

  /**
   * Updates the object's position, velocity, and orientation.
   * @param {JulianDate} time - The time to update the object to.
   * @param {Universe} universe - The universe object.
   * @param {boolean} [forceUpdate=false] - Whether to force an update.
   * @param {boolean} [updateParent=true] - Whether to update the parent object.
   */
  update(time, universe, forceUpdate = false, updateParent = true) {
    if (!forceUpdate && JulianDate.equals(time, this._lastUpdate))
      return;

    if(updateParent && defined(this.parent))
      this.parent.update(time, universe, forceUpdate, updateParent);

    // override this function to update the position, velocity, and orientation
    this._update(time, universe);

    // update position (for cesium)
    this.setTranslation(this._position)
    
    JulianDate.clone(time, this._lastUpdate);
    this._lastUniverse = universe;

    // update any listeners
    this._updateListeners.forEach(ul => ul.update(time, universe));
  }

  /**
   * Updates the object's world to local and local to world transform matrices if they are dirty.
   * @private
   */
  _updateTransformsIfDirty() {
    if(this._transformDirty) {
      if(defined(this.parent) && !this.parent._lastUpdate.equals(this._lastUpdate)) {
        this.parent.update(this._lastUpdate, this._lastUniverse, true, false);
      }
      this._localToWorldTransform = super.localToWorldTransform;
      Matrix4.inverseTransformation(this._localToWorldTransform, this._worldToLocalTransform);
      this._transformDirty = false;
    }
  }

  /**
   * Override this function to update the position, velocity, and orientation of the object.
   * @param {JulianDate} time - The time to update the object to.
   * @param {Universe} universe - The universe object.
   * @abstract
   */
  _update(time, universe) {
    throw new Error('SimObject._update must be implemented in derived classes.');
  }

}

export default SimObject;
