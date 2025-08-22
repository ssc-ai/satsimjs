import { Matrix3, Matrix4, Cartesian3 } from 'cesium';
import Group from './Group.js';

const _scratchMatrix3 = new Matrix3();

/**
 * A group node with a 4x4 transformation matrix for complex 3D transformations.
 * 
 * The TransformGroup extends Group to provide a transformation matrix that
 * affects all child nodes. This matrix can represent any combination of
 * translation, rotation, and scaling operations in 3D space.
 * 
 * The transformation matrix is applied to all coordinate transformations
 * involving this node and its children, enabling complex hierarchical
 * transformations in satellite simulations and 3D scenes.
 * 
 * @example
 * // Create a transform group with rotation and translation
 * const transformGroup = new TransformGroup();
 * 
 * // Rotate 45 degrees around Z-axis
 * transformGroup.rotateZ(Math.PI / 4);
 * 
 * // Translate 100 units in X direction
 * transformGroup.translate(new Cartesian3(100, 0, 0));
 * 
 * @example
 * // Set up satellite body coordinate frame
 * const satelliteFrame = new TransformGroup();
 * 
 * // Set initial orientation (pointing nadir)
 * const rotation = Matrix3.fromQuaternion(attitudeQuaternion);
 * satelliteFrame.setRotation(rotation);
 * 
 * // Set orbital position
 * satelliteFrame.setTranslation(orbitalPosition);
 * 
 * @extends Group
 */
class TransformGroup extends Group {

  /**
   * Creates a new transform group.
   */
  constructor() {
    super();
    /**
     * The transformation matrix of this group.
     * @type {Matrix4}
     * @private
     */
    this._transform = Matrix4.IDENTITY.clone();
  }

  /**
   * Rotates this group around the X axis.
   * 
   * @param {Number} angle - The angle to rotate, in radians.
   * 
   * @example
   * // Rotate satellite 90 degrees around X-axis (pitch up)
   * satelliteGroup.rotateX(Math.PI / 2);
   */
  rotateX(angle) {
    Matrix3.fromRotationX(angle, _scratchMatrix3);
    Matrix4.multiplyByMatrix3(this._transform, _scratchMatrix3, this._transform);
  }

  /**
   * Rotates this group around the Y axis.
   * 
   * @param {Number} angle - The angle to rotate, in radians.
   * 
   * @example
   * // Rotate satellite 45 degrees around Y-axis (yaw left)
   * satelliteGroup.rotateY(Math.PI / 4);
   */
  rotateY(angle) {
    Matrix3.fromRotationY(angle, _scratchMatrix3);
    Matrix4.multiplyByMatrix3(this._transform, _scratchMatrix3, this._transform);
  }

  /**
   * Rotates this group around the Z axis.
   * 
   * @param {Number} angle - The angle to rotate, in radians.
   * 
   * @example
   * // Rotate satellite 30 degrees around Z-axis (roll)
   * satelliteGroup.rotateZ(Math.PI / 6);
   */
  rotateZ(angle) {
    Matrix3.fromRotationZ(angle, _scratchMatrix3);
    Matrix4.multiplyByMatrix3(this._transform, _scratchMatrix3, this._transform);
  }

  /**
   * Translates this group by adding to its current translation.
   * 
   * @param {Cartesian3} cartesian3 - The translation vector to add.
   * 
   * @example
   * // Move satellite 1000 km in the positive X direction
   * const translation = new Cartesian3(1000000, 0, 0); // meters
   * satelliteGroup.translate(translation);
   */
  translate(cartesian3) {
    Matrix4.multiplyByTranslation(this._transform, cartesian3, this._transform);
  }

  /**
   * Sets the absolute translation of this group, replacing any existing translation.
   * 
   * @param {Cartesian3} cartesian3 - The new translation vector.
   * 
   * @example
   * // Position satellite at specific orbital location
   * const position = new Cartesian3(-6378137, 0, 0); // At Earth's surface
   * satelliteGroup.setTranslation(position);
   */
  setTranslation(cartesian3) {
    this._transform[12] = cartesian3.x;
    this._transform[13] = cartesian3.y;
    this._transform[14] = cartesian3.z;
  }

  /**
   * Sets the absolute rotation of this group, replacing any existing rotation.
   * 
   * @param {Matrix3} matrix3 - The 3x3 rotation matrix.
   * 
   * @example
   * // Set satellite attitude from quaternion
   * const quaternion = new Quaternion(0, 0, 0, 1); // Identity
   * const rotationMatrix = Matrix3.fromQuaternion(quaternion);
   * satelliteGroup.setRotation(rotationMatrix);
   * 
   * @example
   * // Point satellite nadir (towards Earth)
   * const nadirRotation = Matrix3.fromRotationY(Math.PI);
   * satelliteGroup.setRotation(nadirRotation);
   */
  setRotation(matrix3) {
    this._transform[0] = matrix3[0];
    this._transform[1] = matrix3[1];
    this._transform[2] = matrix3[2];
    this._transform[4] = matrix3[3];
    this._transform[5] = matrix3[4];
    this._transform[6] = matrix3[5];
    this._transform[8] = matrix3[6];
    this._transform[9] = matrix3[7];
    this._transform[10] = matrix3[8];
  }

  /**
   * Sets the columns of this group's transformation matrix.
   * @param {Cartesian3} x - The X column.
   * @param {Cartesian3} y - The Y column.
   * @param {Cartesian3} z - The Z column.
   */
  setColumns(x, y, z) {
    this._transform[0] = x.x;
    this._transform[1] = x.y;
    this._transform[2] = x.z;
    this._transform[4] = y.x;
    this._transform[5] = y.y;
    this._transform[6] = y.z;
    this._transform[8] = z.x;
    this._transform[9] = z.y;
    this._transform[10] = z.z;
  }

  /**
   * Resets this group's transformation matrix to the identity matrix.
   */
  reset() {
    Matrix4.clone(Matrix4.IDENTITY, this._transform);
  }

  /**
   * Returns this group's transformation matrix.
   * @type {Matrix4}
   */
  get transform() {
    return this._transform;
  }

  /**
   * Returns this group's local transformation matrix.
   * @type {Matrix4}
   */
  get localTransform() {
    return this._transform.clone();
  }


  /**
   * Sets this group's transformation matrix.
   * @param {Matrix4} value - The new transformation matrix.
   */
  set transform(value) {
    Matrix4.clone(value, this._transform);
  }

}

export default TransformGroup;
