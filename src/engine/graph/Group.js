import Node from './Node';

/**
 * A group of nodes that can have children added and removed.
 * @extends Node
 */
class Group extends Node {

  /**
   * Creates a new group.
   */
  constructor() {
    super();
    /**
     * The children of this group.
     * @type {Node[]}
     */
    this.children = [];
  }

  /**
   * Adds a child node to this group.
   * @param {Node} child - The child node to add.
   */
  addChild(child) {
    child.parent = this;
    this.children.push(child);
  }

  /**
   * Removes a child node from this group.
   * @param {Node} child - The child node to remove.
   */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      child.parent = null;
      this.children.splice(index, 1);
    }
  }

  /**
   * Removes all children from this group.
   */
  removeAll() {
    this.children.forEach(child => {
      this.removeChild(child);
    });
  }

  /**
   * Checks if this group has any children.
   * @returns {boolean} - True if this group has children, false otherwise.
   */
  hasChildren() {
    return this.children.length > 0;
  }

  /**
   * The number of children in this group.
   * @type {number}
   */
  get length() {
    return this.children.length;
  }
}

export default Group;
