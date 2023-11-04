import { Matrix3, Matrix4, Cartesian3 } from 'cesium';
import Group from './Group';

const _scratchMatrix3 = new Matrix3();

/**
 * A group note that contains a transform. This transform is applied to all children 
 * of this group. The effects of transformations in the scene graph are cumulative.
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
   * @param {Number} angle - The angle to rotate, in radians.
   */
  rotateX(angle) {
    Matrix3.fromRotationX(angle, _scratchMatrix3);
    Matrix4.multiplyByMatrix3(this._transform, _scratchMatrix3, this._transform);
  }

  /**
   * Rotates this group around the Y axis.
   * @param {Number} angle - The angle to rotate, in radians.
   */
  rotateY(angle) {
    Matrix3.fromRotationY(angle, _scratchMatrix3);
    Matrix4.multiplyByMatrix3(this._transform, _scratchMatrix3, this._transform);
  }

  /**
   * Rotates this group around the Z axis.
   * @param {Number} angle - The angle to rotate, in radians.
   */
  rotateZ(angle) {
    Matrix3.fromRotationZ(angle, _scratchMatrix3);
    Matrix4.multiplyByMatrix3(this._transform, _scratchMatrix3, this._transform);
  }

  /**
   * Translates this group.
   * @param {Cartesian3} cartesian3 - The translation vector.
   */
  translate(cartesian3) {
    Matrix4.multiplyByTranslation(this._transform, cartesian3, this._transform);
  }

  /**
   * Sets the translation of this group.
   * @param {Cartesian3} cartesian3 - The translation vector.
   */
  setTranslation(cartesian3) {
    this._transform[12] = cartesian3.x;
    this._transform[13] = cartesian3.y;
    this._transform[14] = cartesian3.z;
  }

  /**
   * Sets the rotation of this group.
   * @param {Matrix3} matrix3 - The rotation matrix.
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
   * Sets this group's transformation matrix.
   * @param {Matrix4} value - The new transformation matrix.
   */
  set transform(value) {
    Matrix4.clone(value, this._transform);
  }

}

export default TransformGroup;
