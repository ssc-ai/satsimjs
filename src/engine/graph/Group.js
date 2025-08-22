import Node from './Node.js';

/**
 * A group node that can contain multiple child nodes in a scene graph hierarchy.
 * 
 * The Group class extends Node to provide collection management capabilities,
 * allowing multiple child nodes to be organized under a single parent. This
 * enables hierarchical transformations where changes to the group affect all
 * its children collectively.
 * 
 * Groups are particularly useful for organizing related objects that should
 * move or transform together, such as components of a satellite or elements
 * of a ground station.
 * 
 * @example
 * // Create a group and add child nodes
 * const satelliteGroup = new Group();
 * const body = new Node();
 * const antenna = new Node();
 * 
 * satelliteGroup.addChild(body);
 * satelliteGroup.addChild(antenna);
 * 
 * @example
 * // Check if group has children
 * if (group.hasChildren) {
 *     console.log(`Group has ${group.children.length} children`);
 * }
 * 
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
    while (this.children.length > 0) {
      const child = this.children[0];
      this.removeChild(child);
    }
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
