import { Matrix4, Cartesian3, defined } from 'cesium';

/**
 * A node in a scene graph.
 */
class Node {

  /**
   * Creates a new node.
   */
  constructor() {
    /**
     * The parent node.
     * @type {Node|null}
     */
    this.parent = null;
  }

  /**
   * Attaches this node to a parent node.
   * @param {Node} parent - The parent node to attach to.
   */
  attach(parent) {
    if (this.parent) {
      this.parent.removeChild(this);
    }
    parent.addChild(this);
  }

  /**
   * Detaches this node from its parent node.
   */
  detach() {
    if (this.parent) {
      this.parent.removeChild(this);
    }
  }

  /**
   * Transforms a local point to world coordinates.
   * @param {Cartesian3} localPoint - The local point to transform.
   * @param {Cartesian3} [result] - The object to store the result in.
   * @returns {Cartesian3} The transformed point in world coordinates.
   */
  transformPointToWorld(localPoint, result) {
    const localToWorldTransform = this.localToWorldTransform;
    if (!defined(result)) {
      result = new Cartesian3();
    }
    Matrix4.multiplyByPoint(localToWorldTransform, localPoint, result);
    return result;
  }

  /**
   * Transforms a world point to local coordinates.
   * @param {Cartesian3} worldPoint - The world point to transform.
   * @param {Cartesian3} [result] - The object to store the result in.
   * @returns {Cartesian3} The transformed point in local coordinates.
   */
  transformPointFromWorld(worldPoint, result) {
    // const worldToLocalTransform = new Matrix4();
    // Matrix4.inverseTransformation(this.localToWorldTransform, worldToLocalTransform);
    const worldToLocalTransform = this.worldToLocalTransform;
    if (!defined(result)) {
      result = new Cartesian3();
    }
    Matrix4.multiplyByPoint(worldToLocalTransform, worldPoint, result);
    return result;
  }

  /**
   * Transforms a local point from the this node's coordinate system to the destination node's coordinate system.
   * @param {Node} destinationNode - The node that the local point should be transformed to.
   * @param {Cartesian3} localPoint - The local point to transform.
   * @param {Cartesian3} [result] - The object to store the result in.
   * @returns {Cartesian3} The transformed point in the destination node's coordinate system.
   */
  transformPointTo(destinationNode, localPoint, result) {
    const worldPoint = this.transformPointToWorld(localPoint);
    const localResult = destinationNode.transformPointFromWorld(worldPoint, result);
    return localResult;
  }

  /**
   * Transforms a local vector to world coordinates.
   * @param {Cartesian3} localVector - The local vector to transform.
   * @param {Cartesian3} [result] - The object to store the result in.
   * @returns {Cartesian3} The transformed vector in world coordinates.
   */
  transformVectorToWorld(localVector, result) {
    if (!defined(result)) {
      result = new Cartesian3();
    }
    Matrix4.multiplyByPointAsVector(this.localToWorldTransform, localVector, result);
    return result;
  }

  /**
   * Transforms a world vector to local coordinates.
   * @param {Cartesian3} worldVector - The world vector to transform.
   * @param {Cartesian3} [result] - The object to store the result in.
   * @returns {Cartesian3} The transformed vector in local coordinates.
   */
  transformVectorFromWorld(worldVector, result) {
    if (!defined(result)) {
      result = new Cartesian3();
    }
    Matrix4.multiplyByPointAsVector(this.worldToLocalTransform, worldVector, result);
    return result;
  }

  /**
   * Transforms a local vector from the this node's coordinate system to the destination node's coordinate system.
   * @param {Node} destinationNode - The node that the local vector should be transformed to.
   * @param {Cartesian3} localVector - The local vector to transform.
   * @param {Cartesian3} [result] - The object to store the result in.
   * @returns {Cartesian3} The transformed vector in the destination node's coordinate system.
   */
  transformVectorTo(destinationNode, localVector, result) {
    const worldVector = this.transformVectorToWorld(localVector);
    const localResult = destinationNode.transformVectorFromWorld(worldVector, result);
    return localResult;
  }  

  /**
   * Gets the local-to-world transformation matrix for the node.
   * @returns {Matrix4} The local-to-world transformation matrix.
   */
  get localToWorldTransform() {
    let transform = new Matrix4();
    if (defined(this.parent)) {
      Matrix4.multiply(this.parent.localToWorldTransform, this.transform, transform);
    } else {
      Matrix4.clone(this.transform, transform);
    }
    return transform;
  }

  /**
   * Gets the world-to-local transformation matrix for the node.
   * @returns {Matrix4} The world-to-local transformation matrix.
   */
  get worldToLocalTransform() {
    const worldToLocalTransform = new Matrix4();
    Matrix4.inverseTransformation(this.localToWorldTransform, worldToLocalTransform);
    return worldToLocalTransform;
  }

  /**
   * Returns the transform of the node.
   * @returns {Matrix4} The identity matrix cloned.
   */
  get transform() {
    return Matrix4.IDENTITY.clone()
  }

  
  /**
   * Returns the world position of the node.
   * @returns {Cartesian3} The world position of the node.
   */
  get worldPosition() {
    let localToWorldTransform = this.localToWorldTransform
    return Cartesian3.fromElements(localToWorldTransform[12], localToWorldTransform[13], localToWorldTransform[14]);
  }

  /**
   * Returns zero.
   */
  get length() {
    return 0;
  }
}

export default Node;
