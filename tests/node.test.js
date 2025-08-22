// Mock Cesium dependencies
jest.mock('cesium', () => ({
  Matrix4: jest.fn().mockImplementation(() => ({
    equals: jest.fn(() => true),
    clone: jest.fn(() => ({ cloned: true }))
  })),
  Cartesian3: jest.fn().mockImplementation((x = 0, y = 0, z = 0) => ({ x, y, z })),
  defined: jest.fn((value) => value !== undefined && value !== null)
}));

// Add static methods to Matrix4 mock
const Matrix4Mock = require('cesium').Matrix4;
Matrix4Mock.IDENTITY = {
  clone: jest.fn(() => ({ identity: 'cloned' }))
};
Matrix4Mock.multiplyByPoint = jest.fn((matrix, point, result) => {
  if (!point) return { x: 0, y: 0, z: 0 };
  if (result) {
    result.x = point.x + 1;
    result.y = point.y + 2;
    result.z = point.z + 3;
    return result;
  }
  return { x: point.x + 1, y: point.y + 2, z: point.z + 3 };
});
Matrix4Mock.multiplyByPointAsVector = jest.fn((matrix, vector, result) => {
  if (!vector) return { x: 0, y: 0, z: 0 };
  if (result) {
    result.x = vector.x * 2;
    result.y = vector.y * 2;
    result.z = vector.z * 2;
    return result;
  }
  return { x: vector.x * 2, y: vector.y * 2, z: vector.z * 2 };
});
Matrix4Mock.multiply = jest.fn((left, right, result) => {
  return result || { multiplied: true };
});
Matrix4Mock.clone = jest.fn((matrix, result) => {
  return result || { ...matrix };
});
Matrix4Mock.inverseTransformation = jest.fn((matrix, result) => {
  return result || { inverse: true };
});

const Cartesian3Mock = require('cesium').Cartesian3;
Cartesian3Mock.fromElements = jest.fn((x, y, z) => ({ x, y, z }));

import Node from '../src/engine/graph/Node.js';
import { Matrix4, Cartesian3, defined } from 'cesium';

describe('Node', () => {
  let node;
  let parentNode;
  let childNode;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create new instances for each test
    node = new Node();
    parentNode = new Node();
    childNode = new Node();

    // Setup mock implementations for defined function
    defined.mockImplementation((value) => value !== undefined && value !== null);
  });

  describe('constructor', () => {
    it('should create a new Node with null parent', () => {
      const newNode = new Node();
      
      expect(newNode.parent).toBeNull();
    });

    it('should create multiple Node instances independently', () => {
      const node1 = new Node();
      const node2 = new Node();
      
      expect(node1.parent).toBeNull();
      expect(node2.parent).toBeNull();
      expect(node1).not.toBe(node2);
    });
  });

  describe('attach method', () => {
    it('should attach node to a parent', () => {
      // Mock the addChild method on parent
      parentNode.addChild = jest.fn();
      
      node.attach(parentNode);
      
      expect(parentNode.addChild).toHaveBeenCalledWith(node);
    });

    it('should detach from current parent before attaching to new parent', () => {
      const oldParent = new Node();
      oldParent.removeChild = jest.fn();
      oldParent.addChild = jest.fn();
      parentNode.addChild = jest.fn();
      
      // Set up existing parent relationship
      node.parent = oldParent;
      
      node.attach(parentNode);
      
      expect(oldParent.removeChild).toHaveBeenCalledWith(node);
      expect(parentNode.addChild).toHaveBeenCalledWith(node);
    });

    it('should handle attaching when no current parent exists', () => {
      parentNode.addChild = jest.fn();
      
      expect(node.parent).toBeNull();
      
      node.attach(parentNode);
      
      expect(parentNode.addChild).toHaveBeenCalledWith(node);
    });

    it('should handle multiple attach operations', () => {
      const parent1 = new Node();
      const parent2 = new Node();
      parent1.removeChild = jest.fn();
      parent1.addChild = jest.fn();
      parent2.addChild = jest.fn();
      
      node.attach(parent1);
      expect(parent1.addChild).toHaveBeenCalledWith(node);
      
      // Set up the parent relationship manually since we're mocking
      node.parent = parent1;
      
      node.attach(parent2);
      expect(parent1.removeChild).toHaveBeenCalledWith(node);
      expect(parent2.addChild).toHaveBeenCalledWith(node);
    });
  });

  describe('detach method', () => {
    it('should detach from parent when parent exists', () => {
      parentNode.removeChild = jest.fn();
      node.parent = parentNode;
      
      node.detach();
      
      expect(parentNode.removeChild).toHaveBeenCalledWith(node);
    });

    it('should handle detach when no parent exists', () => {
      expect(node.parent).toBeNull();
      
      // Should not throw error
      expect(() => node.detach()).not.toThrow();
    });

    it('should handle detach when parent is null', () => {
      node.parent = null;
      
      expect(() => node.detach()).not.toThrow();
    });

    it('should handle detach when parent is undefined', () => {
      node.parent = undefined;
      
      expect(() => node.detach()).not.toThrow();
    });
  });

  describe('transformPointToWorld method', () => {
    beforeEach(() => {
      // Mock the localToWorldTransform getter
      Object.defineProperty(node, 'localToWorldTransform', {
        get: jest.fn(() => ({ mockMatrix: 'localToWorld' })),
        configurable: true
      });
    });

    it('should transform a local point to world coordinates', () => {
      const localPoint = new Cartesian3(1, 2, 3);
      const result = node.transformPointToWorld(localPoint);
      
      expect(Matrix4.multiplyByPoint).toHaveBeenCalledWith(
        { mockMatrix: 'localToWorld' }, 
        localPoint, 
        expect.any(Object)
      );
      expect(result).toEqual({ x: 2, y: 4, z: 6 }); // 1+1, 2+2, 3+3 based on mock
    });

    it('should use provided result object', () => {
      const localPoint = new Cartesian3(1, 2, 3);
      const resultObj = new Cartesian3();
      
      const result = node.transformPointToWorld(localPoint, resultObj);
      
      expect(Matrix4.multiplyByPoint).toHaveBeenCalledWith(
        { mockMatrix: 'localToWorld' }, 
        localPoint, 
        resultObj
      );
      expect(result).toBe(resultObj);
    });

    it('should create new result object when not provided', () => {
      const localPoint = new Cartesian3(1, 2, 3);
      
      const result = node.transformPointToWorld(localPoint);
      
      expect(Cartesian3).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle zero vector input', () => {
      const localPoint = new Cartesian3(0, 0, 0);
      
      const result = node.transformPointToWorld(localPoint);
      
      expect(Matrix4.multiplyByPoint).toHaveBeenCalled();
      expect(result).toEqual({ x: 1, y: 2, z: 3 }); // 0+1, 0+2, 0+3 based on mock
    });

    it('should handle negative coordinates', () => {
      const localPoint = new Cartesian3(-1, -2, -3);
      
      const result = node.transformPointToWorld(localPoint);
      
      expect(result).toEqual({ x: 0, y: 0, z: 0 }); // -1+1, -2+2, -3+3 based on mock
    });
  });

  describe('transformPointFromWorld method', () => {
    beforeEach(() => {
      // Mock the worldToLocalTransform getter
      Object.defineProperty(node, 'worldToLocalTransform', {
        get: jest.fn(() => ({ mockMatrix: 'worldToLocal' })),
        configurable: true
      });
    });

    it('should transform a world point to local coordinates', () => {
      const worldPoint = new Cartesian3(1, 2, 3);
      
      const result = node.transformPointFromWorld(worldPoint);
      
      expect(Matrix4.multiplyByPoint).toHaveBeenCalledWith(
        { mockMatrix: 'worldToLocal' }, 
        worldPoint, 
        expect.any(Object)
      );
      expect(result).toEqual({ x: 2, y: 4, z: 6 });
    });

    it('should use provided result object', () => {
      const worldPoint = new Cartesian3(1, 2, 3);
      const resultObj = new Cartesian3();
      
      const result = node.transformPointFromWorld(worldPoint, resultObj);
      
      expect(Matrix4.multiplyByPoint).toHaveBeenCalledWith(
        { mockMatrix: 'worldToLocal' }, 
        worldPoint, 
        resultObj
      );
      expect(result).toBe(resultObj);
    });

    it('should create new result object when not provided', () => {
      const worldPoint = new Cartesian3(1, 2, 3);
      
      const result = node.transformPointFromWorld(worldPoint);
      
      expect(Cartesian3).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('transformPointTo method', () => {
    let destinationNode;

    beforeEach(() => {
      destinationNode = new Node();
      
      // Mock transform methods
      node.transformPointToWorld = jest.fn(() => ({ x: 10, y: 20, z: 30 }));
      destinationNode.transformPointFromWorld = jest.fn(() => ({ x: 5, y: 10, z: 15 }));
    });

    it('should transform point from this node to destination node', () => {
      const localPoint = new Cartesian3(1, 2, 3);
      
      const result = node.transformPointTo(destinationNode, localPoint);
      
      expect(node.transformPointToWorld).toHaveBeenCalledWith(localPoint);
      expect(destinationNode.transformPointFromWorld).toHaveBeenCalledWith(
        { x: 10, y: 20, z: 30 }, 
        undefined
      );
      expect(result).toEqual({ x: 5, y: 10, z: 15 });
    });

    it('should use provided result object', () => {
      const localPoint = new Cartesian3(1, 2, 3);
      const resultObj = new Cartesian3();
      
      const result = node.transformPointTo(destinationNode, localPoint, resultObj);
      
      expect(destinationNode.transformPointFromWorld).toHaveBeenCalledWith(
        { x: 10, y: 20, z: 30 }, 
        resultObj
      );
      expect(result).toEqual({ x: 5, y: 10, z: 15 });
    });

    it('should handle transformation to same node', () => {
      const localPoint = new Cartesian3(1, 2, 3);
      
      // Mock the actual methods on the node instance
      node.transformPointToWorld = jest.fn(() => ({ x: 10, y: 20, z: 30 }));
      node.transformPointFromWorld = jest.fn(() => ({ x: 5, y: 10, z: 15 }));
      
      const result = node.transformPointTo(node, localPoint);
      
      expect(node.transformPointToWorld).toHaveBeenCalledWith(localPoint);
      expect(node.transformPointFromWorld).toHaveBeenCalledWith({ x: 10, y: 20, z: 30 }, undefined);
    });
  });

  describe('transformVectorToWorld method', () => {
    beforeEach(() => {
      Object.defineProperty(node, 'localToWorldTransform', {
        get: jest.fn(() => ({ mockMatrix: 'localToWorld' })),
        configurable: true
      });
    });

    it('should transform a local vector to world coordinates', () => {
      const localVector = new Cartesian3(1, 2, 3);
      
      const result = node.transformVectorToWorld(localVector);
      
      expect(Matrix4.multiplyByPointAsVector).toHaveBeenCalledWith(
        { mockMatrix: 'localToWorld' }, 
        localVector, 
        expect.any(Object)
      );
      expect(result).toEqual({ x: 2, y: 4, z: 6 }); // 1*2, 2*2, 3*2 based on mock
    });

    it('should use provided result object', () => {
      const localVector = new Cartesian3(1, 2, 3);
      const resultObj = new Cartesian3();
      
      const result = node.transformVectorToWorld(localVector, resultObj);
      
      expect(Matrix4.multiplyByPointAsVector).toHaveBeenCalledWith(
        { mockMatrix: 'localToWorld' }, 
        localVector, 
        resultObj
      );
      expect(result).toBe(resultObj);
    });

    it('should create new result object when not provided', () => {
      const localVector = new Cartesian3(1, 2, 3);
      
      const result = node.transformVectorToWorld(localVector);
      
      expect(Cartesian3).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle unit vectors', () => {
      const unitVector = new Cartesian3(1, 0, 0);
      
      const result = node.transformVectorToWorld(unitVector);
      
      expect(result).toEqual({ x: 2, y: 0, z: 0 });
    });
  });

  describe('transformVectorFromWorld method', () => {
    beforeEach(() => {
      Object.defineProperty(node, 'worldToLocalTransform', {
        get: jest.fn(() => ({ mockMatrix: 'worldToLocal' })),
        configurable: true
      });
    });

    it('should transform a world vector to local coordinates', () => {
      const worldVector = new Cartesian3(1, 2, 3);
      
      const result = node.transformVectorFromWorld(worldVector);
      
      expect(Matrix4.multiplyByPointAsVector).toHaveBeenCalledWith(
        { mockMatrix: 'worldToLocal' }, 
        worldVector, 
        expect.any(Object)
      );
      expect(result).toEqual({ x: 2, y: 4, z: 6 });
    });

    it('should use provided result object', () => {
      const worldVector = new Cartesian3(1, 2, 3);
      const resultObj = new Cartesian3();
      
      const result = node.transformVectorFromWorld(worldVector, resultObj);
      
      expect(Matrix4.multiplyByPointAsVector).toHaveBeenCalledWith(
        { mockMatrix: 'worldToLocal' }, 
        worldVector, 
        resultObj
      );
      expect(result).toBe(resultObj);
    });

    it('should create new result object when not provided', () => {
      const worldVector = new Cartesian3(1, 2, 3);
      
      const result = node.transformVectorFromWorld(worldVector);
      
      expect(Cartesian3).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('transformVectorTo method', () => {
    let destinationNode;

    beforeEach(() => {
      destinationNode = new Node();
      
      // Mock transform methods
      node.transformVectorToWorld = jest.fn(() => ({ x: 10, y: 20, z: 30 }));
      destinationNode.transformVectorFromWorld = jest.fn(() => ({ x: 5, y: 10, z: 15 }));
    });

    it('should transform vector from this node to destination node', () => {
      const localVector = new Cartesian3(1, 2, 3);
      
      const result = node.transformVectorTo(destinationNode, localVector);
      
      expect(node.transformVectorToWorld).toHaveBeenCalledWith(localVector);
      expect(destinationNode.transformVectorFromWorld).toHaveBeenCalledWith(
        { x: 10, y: 20, z: 30 }, 
        undefined
      );
      expect(result).toEqual({ x: 5, y: 10, z: 15 });
    });

    it('should use provided result object', () => {
      const localVector = new Cartesian3(1, 2, 3);
      const resultObj = new Cartesian3();
      
      const result = node.transformVectorTo(destinationNode, localVector, resultObj);
      
      expect(destinationNode.transformVectorFromWorld).toHaveBeenCalledWith(
        { x: 10, y: 20, z: 30 }, 
        resultObj
      );
      expect(result).toEqual({ x: 5, y: 10, z: 15 });
    });

    it('should handle vector transformation to same node', () => {
      const localVector = new Cartesian3(1, 2, 3);
      
      // Mock the actual methods on the node instance  
      node.transformVectorToWorld = jest.fn(() => ({ x: 10, y: 20, z: 30 }));
      node.transformVectorFromWorld = jest.fn(() => ({ x: 5, y: 10, z: 15 }));
      
      const result = node.transformVectorTo(node, localVector);
      
      expect(node.transformVectorToWorld).toHaveBeenCalledWith(localVector);
      expect(node.transformVectorFromWorld).toHaveBeenCalledWith({ x: 10, y: 20, z: 30 }, undefined);
    });
  });

  describe('localToWorldTransform getter', () => {
    it('should return identity matrix when no parent', () => {
      // Mock transform getter to return identity
      Object.defineProperty(node, 'transform', {
        get: jest.fn(() => ({ identity: true })),
        configurable: true
      });
      
      node.parent = null;
      defined.mockReturnValue(false);
      
      const result = node.localToWorldTransform;
      
      expect(Matrix4.clone).toHaveBeenCalledWith({ identity: true }, expect.any(Object));
    });

    it('should multiply parent transform with own transform when parent exists', () => {
      const mockParentTransform = { parent: 'transform' };
      const mockOwnTransform = { own: 'transform' };
      
      // Mock parent's localToWorldTransform getter
      Object.defineProperty(parentNode, 'localToWorldTransform', {
        get: jest.fn(() => mockParentTransform),
        configurable: true
      });
      Object.defineProperty(node, 'transform', {
        get: jest.fn(() => mockOwnTransform),
        configurable: true
      });
      
      node.parent = parentNode;
      defined.mockReturnValue(true);
      
      const result = node.localToWorldTransform;
      
      expect(Matrix4.multiply).toHaveBeenCalledWith(
        mockParentTransform, 
        mockOwnTransform, 
        expect.any(Object)
      );
    });

    it('should handle deep parent hierarchy', () => {
      const grandParent = new Node();
      const mockGrandParentTransform = { grandParent: 'transform' };
      const mockParentTransform = { parent: 'transform' };
      const mockOwnTransform = { own: 'transform' };
      
      // Mock grandparent's localToWorldTransform
      Object.defineProperty(grandParent, 'localToWorldTransform', {
        get: jest.fn(() => mockGrandParentTransform),
        configurable: true
      });
      
      // Mock parent's localToWorldTransform
      Object.defineProperty(parentNode, 'localToWorldTransform', {
        get: jest.fn(() => mockParentTransform),
        configurable: true
      });
      
      Object.defineProperty(node, 'transform', {
        get: jest.fn(() => mockOwnTransform),
        configurable: true
      });
      
      parentNode.parent = grandParent;
      node.parent = parentNode;
      defined.mockReturnValue(true);
      
      const result = node.localToWorldTransform;
      
      expect(Matrix4.multiply).toHaveBeenCalled();
    });
  });

  describe('worldToLocalTransform getter', () => {
    it('should return inverse of localToWorldTransform', () => {
      const mockLocalToWorld = { localToWorld: 'matrix' };
      Object.defineProperty(node, 'localToWorldTransform', {
        get: jest.fn(() => mockLocalToWorld),
        configurable: true
      });
      
      const result = node.worldToLocalTransform;
      
      expect(Matrix4.inverseTransformation).toHaveBeenCalledWith(
        mockLocalToWorld, 
        expect.any(Object)
      );
    });

    it('should create new Matrix4 for the result', () => {
      Object.defineProperty(node, 'localToWorldTransform', {
        get: jest.fn(() => ({ mock: 'matrix' })),
        configurable: true
      });
      
      const result = node.worldToLocalTransform;
      
      // Check that Matrix4.inverseTransformation was called
      expect(Matrix4.inverseTransformation).toHaveBeenCalledWith(
        { mock: 'matrix' },
        expect.any(Object)
      );
      expect(result).toBeDefined();
    });
  });

  describe('transform getter', () => {
    it('should return identity matrix clone', () => {
      const mockClone = { cloned: 'identity' };
      Matrix4.IDENTITY.clone.mockReturnValue(mockClone);
      
      const result = node.transform;
      
      expect(Matrix4.IDENTITY.clone).toHaveBeenCalled();
      expect(result).toBe(mockClone);
    });

    it('should return new clone each time', () => {
      const mockClone1 = { cloned: 'identity1' };
      const mockClone2 = { cloned: 'identity2' };
      Matrix4.IDENTITY.clone
        .mockReturnValueOnce(mockClone1)
        .mockReturnValueOnce(mockClone2);
      
      const result1 = node.transform;
      const result2 = node.transform;
      
      expect(Matrix4.IDENTITY.clone).toHaveBeenCalledTimes(2);
      expect(result1).toBe(mockClone1);
      expect(result2).toBe(mockClone2);
    });
  });

  describe('localTransform getter', () => {
    it('should return identity clone when no parent', () => {
      node.parent = null;
      const mockClone = { cloned: 'identity' };
      Matrix4.IDENTITY.clone.mockReturnValue(mockClone);
      
      const result = node.localTransform;
      
      expect(Matrix4.IDENTITY.clone).toHaveBeenCalled();
      expect(result).toBe(mockClone);
    });

    it('should return parent localTransform clone when parent exists', () => {
      const mockParentTransform = { parent: 'localTransform' };
      const mockClone = { cloned: 'parentTransform' };
      
      // Mock parent's localTransform getter
      Object.defineProperty(parentNode, 'localTransform', {
        get: jest.fn(() => mockParentTransform),
        configurable: true
      });
      mockParentTransform.clone = jest.fn(() => mockClone);
      
      node.parent = parentNode;
      
      const result = node.localTransform;
      
      expect(mockParentTransform.clone).toHaveBeenCalled();
      expect(result).toBe(mockClone);
    });

    it('should handle deep parent hierarchy for localTransform', () => {
      const grandParent = new Node();
      const mockGrandParentTransform = { grandParent: 'localTransform' };
      const mockClone = { cloned: 'grandParentTransform' };
      
      // Mock grandparent's localTransform
      Object.defineProperty(grandParent, 'localTransform', {
        get: jest.fn(() => mockGrandParentTransform),
        configurable: true
      });
      mockGrandParentTransform.clone = jest.fn(() => mockClone);
      
      // Mock parent's localTransform to return grandparent's
      Object.defineProperty(parentNode, 'localTransform', {
        get: jest.fn(() => mockGrandParentTransform),
        configurable: true
      });
      
      parentNode.parent = grandParent;
      node.parent = parentNode;
      
      const result = node.localTransform;
      
      expect(result).toBe(mockClone);
    });
  });

  describe('worldPosition getter', () => {
    it('should extract position from localToWorldTransform matrix', () => {
      const mockTransform = [
        1, 0, 0, 0,
        0, 1, 0, 0, 
        0, 0, 1, 0,
        10, 20, 30, 1  // position in elements [12], [13], [14]
      ];
      
      Object.defineProperty(node, 'localToWorldTransform', {
        get: jest.fn(() => mockTransform),
        configurable: true
      });
      
      // Mock Cartesian3.fromElements
      const mockPosition = { x: 10, y: 20, z: 30 };
      Cartesian3.fromElements = jest.fn(() => mockPosition);
      
      const result = node.worldPosition;
      
      expect(Cartesian3.fromElements).toHaveBeenCalledWith(10, 20, 30);
      expect(result).toBe(mockPosition);
    });

    it('should handle different matrix positions', () => {
      const mockTransform = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        -5, 15, -25, 1
      ];
      
      Object.defineProperty(node, 'localToWorldTransform', {
        get: jest.fn(() => mockTransform),
        configurable: true
      });
      
      const mockPosition = { x: -5, y: 15, z: -25 };
      Cartesian3.fromElements = jest.fn(() => mockPosition);
      
      const result = node.worldPosition;
      
      expect(Cartesian3.fromElements).toHaveBeenCalledWith(-5, 15, -25);
      expect(result).toBe(mockPosition);
    });

    it('should handle zero position', () => {
      const mockTransform = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ];
      
      Object.defineProperty(node, 'localToWorldTransform', {
        get: jest.fn(() => mockTransform),
        configurable: true
      });
      
      const mockPosition = { x: 0, y: 0, z: 0 };
      Cartesian3.fromElements = jest.fn(() => mockPosition);
      
      const result = node.worldPosition;
      
      expect(Cartesian3.fromElements).toHaveBeenCalledWith(0, 0, 0);
      expect(result).toBe(mockPosition);
    });
  });

  describe('length getter', () => {
    it('should return zero', () => {
      expect(node.length).toBe(0);
    });

    it('should always return zero for different node instances', () => {
      const node1 = new Node();
      const node2 = new Node();
      
      expect(node1.length).toBe(0);
      expect(node2.length).toBe(0);
    });

    it('should return zero regardless of node state', () => {
      node.parent = parentNode;
      expect(node.length).toBe(0);
      
      node.parent = null;
      expect(node.length).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle undefined parent in attach', () => {
      const undefinedParent = undefined;
      
      expect(() => node.attach(undefinedParent)).toThrow();
    });

    it('should handle null parent in attach', () => {
      const nullParent = null;
      
      expect(() => node.attach(nullParent)).toThrow();
    });

    it('should handle transformation with null vectors', () => {
      Object.defineProperty(node, 'localToWorldTransform', {
        get: jest.fn(() => ({ mockMatrix: true })),
        configurable: true
      });
      
      // The mocked Matrix4.multiplyByPoint handles null gracefully
      expect(() => node.transformPointToWorld(null)).not.toThrow();
      expect(() => node.transformVectorToWorld(null)).not.toThrow();
    });

    it('should handle transformation with undefined vectors', () => {
      Object.defineProperty(node, 'localToWorldTransform', {
        get: jest.fn(() => ({ mockMatrix: true })),
        configurable: true
      });
      
      // The mocked Matrix4.multiplyByPoint handles undefined gracefully
      expect(() => node.transformPointToWorld(undefined)).not.toThrow();
      expect(() => node.transformVectorToWorld(undefined)).not.toThrow();
    });

    it('should detect circular parent references', () => {
      // This would be a problematic case in real usage
      node.parent = parentNode;
      parentNode.parent = node; // Circular reference
      
      // The localTransform getter will cause infinite recursion
      expect(() => node.localTransform).toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete attach/detach workflow', () => {
      parentNode.addChild = jest.fn();
      parentNode.removeChild = jest.fn();
      
      // Initial state
      expect(node.parent).toBeNull();
      
      // Attach
      node.attach(parentNode);
      expect(parentNode.addChild).toHaveBeenCalledWith(node);
      
      // Simulate parent relationship being established
      node.parent = parentNode;
      
      // Detach
      node.detach();
      expect(parentNode.removeChild).toHaveBeenCalledWith(node);
    });

    it('should handle transform chain operations', () => {
      const localPoint = new Cartesian3(1, 2, 3);
      const destinationNode = new Node();
      
      // Setup transform chain
      node.transformPointToWorld = jest.fn(() => ({ x: 10, y: 20, z: 30 }));
      destinationNode.transformPointFromWorld = jest.fn(() => ({ x: 5, y: 10, z: 15 }));
      
      const result = node.transformPointTo(destinationNode, localPoint);
      
      expect(node.transformPointToWorld).toHaveBeenCalledWith(localPoint);
      expect(destinationNode.transformPointFromWorld).toHaveBeenCalledWith({ x: 10, y: 20, z: 30 }, undefined);
      expect(result).toEqual({ x: 5, y: 10, z: 15 });
    });

    it('should handle multiple parent changes', () => {
      const parent1 = new Node();
      const parent2 = new Node();
      const parent3 = new Node();
      
      parent1.addChild = jest.fn();
      parent1.removeChild = jest.fn();
      parent2.addChild = jest.fn();
      parent2.removeChild = jest.fn();
      parent3.addChild = jest.fn();
      
      // Chain of parent changes
      node.attach(parent1);
      node.parent = parent1;
      
      node.attach(parent2);
      node.parent = parent2;
      
      node.attach(parent3);
      
      expect(parent1.addChild).toHaveBeenCalledWith(node);
      expect(parent1.removeChild).toHaveBeenCalledWith(node);
      expect(parent2.addChild).toHaveBeenCalledWith(node);
      expect(parent2.removeChild).toHaveBeenCalledWith(node);
      expect(parent3.addChild).toHaveBeenCalledWith(node);
    });
  });

  describe('performance and optimization', () => {
    it('should reuse result objects when provided for point transformations', () => {
      const localPoint = new Cartesian3(1, 2, 3);
      const resultObj = new Cartesian3();
      
      Object.defineProperty(node, 'localToWorldTransform', {
        get: jest.fn(() => ({ mockMatrix: true })),
        configurable: true
      });
      
      const result = node.transformPointToWorld(localPoint, resultObj);
      
      expect(result).toBe(resultObj);
      expect(Matrix4.multiplyByPoint).toHaveBeenCalledWith(
        expect.any(Object), 
        localPoint, 
        resultObj
      );
    });

    it('should reuse result objects when provided for vector transformations', () => {
      const localVector = new Cartesian3(1, 2, 3);
      const resultObj = new Cartesian3();
      
      Object.defineProperty(node, 'localToWorldTransform', {
        get: jest.fn(() => ({ mockMatrix: true })),
        configurable: true
      });
      
      const result = node.transformVectorToWorld(localVector, resultObj);
      
      expect(result).toBe(resultObj);
      expect(Matrix4.multiplyByPointAsVector).toHaveBeenCalledWith(
        expect.any(Object), 
        localVector, 
        resultObj
      );
    });

    it('should minimize object creation in transformation chains', () => {
      const localPoint = new Cartesian3(1, 2, 3);
      const destinationNode = new Node();
      const resultObj = new Cartesian3();
      
      node.transformPointToWorld = jest.fn(() => ({ x: 10, y: 20, z: 30 }));
      destinationNode.transformPointFromWorld = jest.fn(() => ({ x: 5, y: 10, z: 15 }));
      
      const result = node.transformPointTo(destinationNode, localPoint, resultObj);
      
      expect(destinationNode.transformPointFromWorld).toHaveBeenCalledWith(
        expect.any(Object), 
        resultObj
      );
    });
  });
});
