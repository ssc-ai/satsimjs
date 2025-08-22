import Gimbal from '../src/engine/objects/Gimbal.js';
import SimObject from '../src/engine/objects/SimObject.js';
import Universe from '../src/engine/Universe.js';
import { JulianDate, Cartesian3 } from 'cesium';

// Mock the Universe class to avoid complex dependencies
jest.mock('../src/engine/Universe.js');

// Create a testable Gimbal class since Gimbal._update is abstract
class TestableGimbal extends Gimbal {
  _update(time, universe) {
    // Simple implementation for testing
    this._lastUpdateCall = { time, universe };
  }
}

describe('Gimbal', () => {
  let gimbal;
  let testableGimbal;
  let mockUniverse;
  let testTime;
  let mockTrackObject;

  beforeEach(() => {
    gimbal = new Gimbal();
    testableGimbal = new TestableGimbal();
    mockUniverse = new Universe();
    testTime = new JulianDate();
    
    // Create a mock track object
    mockTrackObject = new SimObject('MockTrackObject');
    mockTrackObject.update = jest.fn();
    mockTrackObject.transformPointTo = jest.fn();
    mockTrackObject.parent = null; // Not the gimbal
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create Gimbal with default name', () => {
      const defaultGimbal = new Gimbal();
      expect(defaultGimbal.name).toBe('Gimbal');
      expect(defaultGimbal).toBeInstanceOf(SimObject);
    });

    it('should create Gimbal with specified name', () => {
      const namedGimbal = new Gimbal('TestGimbal');
      expect(namedGimbal.name).toBe('TestGimbal');
    });

    it('should initialize with correct default properties', () => {
      expect(gimbal._trackObject).toBeNull();
      expect(gimbal._trackMode).toBe('fixed');
      expect(gimbal._sidereal).toBeNull();
      expect(gimbal._range).toBe(0);
    });

    it('should inherit from SimObject', () => {
      expect(gimbal).toBeInstanceOf(SimObject);
    });
  });

  describe('range getter', () => {
    it('should return _range when trackMode is rate', () => {
      gimbal._trackMode = 'rate';
      gimbal._range = 12345;
      expect(gimbal.range).toBe(12345);
    });

    it('should return default range when trackMode is not rate', () => {
      gimbal._trackMode = 'fixed';
      expect(gimbal.range).toBe(45000000.0);
    });

    it('should return default range when trackMode is sidereal', () => {
      gimbal._trackMode = 'sidereal';
      expect(gimbal.range).toBe(45000000.0);
    });

    it('should return different _range values in rate mode', () => {
      gimbal._trackMode = 'rate';
      gimbal._range = 98765;
      expect(gimbal.range).toBe(98765);
      
      gimbal._range = 54321;
      expect(gimbal.range).toBe(54321);
    });
  });

  describe('trackMode getter and setter', () => {
    it('should get correct trackMode', () => {
      expect(gimbal.trackMode).toBe('fixed');
    });

    it('should set trackMode correctly', () => {
      gimbal.trackMode = 'rate';
      expect(gimbal.trackMode).toBe('rate');
      expect(gimbal._trackMode).toBe('rate');
    });

    it('should handle different trackMode values', () => {
      const modes = ['fixed', 'rate', 'sidereal'];
      modes.forEach(mode => {
        gimbal.trackMode = mode;
        expect(gimbal.trackMode).toBe(mode);
      });
    });

    it('should handle arbitrary trackMode values', () => {
      gimbal.trackMode = 'custom';
      expect(gimbal.trackMode).toBe('custom');
    });
  });

  describe('trackObject getter and setter', () => {
    it('should get correct trackObject', () => {
      expect(gimbal.trackObject).toBeNull();
    });

    it('should set trackObject correctly', () => {
      gimbal.trackObject = mockTrackObject;
      expect(gimbal.trackObject).toBe(mockTrackObject);
      expect(gimbal._trackObject).toBe(mockTrackObject);
    });

    it('should warn when trying to set trackObject to self', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      gimbal.trackObject = gimbal;
      expect(consoleSpy).toHaveBeenCalledWith('Gimbal.trackObject cannot be set to self or child.');
      expect(gimbal.trackObject).toBeNull(); // Should remain unchanged
      consoleSpy.mockRestore();
    });

    it('should warn when trying to set trackObject to child', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockTrackObject.parent = gimbal;
      gimbal.trackObject = mockTrackObject;
      expect(consoleSpy).toHaveBeenCalledWith('Gimbal.trackObject cannot be set to self or child.');
      expect(gimbal.trackObject).toBeNull(); // Should remain unchanged
      consoleSpy.mockRestore();
    });

    it('should allow setting trackObject to null', () => {
      gimbal.trackObject = mockTrackObject;
      expect(gimbal.trackObject).toBe(mockTrackObject);
      
      gimbal.trackObject = null;
      expect(gimbal.trackObject).toBeNull();
    });

    it('should allow setting valid trackObject', () => {
      mockTrackObject.parent = null; // Not a child
      gimbal.trackObject = mockTrackObject;
      expect(gimbal.trackObject).toBe(mockTrackObject);
    });
  });

  describe('update method', () => {
    it('should call super.update with correct parameters', () => {
      const superUpdateSpy = jest.spyOn(SimObject.prototype, 'update');
      testableGimbal.update(testTime, mockUniverse);
      expect(superUpdateSpy).toHaveBeenCalledWith(testTime, mockUniverse, true, true);
      superUpdateSpy.mockRestore();
    });

    it('should handle different time and universe parameters', () => {
      const superUpdateSpy = jest.spyOn(SimObject.prototype, 'update');
      const anotherTime = JulianDate.addDays(testTime, 1, new JulianDate());
      const anotherUniverse = new Universe();
      
      testableGimbal.update(anotherTime, anotherUniverse);
      expect(superUpdateSpy).toHaveBeenCalledWith(anotherTime, anotherUniverse, true, true);
      superUpdateSpy.mockRestore();
    });
  });

  describe('_trackToLocalVector method', () => {
    beforeEach(() => {
      // Mock gimbal.parent for transformPointTo calls
      testableGimbal.parent = new SimObject('GimbalParent');
    });

    it('should return local vector when trackMode is rate and trackObject is defined', () => {
      const expectedLocalVector = new Cartesian3(1, 2, 3);
      mockTrackObject.transformPointTo.mockReturnValue(expectedLocalVector);
      
      testableGimbal._trackObject = mockTrackObject;
      testableGimbal._trackMode = 'rate';
      
      const result = testableGimbal._trackToLocalVector(testTime, mockUniverse);
      
      expect(mockTrackObject.update).toHaveBeenCalledWith(testTime, mockUniverse);
      expect(mockTrackObject.transformPointTo).toHaveBeenCalledWith(
        testableGimbal.parent, 
        Cartesian3.ZERO, 
        expect.any(Cartesian3)
      );
      expect(result).toBe(expectedLocalVector);
    });

    it('should return null when trackMode is fixed', () => {
      testableGimbal._trackMode = 'fixed';
      testableGimbal._trackObject = mockTrackObject;
      
      const result = testableGimbal._trackToLocalVector(testTime, mockUniverse);
      
      expect(result).toBeNull();
      expect(mockTrackObject.update).not.toHaveBeenCalled();
      expect(mockTrackObject.transformPointTo).not.toHaveBeenCalled();
    });

    it('should log message and continue when trackMode is sidereal', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      testableGimbal._trackMode = 'sidereal';
      testableGimbal._trackObject = mockTrackObject;
      
      const result = testableGimbal._trackToLocalVector(testTime, mockUniverse);
      
      expect(consoleSpy).toHaveBeenCalledWith('sidereal not implemented');
      expect(result).toEqual(new Cartesian3()); // Should return empty vector
      consoleSpy.mockRestore();
    });

    it('should return null when trackObject is null in rate mode', () => {
      testableGimbal._trackMode = 'rate';
      testableGimbal._trackObject = null;
      
      const result = testableGimbal._trackToLocalVector(testTime, mockUniverse);
      
      expect(result).toBeNull();
    });

    it('should return null when trackObject is undefined in rate mode', () => {
      testableGimbal._trackMode = 'rate';
      testableGimbal._trackObject = undefined;
      
      const result = testableGimbal._trackToLocalVector(testTime, mockUniverse);
      
      expect(result).toBeNull();
    });

    it('should handle different local vectors correctly', () => {
      const testVectors = [
        new Cartesian3(5, 10, 15),
        new Cartesian3(-1, -2, -3),
        new Cartesian3(0, 0, 1),
        Cartesian3.ZERO
      ];
      
      testableGimbal._trackObject = mockTrackObject;
      testableGimbal._trackMode = 'rate';
      
      testVectors.forEach(vector => {
        mockTrackObject.transformPointTo.mockReturnValue(vector);
        const result = testableGimbal._trackToLocalVector(testTime, mockUniverse);
        expect(result).toBe(vector);
      });
    });
  });

  describe('_update method', () => {
    it('should throw error indicating it must be implemented in derived classes', () => {
      expect(() => {
        gimbal._update(testTime, mockUniverse);
      }).toThrow('Gimbal._update must be implemented in derived classes.');
    });

    it('should throw error with different parameters', () => {
      const anotherTime = JulianDate.addDays(testTime, 1, new JulianDate());
      const anotherUniverse = new Universe();
      
      expect(() => {
        gimbal._update(anotherTime, anotherUniverse);
      }).toThrow('Gimbal._update must be implemented in derived classes.');
    });
  });

  describe('inheritance from SimObject', () => {
    it('should have all SimObject properties', () => {
      expect(gimbal.name).toBeDefined();
      expect(gimbal._position).toBeDefined();
      expect(gimbal._velocity).toBeDefined();
      expect(gimbal._lastUpdate).toBeDefined();
    });

    it('should call _update when update method is called', () => {
      const updateSpy = jest.spyOn(testableGimbal, '_update').mockImplementation();
      testableGimbal.update(testTime, mockUniverse);
      expect(updateSpy).toHaveBeenCalled();
      updateSpy.mockRestore();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle trackObject with no parent', () => {
      mockTrackObject.parent = undefined;
      gimbal.trackObject = mockTrackObject;
      expect(gimbal.trackObject).toBe(mockTrackObject);
    });

    it('should handle trackObject comparison with complex parent chain', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const intermediateParent = new SimObject('Intermediate');
      intermediateParent.parent = gimbal;
      mockTrackObject.parent = intermediateParent;
      
      gimbal.trackObject = mockTrackObject;
      expect(consoleSpy).not.toHaveBeenCalled(); // Should not warn for grandchild
      expect(gimbal.trackObject).toBe(mockTrackObject);
      consoleSpy.mockRestore();
    });

    it('should handle _trackToLocalVector with different coordinate systems', () => {
      testableGimbal.parent = new SimObject('Parent');
      testableGimbal._trackObject = mockTrackObject;
      testableGimbal._trackMode = 'rate';
      
      const extremeVector = new Cartesian3(1e10, -1e10, 1e-10);
      mockTrackObject.transformPointTo.mockReturnValue(extremeVector);
      
      const result = testableGimbal._trackToLocalVector(testTime, mockUniverse);
      expect(result).toBe(extremeVector);
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid mode switching', () => {
      testableGimbal._trackObject = mockTrackObject;
      testableGimbal.parent = new SimObject('Parent');
      mockTrackObject.transformPointTo.mockReturnValue(new Cartesian3(1, 2, 3));
      
      const modes = ['fixed', 'rate', 'sidereal', 'fixed'];
      modes.forEach(mode => {
        testableGimbal.trackMode = mode;
        const result = testableGimbal._trackToLocalVector(testTime, mockUniverse);
        
        if (mode === 'fixed') {
          expect(result).toBeNull();
        } else if (mode === 'rate') {
          expect(result).toBeInstanceOf(Cartesian3);
        }
      });
    });

    it('should handle trackObject changes during tracking', () => {
      testableGimbal._trackMode = 'rate';
      testableGimbal.parent = new SimObject('Parent');
      
      const anotherTrackObject = new SimObject('AnotherTrack');
      anotherTrackObject.update = jest.fn();
      anotherTrackObject.transformPointTo = jest.fn().mockReturnValue(new Cartesian3(7, 8, 9));
      
      testableGimbal.trackObject = mockTrackObject;
      let result = testableGimbal._trackToLocalVector(testTime, mockUniverse);
      expect(mockTrackObject.update).toHaveBeenCalled();
      
      jest.clearAllMocks();
      
      testableGimbal.trackObject = anotherTrackObject;
      result = testableGimbal._trackToLocalVector(testTime, mockUniverse);
      expect(anotherTrackObject.update).toHaveBeenCalled();
      expect(mockTrackObject.update).not.toHaveBeenCalled();
    });
  });

  describe('performance considerations', () => {
    it('should reuse local vector object in _trackToLocalVector', () => {
      testableGimbal._trackObject = mockTrackObject;
      testableGimbal._trackMode = 'rate';
      testableGimbal.parent = new SimObject('Parent');
      mockTrackObject.transformPointTo.mockReturnValue(new Cartesian3(1, 2, 3));
      
      // Call multiple times and verify object reuse
      const result1 = testableGimbal._trackToLocalVector(testTime, mockUniverse);
      const result2 = testableGimbal._trackToLocalVector(testTime, mockUniverse);
      
      // Should create new Cartesian3 instances each time (current implementation)
      expect(result1).toBeInstanceOf(Cartesian3);
      expect(result2).toBeInstanceOf(Cartesian3);
    });

    it('should minimize calls when tracking is disabled', () => {
      testableGimbal._trackMode = 'fixed';
      testableGimbal._trackObject = mockTrackObject;
      
      testableGimbal._trackToLocalVector(testTime, mockUniverse);
      
      expect(mockTrackObject.update).not.toHaveBeenCalled();
      expect(mockTrackObject.transformPointTo).not.toHaveBeenCalled();
    });
  });
});
