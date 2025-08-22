import { Matrix3, Matrix4, Cartesian3 } from 'cesium';
import TransformGroup from '../src/engine/graph/TransformGroup.js';

// Mock Cesium Matrix3 and Matrix4
jest.mock('cesium', () => {
  class MockMatrix3 {
    constructor() {
      this[0] = 1; this[1] = 0; this[2] = 0;
      this[3] = 0; this[4] = 1; this[5] = 0;
      this[6] = 0; this[7] = 0; this[8] = 1;
    }
    
    static fromRotationX = jest.fn((angle, result) => {
      if (result) {
        result[0] = 1; result[1] = 0; result[2] = 0;
        result[3] = 0; result[4] = Math.cos(angle); result[5] = -Math.sin(angle);
        result[6] = 0; result[7] = Math.sin(angle); result[8] = Math.cos(angle);
        return result;
      }
      return [1, 0, 0, 0, Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle)];
    });
    
    static fromRotationY = jest.fn((angle, result) => {
      if (result) {
        result[0] = Math.cos(angle); result[1] = 0; result[2] = Math.sin(angle);
        result[3] = 0; result[4] = 1; result[5] = 0;
        result[6] = -Math.sin(angle); result[7] = 0; result[8] = Math.cos(angle);
        return result;
      }
      return [Math.cos(angle), 0, Math.sin(angle), 0, 1, 0, -Math.sin(angle), 0, Math.cos(angle)];
    });
    
    static fromRotationZ = jest.fn((angle, result) => {
      if (result) {
        result[0] = Math.cos(angle); result[1] = -Math.sin(angle); result[2] = 0;
        result[3] = Math.sin(angle); result[4] = Math.cos(angle); result[5] = 0;
        result[6] = 0; result[7] = 0; result[8] = 1;
        return result;
      }
      return [Math.cos(angle), -Math.sin(angle), 0, Math.sin(angle), Math.cos(angle), 0, 0, 0, 1];
    });
  }

  return {
    Matrix3: MockMatrix3,
    Matrix4: {
      IDENTITY: {
        clone: jest.fn(() => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
      },
      clone: jest.fn((source, result) => {
        if (result) {
          for (let i = 0; i < 16; i++) {
            result[i] = source[i];
          }
          return result;
        }
        return [...source];
      }),
      multiplyByMatrix3: jest.fn((matrix4, matrix3, result) => {
        // Simplified implementation for testing
        if (result) {
          for (let i = 0; i < 16; i++) {
            result[i] = matrix4[i];
          }
          return result;
        }
        return matrix4;
      }),
      multiplyByTranslation: jest.fn((matrix, translation, result) => {
        // Simplified implementation for testing
        if (result) {
          for (let i = 0; i < 16; i++) {
            result[i] = matrix[i];
          }
          result[12] += translation.x;
          result[13] += translation.y;
          result[14] += translation.z;
          return result;
        }
        return matrix;
      })
    },
    Cartesian3: class Cartesian3 {
      constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
    }
  };
});

describe('TransformGroup', () => {
  let transformGroup;

  beforeEach(() => {
    jest.clearAllMocks();
    transformGroup = new TransformGroup();
  });

  describe('constructor', () => {
    test('should create instance with identity transform', () => {
      expect(transformGroup).toBeInstanceOf(TransformGroup);
      expect(transformGroup._transform).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    });

    test('should extend Group', () => {
      // TransformGroup extends Group - check for constructor heritage
      expect(transformGroup.constructor.name).toBe('TransformGroup');
      expect(Object.getPrototypeOf(transformGroup.constructor).name).toBe('Group');
    });
  });

  describe('rotateX', () => {
    test('should rotate around X axis', () => {
      const angle = Math.PI / 4;
      transformGroup.rotateX(angle);

      expect(Matrix3.fromRotationX).toHaveBeenCalledWith(angle, expect.any(Object));
      expect(Matrix4.multiplyByMatrix3).toHaveBeenCalledWith(
        transformGroup._transform,
        expect.any(Object),
        transformGroup._transform
      );
    });

    test('should handle zero angle', () => {
      transformGroup.rotateX(0);
      expect(Matrix3.fromRotationX).toHaveBeenCalledWith(0, expect.any(Object));
    });

    test('should handle negative angle', () => {
      transformGroup.rotateX(-Math.PI / 2);
      expect(Matrix3.fromRotationX).toHaveBeenCalledWith(-Math.PI / 2, expect.any(Object));
    });

    test('should handle multiple rotations', () => {
      transformGroup.rotateX(Math.PI / 4);
      transformGroup.rotateX(Math.PI / 4);
      expect(Matrix3.fromRotationX).toHaveBeenCalledTimes(2);
    });
  });

  describe('rotateY', () => {
    test('should rotate around Y axis', () => {
      const angle = Math.PI / 3;
      transformGroup.rotateY(angle);

      expect(Matrix3.fromRotationY).toHaveBeenCalledWith(angle, expect.any(Object));
      expect(Matrix4.multiplyByMatrix3).toHaveBeenCalledWith(
        transformGroup._transform,
        expect.any(Object),
        transformGroup._transform
      );
    });

    test('should handle zero angle', () => {
      transformGroup.rotateY(0);
      expect(Matrix3.fromRotationY).toHaveBeenCalledWith(0, expect.any(Object));
    });

    test('should handle full rotation', () => {
      transformGroup.rotateY(2 * Math.PI);
      expect(Matrix3.fromRotationY).toHaveBeenCalledWith(2 * Math.PI, expect.any(Object));
    });
  });

  describe('rotateZ', () => {
    test('should rotate around Z axis', () => {
      const angle = Math.PI / 6;
      transformGroup.rotateZ(angle);

      expect(Matrix3.fromRotationZ).toHaveBeenCalledWith(angle, expect.any(Object));
      expect(Matrix4.multiplyByMatrix3).toHaveBeenCalledWith(
        transformGroup._transform,
        expect.any(Object),
        transformGroup._transform
      );
    });

    test('should handle zero angle', () => {
      transformGroup.rotateZ(0);
      expect(Matrix3.fromRotationZ).toHaveBeenCalledWith(0, expect.any(Object));
    });

    test('should handle large angle', () => {
      transformGroup.rotateZ(4 * Math.PI);
      expect(Matrix3.fromRotationZ).toHaveBeenCalledWith(4 * Math.PI, expect.any(Object));
    });
  });

  describe('translate', () => {
    test('should translate by vector', () => {
      const translation = new Cartesian3(1, 2, 3);
      transformGroup.translate(translation);

      expect(Matrix4.multiplyByTranslation).toHaveBeenCalledWith(
        transformGroup._transform,
        translation,
        transformGroup._transform
      );
    });

    test('should handle zero translation', () => {
      const translation = new Cartesian3(0, 0, 0);
      transformGroup.translate(translation);
      expect(Matrix4.multiplyByTranslation).toHaveBeenCalledWith(
        transformGroup._transform,
        translation,
        transformGroup._transform
      );
    });

    test('should handle negative translation', () => {
      const translation = new Cartesian3(-5, -10, -15);
      transformGroup.translate(translation);
      expect(Matrix4.multiplyByTranslation).toHaveBeenCalledWith(
        transformGroup._transform,
        translation,
        transformGroup._transform
      );
    });

    test('should handle multiple translations', () => {
      const translation1 = new Cartesian3(1, 0, 0);
      const translation2 = new Cartesian3(0, 1, 0);
      
      transformGroup.translate(translation1);
      transformGroup.translate(translation2);
      
      expect(Matrix4.multiplyByTranslation).toHaveBeenCalledTimes(2);
    });
  });

  describe('setTranslation', () => {
    test('should set translation directly', () => {
      const translation = new Cartesian3(5, 10, 15);
      transformGroup.setTranslation(translation);

      expect(transformGroup._transform[12]).toBe(5);
      expect(transformGroup._transform[13]).toBe(10);
      expect(transformGroup._transform[14]).toBe(15);
    });

    test('should overwrite existing translation', () => {
      // Set initial translation
      transformGroup.setTranslation(new Cartesian3(1, 2, 3));
      expect(transformGroup._transform[12]).toBe(1);
      expect(transformGroup._transform[13]).toBe(2);
      expect(transformGroup._transform[14]).toBe(3);

      // Overwrite with new translation
      transformGroup.setTranslation(new Cartesian3(10, 20, 30));
      expect(transformGroup._transform[12]).toBe(10);
      expect(transformGroup._transform[13]).toBe(20);
      expect(transformGroup._transform[14]).toBe(30);
    });

    test('should handle zero translation', () => {
      transformGroup.setTranslation(new Cartesian3(0, 0, 0));
      expect(transformGroup._transform[12]).toBe(0);
      expect(transformGroup._transform[13]).toBe(0);
      expect(transformGroup._transform[14]).toBe(0);
    });

    test('should handle negative values', () => {
      transformGroup.setTranslation(new Cartesian3(-1, -2, -3));
      expect(transformGroup._transform[12]).toBe(-1);
      expect(transformGroup._transform[13]).toBe(-2);
      expect(transformGroup._transform[14]).toBe(-3);
    });
  });

  describe('setRotation', () => {
    test('should set rotation from matrix3', () => {
      const matrix3 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      transformGroup.setRotation(matrix3);

      expect(transformGroup._transform[0]).toBe(1);
      expect(transformGroup._transform[1]).toBe(2);
      expect(transformGroup._transform[2]).toBe(3);
      expect(transformGroup._transform[4]).toBe(4);
      expect(transformGroup._transform[5]).toBe(5);
      expect(transformGroup._transform[6]).toBe(6);
      expect(transformGroup._transform[8]).toBe(7);
      expect(transformGroup._transform[9]).toBe(8);
      expect(transformGroup._transform[10]).toBe(9);
    });

    test('should preserve translation when setting rotation', () => {
      // Set initial translation
      transformGroup.setTranslation(new Cartesian3(10, 20, 30));
      
      // Set rotation
      const matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      transformGroup.setRotation(matrix3);
      
      // Translation should remain unchanged
      expect(transformGroup._transform[12]).toBe(10);
      expect(transformGroup._transform[13]).toBe(20);
      expect(transformGroup._transform[14]).toBe(30);
    });

    test('should handle identity rotation', () => {
      const identityMatrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      transformGroup.setRotation(identityMatrix3);

      expect(transformGroup._transform[0]).toBe(1);
      expect(transformGroup._transform[1]).toBe(0);
      expect(transformGroup._transform[2]).toBe(0);
      expect(transformGroup._transform[4]).toBe(0);
      expect(transformGroup._transform[5]).toBe(1);
      expect(transformGroup._transform[6]).toBe(0);
      expect(transformGroup._transform[8]).toBe(0);
      expect(transformGroup._transform[9]).toBe(0);
      expect(transformGroup._transform[10]).toBe(1);
    });
  });

  describe('setColumns', () => {
    test('should set columns from vectors', () => {
      const x = new Cartesian3(1, 2, 3);
      const y = new Cartesian3(4, 5, 6);
      const z = new Cartesian3(7, 8, 9);
      
      transformGroup.setColumns(x, y, z);

      expect(transformGroup._transform[0]).toBe(1);
      expect(transformGroup._transform[1]).toBe(2);
      expect(transformGroup._transform[2]).toBe(3);
      expect(transformGroup._transform[4]).toBe(4);
      expect(transformGroup._transform[5]).toBe(5);
      expect(transformGroup._transform[6]).toBe(6);
      expect(transformGroup._transform[8]).toBe(7);
      expect(transformGroup._transform[9]).toBe(8);
      expect(transformGroup._transform[10]).toBe(9);
    });

    test('should preserve translation when setting columns', () => {
      // Set initial translation
      transformGroup.setTranslation(new Cartesian3(100, 200, 300));
      
      // Set columns
      const x = new Cartesian3(1, 0, 0);
      const y = new Cartesian3(0, 1, 0);
      const z = new Cartesian3(0, 0, 1);
      transformGroup.setColumns(x, y, z);
      
      // Translation should remain unchanged
      expect(transformGroup._transform[12]).toBe(100);
      expect(transformGroup._transform[13]).toBe(200);
      expect(transformGroup._transform[14]).toBe(300);
    });

    test('should handle unit vectors', () => {
      const x = new Cartesian3(1, 0, 0);
      const y = new Cartesian3(0, 1, 0);
      const z = new Cartesian3(0, 0, 1);
      
      transformGroup.setColumns(x, y, z);

      expect(transformGroup._transform[0]).toBe(1);
      expect(transformGroup._transform[1]).toBe(0);
      expect(transformGroup._transform[2]).toBe(0);
      expect(transformGroup._transform[4]).toBe(0);
      expect(transformGroup._transform[5]).toBe(1);
      expect(transformGroup._transform[6]).toBe(0);
      expect(transformGroup._transform[8]).toBe(0);
      expect(transformGroup._transform[9]).toBe(0);
      expect(transformGroup._transform[10]).toBe(1);
    });

    test('should handle zero vectors', () => {
      const x = new Cartesian3(0, 0, 0);
      const y = new Cartesian3(0, 0, 0);
      const z = new Cartesian3(0, 0, 0);
      
      transformGroup.setColumns(x, y, z);

      expect(transformGroup._transform[0]).toBe(0);
      expect(transformGroup._transform[1]).toBe(0);
      expect(transformGroup._transform[2]).toBe(0);
      expect(transformGroup._transform[4]).toBe(0);
      expect(transformGroup._transform[5]).toBe(0);
      expect(transformGroup._transform[6]).toBe(0);
      expect(transformGroup._transform[8]).toBe(0);
      expect(transformGroup._transform[9]).toBe(0);
      expect(transformGroup._transform[10]).toBe(0);
    });
  });

  describe('reset', () => {
    test('should reset transform to identity', () => {
      // Modify the transform first
      transformGroup.setTranslation(new Cartesian3(10, 20, 30));
      transformGroup.setRotation([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      
      // Reset
      transformGroup.reset();
      
      expect(Matrix4.clone).toHaveBeenCalledWith(
        Matrix4.IDENTITY,
        transformGroup._transform
      );
    });

    test('should be callable multiple times', () => {
      transformGroup.reset();
      transformGroup.reset();
      
      expect(Matrix4.clone).toHaveBeenCalledTimes(2);
    });

    test('should reset after complex transformations', () => {
      // Apply multiple transformations
      transformGroup.rotateX(Math.PI / 4);
      transformGroup.translate(new Cartesian3(5, 10, 15));
      transformGroup.rotateY(Math.PI / 3);
      
      // Reset
      transformGroup.reset();
      
      expect(Matrix4.clone).toHaveBeenCalledWith(
        Matrix4.IDENTITY,
        transformGroup._transform
      );
    });
  });

  describe('transform getter', () => {
    test('should return internal transform matrix', () => {
      const result = transformGroup.transform;
      expect(result).toBe(transformGroup._transform);
    });

    test('should reflect changes to internal matrix', () => {
      transformGroup.setTranslation(new Cartesian3(1, 2, 3));
      const result = transformGroup.transform;
      
      expect(result[12]).toBe(1);
      expect(result[13]).toBe(2);
      expect(result[14]).toBe(3);
    });

    test('should return same reference on multiple calls', () => {
      const result1 = transformGroup.transform;
      const result2 = transformGroup.transform;
      expect(result1).toBe(result2);
    });
  });

  describe('localTransform getter', () => {
    test('should return cloned transform matrix', () => {
      // Add clone method to the transform array for testing
      transformGroup._transform.clone = jest.fn(() => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      
      const result = transformGroup.localTransform;
      
      expect(transformGroup._transform.clone).toHaveBeenCalled();
    });

    test('should return different reference from internal matrix', () => {
      // Add clone method to array prototype for this test
      if (!Array.prototype.clone) {
        Array.prototype.clone = function() {
          return [...this];
        };
      }
      
      const result = transformGroup.localTransform;
      expect(result).not.toBe(transformGroup._transform);
      
      // Clean up
      delete Array.prototype.clone;
    });
  });

  describe('transform setter', () => {
    test('should set transform matrix', () => {
      const newTransform = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
      transformGroup.transform = newTransform;

      expect(Matrix4.clone).toHaveBeenCalledWith(
        newTransform,
        transformGroup._transform
      );
    });

    test('should handle identity matrix', () => {
      const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      transformGroup.transform = identity;

      expect(Matrix4.clone).toHaveBeenCalledWith(
        identity,
        transformGroup._transform
      );
    });

    test('should replace existing transform', () => {
      // Set initial transform
      transformGroup.setTranslation(new Cartesian3(1, 2, 3));
      
      // Replace with new transform
      const newTransform = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 10, 20, 30, 1];
      transformGroup.transform = newTransform;

      expect(Matrix4.clone).toHaveBeenCalledWith(
        newTransform,
        transformGroup._transform
      );
    });
  });

  describe('integration tests', () => {
    test('should combine rotation and translation', () => {
      transformGroup.rotateZ(Math.PI / 2);
      transformGroup.translate(new Cartesian3(10, 0, 0));
      
      expect(Matrix3.fromRotationZ).toHaveBeenCalled();
      expect(Matrix4.multiplyByMatrix3).toHaveBeenCalled();
      expect(Matrix4.multiplyByTranslation).toHaveBeenCalled();
    });

    test('should handle complex transformation sequence', () => {
      transformGroup.rotateX(Math.PI / 4);
      transformGroup.rotateY(Math.PI / 3);
      transformGroup.rotateZ(Math.PI / 6);
      transformGroup.translate(new Cartesian3(1, 2, 3));
      transformGroup.setTranslation(new Cartesian3(5, 10, 15));
      
      expect(Matrix3.fromRotationX).toHaveBeenCalled();
      expect(Matrix3.fromRotationY).toHaveBeenCalled();
      expect(Matrix3.fromRotationZ).toHaveBeenCalled();
      expect(Matrix4.multiplyByTranslation).toHaveBeenCalled();
      expect(transformGroup._transform[12]).toBe(5);
      expect(transformGroup._transform[13]).toBe(10);
      expect(transformGroup._transform[14]).toBe(15);
    });

    test('should preserve state across getter/setter operations', () => {
      // Set up initial state
      transformGroup.setTranslation(new Cartesian3(1, 2, 3));
      
      // Get and set transform
      const current = transformGroup.transform;
      transformGroup.transform = current;
      
      expect(Matrix4.clone).toHaveBeenCalledWith(current, transformGroup._transform);
    });

    test('should maintain matrix structure after operations', () => {
      transformGroup.setRotation([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      transformGroup.setTranslation(new Cartesian3(10, 11, 12));
      
      // Check specific matrix positions
      expect(transformGroup._transform[0]).toBe(1);  // rotation
      expect(transformGroup._transform[5]).toBe(5);  // rotation
      expect(transformGroup._transform[10]).toBe(9); // rotation
      expect(transformGroup._transform[12]).toBe(10); // translation x
      expect(transformGroup._transform[13]).toBe(11); // translation y
      expect(transformGroup._transform[14]).toBe(12); // translation z
      expect(transformGroup._transform[15]).toBe(1);  // homogeneous coordinate
    });
  });

  describe('edge cases', () => {
    test('should handle very small angles', () => {
      transformGroup.rotateX(1e-10);
      transformGroup.rotateY(1e-10);
      transformGroup.rotateZ(1e-10);
      
      expect(Matrix3.fromRotationX).toHaveBeenCalledWith(1e-10, expect.any(Object));
      expect(Matrix3.fromRotationY).toHaveBeenCalledWith(1e-10, expect.any(Object));
      expect(Matrix3.fromRotationZ).toHaveBeenCalledWith(1e-10, expect.any(Object));
    });

    test('should handle very large translations', () => {
      const largeVector = new Cartesian3(1e6, 1e6, 1e6);
      transformGroup.translate(largeVector);
      transformGroup.setTranslation(largeVector);
      
      expect(Matrix4.multiplyByTranslation).toHaveBeenCalledWith(
        transformGroup._transform,
        largeVector,
        transformGroup._transform
      );
      expect(transformGroup._transform[12]).toBe(1e6);
      expect(transformGroup._transform[13]).toBe(1e6);
      expect(transformGroup._transform[14]).toBe(1e6);
    });

    test('should handle fractional matrix values', () => {
      const fractionalMatrix = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
      transformGroup.setRotation(fractionalMatrix);
      
      expect(transformGroup._transform[0]).toBe(0.1);
      expect(transformGroup._transform[1]).toBe(0.2);
      expect(transformGroup._transform[2]).toBe(0.3);
    });
  });
});
