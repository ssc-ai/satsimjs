import Group from '../src/engine/graph/Group.js';
import Node from '../src/engine/graph/Node.js';

describe('Group', () => {
  let group;
  let node1;
  let node2;
  let node3;

  beforeEach(() => {
    group = new Group();
    node1 = new Node();
    node2 = new Node();
    node3 = new Node();
  });

  describe('constructor', () => {
    test('should create empty group', () => {
      expect(group).toBeInstanceOf(Group);
      expect(group.children).toEqual([]);
      expect(group.children.length).toBe(0);
    });

    test('should extend Node', () => {
      expect(group).toBeInstanceOf(Node);
    });
  });

  describe('addChild', () => {
    test('should add child to group', () => {
      group.addChild(node1);
      
      expect(group.children.length).toBe(1);
      expect(group.children[0]).toBe(node1);
      expect(node1.parent).toBe(group);
    });

    test('should add multiple children', () => {
      group.addChild(node1);
      group.addChild(node2);
      group.addChild(node3);
      
      expect(group.children.length).toBe(3);
      expect(group.children[0]).toBe(node1);
      expect(group.children[1]).toBe(node2);
      expect(group.children[2]).toBe(node3);
      expect(node1.parent).toBe(group);
      expect(node2.parent).toBe(group);
      expect(node3.parent).toBe(group);
    });

    test('should handle adding same child multiple times', () => {
      group.addChild(node1);
      group.addChild(node1); // Add same child again
      
      expect(group.children.length).toBe(2);
      expect(group.children[0]).toBe(node1);
      expect(group.children[1]).toBe(node1);
      expect(node1.parent).toBe(group);
    });
  });

  describe('removeChild', () => {
    test('should remove existing child', () => {
      group.addChild(node1);
      group.addChild(node2);
      
      group.removeChild(node1);
      
      expect(group.children.length).toBe(1);
      expect(group.children[0]).toBe(node2);
      expect(node1.parent).toBeNull();
      expect(node2.parent).toBe(group);
    });

    test('should handle removing non-existent child', () => {
      group.addChild(node1);
      
      // Try to remove a child that was never added
      group.removeChild(node2);
      
      expect(group.children.length).toBe(1);
      expect(group.children[0]).toBe(node1);
      expect(node1.parent).toBe(group);
      expect(node2.parent).toBeNull();
    });

    test('should handle removing from empty group', () => {
      group.removeChild(node1);
      
      expect(group.children.length).toBe(0);
      expect(node1.parent).toBeNull();
    });

    test('should remove middle child correctly', () => {
      group.addChild(node1);
      group.addChild(node2);
      group.addChild(node3);
      
      group.removeChild(node2);
      
      expect(group.children.length).toBe(2);
      expect(group.children[0]).toBe(node1);
      expect(group.children[1]).toBe(node3);
      expect(node1.parent).toBe(group);
      expect(node2.parent).toBeNull();
      expect(node3.parent).toBe(group);
    });

    test('should remove last child correctly', () => {
      group.addChild(node1);
      group.addChild(node2);
      group.addChild(node3);
      
      group.removeChild(node3);
      
      expect(group.children.length).toBe(2);
      expect(group.children[0]).toBe(node1);
      expect(group.children[1]).toBe(node2);
      expect(node1.parent).toBe(group);
      expect(node2.parent).toBe(group);
      expect(node3.parent).toBeNull();
    });

    test('should remove first child correctly', () => {
      group.addChild(node1);
      group.addChild(node2);
      group.addChild(node3);
      
      group.removeChild(node1);
      
      expect(group.children.length).toBe(2);
      expect(group.children[0]).toBe(node2);
      expect(group.children[1]).toBe(node3);
      expect(node1.parent).toBeNull();
      expect(node2.parent).toBe(group);
      expect(node3.parent).toBe(group);
    });
  });

  describe('removeAll', () => {
    test('should remove all children', () => {
      group.addChild(node1);
      group.addChild(node2);
      group.addChild(node3);
      
      group.removeAll();
      
      expect(group.children.length).toBe(0);
      expect(node1.parent).toBeNull();
      expect(node2.parent).toBeNull();
      expect(node3.parent).toBeNull();
    });

    test('should handle empty group', () => {
      group.removeAll();
      
      expect(group.children.length).toBe(0);
    });

    test('should handle single child', () => {
      group.addChild(node1);
      
      group.removeAll();
      
      expect(group.children.length).toBe(0);
      expect(node1.parent).toBeNull();
    });

    test('should work iteratively', () => {
      group.addChild(node1);
      group.addChild(node2);
      group.addChild(node3);
      
      const initialLength = group.children.length;
      expect(initialLength).toBe(3);
      
      group.removeAll();
      
      expect(group.children.length).toBe(0);
    });
  });

  describe('hasChildren', () => {
    test('should return false for empty group', () => {
      expect(group.hasChildren()).toBe(false);
    });

    test('should return true when group has children', () => {
      group.addChild(node1);
      expect(group.hasChildren()).toBe(true);
    });

    test('should return false after removing all children', () => {
      group.addChild(node1);
      group.addChild(node2);
      expect(group.hasChildren()).toBe(true);
      
      group.removeAll();
      expect(group.hasChildren()).toBe(false);
    });

    test('should return true with multiple children', () => {
      group.addChild(node1);
      group.addChild(node2);
      group.addChild(node3);
      expect(group.hasChildren()).toBe(true);
    });

    test('should update when children are added/removed', () => {
      expect(group.hasChildren()).toBe(false);
      
      group.addChild(node1);
      expect(group.hasChildren()).toBe(true);
      
      group.addChild(node2);
      expect(group.hasChildren()).toBe(true);
      
      group.removeChild(node1);
      expect(group.hasChildren()).toBe(true);
      
      group.removeChild(node2);
      expect(group.hasChildren()).toBe(false);
    });
  });

  describe('length getter', () => {
    test('should return 0 for empty group', () => {
      expect(group.length).toBe(0);
    });

    test('should return correct count with children', () => {
      group.addChild(node1);
      expect(group.length).toBe(1);
      
      group.addChild(node2);
      expect(group.length).toBe(2);
      
      group.addChild(node3);
      expect(group.length).toBe(3);
    });

    test('should update when children are removed', () => {
      group.addChild(node1);
      group.addChild(node2);
      group.addChild(node3);
      expect(group.length).toBe(3);
      
      group.removeChild(node2);
      expect(group.length).toBe(2);
      
      group.removeAll();
      expect(group.length).toBe(0);
    });

    test('should match children.length', () => {
      expect(group.length).toBe(group.children.length);
      
      group.addChild(node1);
      expect(group.length).toBe(group.children.length);
      
      group.addChild(node2);
      expect(group.length).toBe(group.children.length);
      
      group.removeChild(node1);
      expect(group.length).toBe(group.children.length);
    });
  });

  describe('integration tests', () => {
    test('should handle complex add/remove operations', () => {
      // Add multiple children
      group.addChild(node1);
      group.addChild(node2);
      group.addChild(node3);
      expect(group.length).toBe(3);
      expect(group.hasChildren()).toBe(true);
      
      // Remove some children
      group.removeChild(node2);
      expect(group.length).toBe(2);
      expect(group.hasChildren()).toBe(true);
      expect(group.children).toEqual([node1, node3]);
      
      // Add back a child
      group.addChild(node2);
      expect(group.length).toBe(3);
      expect(group.children).toEqual([node1, node3, node2]);
      
      // Remove all
      group.removeAll();
      expect(group.length).toBe(0);
      expect(group.hasChildren()).toBe(false);
      expect(group.children).toEqual([]);
    });

    test('should maintain parent relationships correctly', () => {
      const otherGroup = new Group();
      
      // Add to first group
      group.addChild(node1);
      expect(node1.parent).toBe(group);
      
      // Move to second group
      otherGroup.addChild(node1);
      expect(node1.parent).toBe(otherGroup);
      
      // Remove from second group
      otherGroup.removeChild(node1);
      expect(node1.parent).toBeNull();
    });

    test('should handle nested groups', () => {
      const childGroup = new Group();
      const grandchildNode = new Node();
      
      // Create hierarchy: group -> childGroup -> grandchildNode
      group.addChild(childGroup);
      childGroup.addChild(grandchildNode);
      
      expect(group.length).toBe(1);
      expect(childGroup.length).toBe(1);
      expect(childGroup.parent).toBe(group);
      expect(grandchildNode.parent).toBe(childGroup);
      
      // Remove nested structure
      group.removeAll();
      expect(group.length).toBe(0);
      expect(childGroup.parent).toBeNull();
      expect(childGroup.length).toBe(1); // grandchild still attached to childGroup
      expect(grandchildNode.parent).toBe(childGroup);
    });
  });

  describe('edge cases', () => {
    test('should handle null/undefined children gracefully', () => {
      // These should not throw errors
      expect(() => group.removeChild(null)).not.toThrow();
      expect(() => group.removeChild(undefined)).not.toThrow();
      expect(group.children.length).toBe(0);
    });

    test('should handle removing same child multiple times', () => {
      group.addChild(node1);
      expect(group.length).toBe(1);
      
      group.removeChild(node1);
      expect(group.length).toBe(0);
      expect(node1.parent).toBeNull();
      
      // Remove again - should be safe
      group.removeChild(node1);
      expect(group.length).toBe(0);
      expect(node1.parent).toBeNull();
    });

    test('should handle large number of children', () => {
      const manyNodes = [];
      for (let i = 0; i < 1000; i++) {
        manyNodes.push(new Node());
      }
      
      // Add all nodes
      manyNodes.forEach(node => group.addChild(node));
      expect(group.length).toBe(1000);
      expect(group.hasChildren()).toBe(true);
      
      // Remove all nodes
      group.removeAll();
      expect(group.length).toBe(0);
      expect(group.hasChildren()).toBe(false);
      
      // Check all nodes have null parent
      manyNodes.forEach(node => {
        expect(node.parent).toBeNull();
      });
    });
  });
});
