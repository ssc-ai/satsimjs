import SimObject from '../src/engine/objects/SimObject.js';
import { Cartesian3, JulianDate, ReferenceFrame, Matrix3 } from 'cesium';

describe('SimObject', () => {
  let simObject;

  beforeEach(() => {
    simObject = new SimObject('TestObject', ReferenceFrame.INERTIAL);
  });

  describe('constructor', () => {
    test('should create a SimObject with default values', () => {
      const defaultObj = new SimObject();
      expect(defaultObj._name).toBe('undefined');
      expect(defaultObj._referenceFrame).toBeUndefined();
      expect(defaultObj._position).toBeInstanceOf(Cartesian3);
      expect(defaultObj._velocity).toBeInstanceOf(Cartesian3);
      expect(defaultObj._updateListeners).toEqual([]);
    });

    test('should create a SimObject with specified name and reference frame', () => {
      expect(simObject._name).toBe('TestObject');
      expect(simObject._referenceFrame).toBe(ReferenceFrame.INERTIAL);
    });

    test('should initialize position and velocity as zero vectors', () => {
      expect(simObject._position).toEqual(Cartesian3.ZERO);
      expect(simObject._velocity).toEqual(Cartesian3.ZERO);
    });
  });

  describe('getters', () => {
    test('should return correct reference frame', () => {
      expect(simObject.referenceFrame).toBe(ReferenceFrame.INERTIAL);
    });

    test('should return position when reference frame is defined', () => {
      simObject._position = new Cartesian3(1000, 2000, 3000);
      expect(simObject.position).toEqual(new Cartesian3(1000, 2000, 3000));
    });

    test('should return undefined position when no reference frame and no parent', () => {
      const objWithoutFrame = new SimObject('test');
      expect(objWithoutFrame.position).toBeUndefined();
    });

    test('should return parent position when no reference frame but has parent', () => {
      const objWithoutFrame = new SimObject('test');
      const parentPosition = new Cartesian3(5000, 6000, 7000);
      objWithoutFrame.parent = {
        referenceFrame: ReferenceFrame.INERTIAL,
        position: parentPosition
      };
      expect(objWithoutFrame.position).toBe(parentPosition);
    });

    test('should return parent reference frame when no reference frame but has parent', () => {
      const objWithoutFrame = new SimObject('test');
      objWithoutFrame.parent = {
        referenceFrame: ReferenceFrame.FIXED
      };
      expect(objWithoutFrame.referenceFrame).toBe(ReferenceFrame.FIXED);
    });

    test('should return velocity when reference frame is defined', () => {
      simObject._velocity = new Cartesian3(100, 200, 300);
      expect(simObject.velocity).toEqual(new Cartesian3(100, 200, 300));
    });

    test('should return velocity when no reference frame but has parent', () => {
      const objWithoutFrame = new SimObject('test');
      objWithoutFrame.parent = {
        _velocity: new Cartesian3(50, 60, 70)
      };
      // Since this._velocity is defined (as Cartesian3.ZERO), and parent exists, it returns parent._velocity
      expect(objWithoutFrame.velocity).toEqual(new Cartesian3(50, 60, 70));
    });

    test('should return eccentricity', () => {
      simObject._eccentricity = 0.5;
      expect(simObject.eccentricity).toBe(0.5);
    });

    test('should return period', () => {
      simObject._period = 5400;
      expect(simObject.period).toBe(5400);
    });

    test('should return name', () => {
      expect(simObject.name).toBe('TestObject');
    });

    test('should return last update time', () => {
      const testTime = JulianDate.now();
      JulianDate.clone(testTime, simObject._lastUpdate);
      expect(JulianDate.equals(simObject.time, testTime)).toBe(true);
    });

    test('should return update listeners array', () => {
      expect(simObject.updateListeners).toEqual([]);
    });

    test('should return world position for inertial reference frame', () => {
      simObject._position = new Cartesian3(1000, 2000, 3000);
      simObject._referenceFrame = ReferenceFrame.INERTIAL;
      expect(simObject.worldPosition).toEqual(new Cartesian3(1000, 2000, 3000));
    });

    test('should return world velocity for inertial reference frame', () => {
      simObject._velocity = new Cartesian3(100, 200, 300);
      simObject._referenceFrame = ReferenceFrame.INERTIAL;
      expect(simObject.worldVelocity).toEqual(new Cartesian3(100, 200, 300));
    });

    test('should return undefined world velocity for non-inertial reference frame', () => {
      simObject._referenceFrame = ReferenceFrame.FIXED;
      expect(simObject.worldVelocity).toBeUndefined();
    });
  });

  describe('visualizer property', () => {
    test('should set and get visualizer', () => {
      const mockVisualizer = { id: 'test-visualizer' };
      simObject.visualizer = mockVisualizer;
      expect(simObject.visualizer).toBe(mockVisualizer);
    });
  });

  describe('update method', () => {
    let mockTime;
    let mockUniverse;
    let testSimObject;

    beforeEach(() => {
      mockTime = JulianDate.now();
      mockUniverse = { name: 'testUniverse' };
      
      // Create a testable SimObject with overridden _update
      class TestableSimObject extends SimObject {
        _update(time, universe) {
          // Do nothing for testing
        }
      }
      testSimObject = new TestableSimObject('TestObject', ReferenceFrame.INERTIAL);
    });

    test('should not update if time is the same and forceUpdate is false', () => {
      const updateSpy = jest.spyOn(testSimObject, '_update');
      
      testSimObject.update(mockTime, mockUniverse);
      testSimObject.update(mockTime, mockUniverse);
      
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    test('should update if forceUpdate is true even with same time', () => {
      const updateSpy = jest.spyOn(testSimObject, '_update');
      
      testSimObject.update(mockTime, mockUniverse);
      testSimObject.update(mockTime, mockUniverse, true);
      
      expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    test('should call _update with correct parameters', () => {
      const updateSpy = jest.spyOn(testSimObject, '_update');
      
      testSimObject.update(mockTime, mockUniverse);
      
      expect(updateSpy).toHaveBeenCalledWith(mockTime, mockUniverse);
    });

    test('should update parent if updateParent is true and parent exists', () => {
      const mockParent = {
        update: jest.fn()
      };
      testSimObject.parent = mockParent;
      
      testSimObject.update(mockTime, mockUniverse);
      
      expect(mockParent.update).toHaveBeenCalledWith(mockTime, mockUniverse, false, true);
    });

    test('should not update parent if updateParent is false', () => {
      const mockParent = {
        update: jest.fn()
      };
      testSimObject.parent = mockParent;
      
      testSimObject.update(mockTime, mockUniverse, false, false);
      
      expect(mockParent.update).not.toHaveBeenCalled();
    });

    test('should call setTranslation with position', () => {
      const setTranslationSpy = jest.spyOn(testSimObject, 'setTranslation');
      
      testSimObject.update(mockTime, mockUniverse);
      
      expect(setTranslationSpy).toHaveBeenCalledWith(testSimObject._position);
    });

    test('should update lastUpdate time', () => {
      testSimObject.update(mockTime, mockUniverse);
      
      expect(JulianDate.equals(testSimObject._lastUpdate, mockTime)).toBe(true);
    });

    test('should update lastUniverse', () => {
      testSimObject.update(mockTime, mockUniverse);
      
      expect(testSimObject._lastUniverse).toBe(mockUniverse);
    });

    test('should call update on all listeners', () => {
      const listener1 = { update: jest.fn() };
      const listener2 = { update: jest.fn() };
      
      testSimObject._updateListeners.push(listener1, listener2);
      testSimObject.update(mockTime, mockUniverse);
      
      expect(listener1.update).toHaveBeenCalledWith(mockTime, mockUniverse);
      expect(listener2.update).toHaveBeenCalledWith(mockTime, mockUniverse);
    });
  });

  describe('inheritance and extensibility', () => {
    test('should allow _update method to be overridden', () => {
      class TestSimObject extends SimObject {
        _update(time, universe) {
          this._position = new Cartesian3(100, 200, 300);
        }
      }
      
      const testObj = new TestSimObject();
      
      const mockTime = JulianDate.now();
      const mockUniverse = {};
      
      testObj.update(mockTime, mockUniverse);
      
      expect(testObj._position).toEqual(new Cartesian3(100, 200, 300));
    });

    test('should throw error if _update is not implemented', () => {
      expect(() => {
        simObject._update(JulianDate.now(), {});
      }).toThrow('SimObject._update must be implemented in derived classes.');
    });
  });

  describe('transformation methods', () => {
    test('should set transform dirty when rotating around X axis', () => {
      simObject._transformDirty = false;
      simObject.rotateX(Math.PI / 4);
      expect(simObject._transformDirty).toBe(true);
    });

    test('should set transform dirty when rotating around Y axis', () => {
      simObject._transformDirty = false;
      simObject.rotateY(Math.PI / 4);
      expect(simObject._transformDirty).toBe(true);
    });

    test('should set transform dirty when rotating around Z axis', () => {
      simObject._transformDirty = false;
      simObject.rotateZ(Math.PI / 4);
      expect(simObject._transformDirty).toBe(true);
    });

    test('should set transform dirty when translating', () => {
      simObject._transformDirty = false;
      simObject.translate(new Cartesian3(100, 200, 300));
      expect(simObject._transformDirty).toBe(true);
    });

    test('should set transform dirty when setting translation', () => {
      simObject._transformDirty = false;
      simObject.setTranslation(new Cartesian3(100, 200, 300));
      expect(simObject._transformDirty).toBe(true);
    });

    test('should set transform dirty when setting rotation', () => {
      simObject._transformDirty = false;
      const mockMatrix3 = new Matrix3(); 
      simObject.setRotation(mockMatrix3);
      expect(simObject._transformDirty).toBe(true);
    });

    test('should set transform dirty when setting columns', () => {
      simObject._transformDirty = false;
      const x = new Cartesian3(1, 0, 0);
      const y = new Cartesian3(0, 1, 0);
      const z = new Cartesian3(0, 0, 1);
      simObject.setColumns(x, y, z);
      expect(simObject._transformDirty).toBe(true);
    });

    test('should set transform dirty when resetting', () => {
      simObject._transformDirty = false;
      simObject.reset();
      expect(simObject._transformDirty).toBe(true);
    });
  });

  describe('transform matrix methods', () => {
    test('should return world to local transform', () => {
      const result = simObject.worldToLocalTransform;
      expect(result).toBeDefined();
    });

    test('should return local to world transform', () => {
      const result = simObject.localToWorldTransform;
      expect(result).toBeDefined();
    });
  });

  describe('edge cases', () => {
    let testSimObject;

    beforeEach(() => {
      // Create a testable SimObject with overridden _update
      class TestableSimObject extends SimObject {
        _update(time, universe) {
          // Do nothing for testing
        }
      }
      testSimObject = new TestableSimObject('TestObject', ReferenceFrame.INERTIAL);
    });

    test('should handle undefined parent gracefully', () => {
      expect(() => {
        testSimObject.update(JulianDate.now(), {});
      }).not.toThrow();
    });

    test('should handle empty update listeners array', () => {
      expect(() => {
        testSimObject.update(JulianDate.now(), {});
      }).not.toThrow();
    });

    test('should handle parent with different last update time in _updateTransformsIfDirty', () => {
      const mockParent = new SimObject('parent', ReferenceFrame.INERTIAL);
      mockParent._lastUpdate = JulianDate.addDays(JulianDate.now(), -1, new JulianDate());
      mockParent.update = jest.fn();
      
      testSimObject.parent = mockParent;
      testSimObject._transformDirty = true;
      testSimObject._lastUpdate = JulianDate.now();
      testSimObject._lastUniverse = { test: 'universe' };
      
      testSimObject._updateTransformsIfDirty();
      
      expect(mockParent.update).toHaveBeenCalledWith(testSimObject._lastUpdate, testSimObject._lastUniverse, true, false);
    });

    test('should not update parent in _updateTransformsIfDirty when last update times are equal', () => {
      const currentTime = JulianDate.now();
      const mockParent = new SimObject('parent', ReferenceFrame.INERTIAL);
      JulianDate.clone(currentTime, mockParent._lastUpdate);
      mockParent.update = jest.fn();
      
      testSimObject.parent = mockParent;
      testSimObject._transformDirty = true;
      testSimObject._lastUpdate = currentTime;
      
      testSimObject._updateTransformsIfDirty();
      
      expect(mockParent.update).not.toHaveBeenCalled();
    });

    test('should not update transforms if not dirty', () => {
      testSimObject._transformDirty = false;
      const originalTransform = testSimObject._localToWorldTransform;
      
      testSimObject._updateTransformsIfDirty();
      
      expect(testSimObject._localToWorldTransform).toBe(originalTransform);
    });

    test('should handle velocity getter edge cases', () => {
      // Test when reference frame is defined but velocity is undefined
      const objWithFrame = new SimObject('test', ReferenceFrame.INERTIAL);
      objWithFrame._velocity = undefined;
      expect(objWithFrame.velocity).toBeUndefined();
      
      // Test the normal case: no reference frame but has parent
      const objWithoutFrame = new SimObject('test');
      const parentObj = new SimObject('parent', ReferenceFrame.INERTIAL);
      parentObj._velocity = new Cartesian3(50, 60, 70);
      objWithoutFrame.parent = parentObj;
      
      // Since this._velocity is defined (initialized as new Cartesian3()), the condition passes
      // and it returns this.parent._velocity
      expect(objWithoutFrame.velocity).toEqual(new Cartesian3(50, 60, 70));
      
      // Test when this._velocity is undefined but parent exists
      const objWithUndefinedVelocity = new SimObject('test');
      objWithUndefinedVelocity._velocity = undefined;
      objWithUndefinedVelocity.parent = parentObj;
      // When this._velocity is undefined, defined(this._velocity) returns false,
      // so it returns undefined (the third part of the ternary)
      expect(objWithUndefinedVelocity.velocity).toBeUndefined();
    });

    test('should handle world position for non-inertial reference frame', () => {
      testSimObject._referenceFrame = ReferenceFrame.FIXED;
      testSimObject.transformPointToWorld = jest.fn().mockReturnValue(new Cartesian3(8000, 9000, 10000));
      
      const worldPos = testSimObject.worldPosition;
      
      expect(testSimObject.transformPointToWorld).toHaveBeenCalledWith(Cartesian3.ZERO);
      expect(worldPos).toEqual(new Cartesian3(8000, 9000, 10000));
    });
  });

  describe('complex scenarios', () => {
    test('should handle deep parent hierarchy', () => {
      const grandParent = new SimObject('grandparent', ReferenceFrame.INERTIAL);
      const parent = new SimObject('parent');
      const child = new SimObject('child');
      
      parent.parent = grandParent;
      child.parent = parent;
      
      grandParent._position = new Cartesian3(1000, 2000, 3000);
      
      expect(child.referenceFrame).toBe(ReferenceFrame.INERTIAL);
      expect(child.position).toBe(grandParent._position);
    });

    test('should update multiple listeners in correct order', () => {
      // Create a testable SimObject with overridden _update
      class TestableSimObject extends SimObject {
        _update(time, universe) {
          // Do nothing for testing
        }
      }
      const testObj = new TestableSimObject('TestObject', ReferenceFrame.INERTIAL);
      
      const updateOrder = [];
      const listener1 = { 
        update: jest.fn(() => updateOrder.push('listener1'))
      };
      const listener2 = { 
        update: jest.fn(() => updateOrder.push('listener2'))
      };
      const listener3 = { 
        update: jest.fn(() => updateOrder.push('listener3'))
      };
      
      testObj._updateListeners.push(listener1, listener2, listener3);
      testObj.update(JulianDate.now(), {});
      
      expect(updateOrder).toEqual(['listener1', 'listener2', 'listener3']);
    });

    test('should handle listener that throws exception', () => {
      // Create a testable SimObject with overridden _update
      class TestableSimObject extends SimObject {
        _update(time, universe) {
          // Do nothing for testing
        }
      }
      const testObj = new TestableSimObject('TestObject', ReferenceFrame.INERTIAL);
      
      const goodListener = { update: jest.fn() };
      const badListener = { 
        update: jest.fn(() => { throw new Error('Listener error'); })
      };
      const anotherGoodListener = { update: jest.fn() };
      
      testObj._updateListeners.push(goodListener, badListener, anotherGoodListener);
      
      expect(() => {
        testObj.update(JulianDate.now(), {});
      }).toThrow('Listener error');
      
      expect(goodListener.update).toHaveBeenCalled();
      expect(badListener.update).toHaveBeenCalled();
      // anotherGoodListener should not be called due to exception
      expect(anotherGoodListener.update).not.toHaveBeenCalled();
    });

    test('should handle circular parent references gracefully', () => {
      const obj1 = new SimObject('obj1');
      const obj2 = new SimObject('obj2');
      
      obj1.parent = obj2;
      obj2.parent = obj1; // Circular reference
      
      // This will cause infinite recursion and stack overflow
      expect(() => {
        obj1.referenceFrame;
      }).toThrow('Maximum call stack size exceeded');
    });
  });
});
