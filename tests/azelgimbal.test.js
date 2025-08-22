import AzElGimbal from '../src/engine/objects/AzElGimbal.js';
import Gimbal from '../src/engine/objects/Gimbal.js';
import SimObject from '../src/engine/objects/SimObject.js';
import Universe from '../src/engine/Universe.js';
import { southEastZenithToAzEl } from '../src/engine/dynamics/gimbal.js';
import { JulianDate, Cartesian3, Math as CMath } from 'cesium';

// Mock the dependencies
jest.mock('../src/engine/Universe.js');
jest.mock('../src/engine/dynamics/gimbal.js');

describe('AzElGimbal', () => {
  let azElGimbal;
  let mockUniverse;
  let testTime;
  let mockTrackObject;

  beforeEach(() => {
    azElGimbal = new AzElGimbal();
    mockUniverse = new Universe();
    testTime = new JulianDate();
    
    // Create a mock track object
    mockTrackObject = new SimObject('MockTrackObject');
    mockTrackObject.update = jest.fn();
    mockTrackObject.transformPointTo = jest.fn();
    mockTrackObject.parent = null;

    // Mock gimbal dynamics
    southEastZenithToAzEl.mockReturnValue([45.0, 30.0, 1000.0]); // az, el, range
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create AzElGimbal with default name', () => {
      const defaultGimbal = new AzElGimbal();
      expect(defaultGimbal.name).toBe('AzElGimbal');
      expect(defaultGimbal).toBeInstanceOf(Gimbal);
      expect(defaultGimbal).toBeInstanceOf(SimObject);
    });

    it('should create AzElGimbal with specified name', () => {
      const namedGimbal = new AzElGimbal('TestAzElGimbal');
      expect(namedGimbal.name).toBe('TestAzElGimbal');
    });

    it('should initialize with correct default azimuth and elevation', () => {
      expect(azElGimbal.az).toBe(0.0);
      expect(azElGimbal.el).toBe(90.0);
    });

    it('should inherit from Gimbal', () => {
      expect(azElGimbal).toBeInstanceOf(Gimbal);
    });

    it('should inherit Gimbal properties', () => {
      expect(azElGimbal._trackObject).toBeNull();
      expect(azElGimbal._trackMode).toBe('fixed');
      expect(azElGimbal._sidereal).toBeNull();
      expect(azElGimbal._range).toBe(0);
    });
  });

  describe('_update method', () => {
    beforeEach(() => {
      // Mock the transform methods
      azElGimbal.reset = jest.fn();
      azElGimbal.rotateY = jest.fn();
      azElGimbal.rotateZ = jest.fn();
      azElGimbal.rotateX = jest.fn();
      
      // Mock _trackToLocalVector method
      azElGimbal._trackToLocalVector = jest.fn();
    });

    it('should call _trackToLocalVector with correct parameters', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(null);
      azElGimbal._update(testTime, mockUniverse);
      expect(azElGimbal._trackToLocalVector).toHaveBeenCalledWith(testTime, mockUniverse);
    });

    it('should not call southEastZenithToAzEl when localVector is null', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(null);
      azElGimbal._update(testTime, mockUniverse);
      expect(southEastZenithToAzEl).not.toHaveBeenCalled();
    });

    it('should call southEastZenithToAzEl when localVector is provided', () => {
      const testVector = new Cartesian3(1, 2, 3);
      azElGimbal._trackToLocalVector.mockReturnValue(testVector);
      
      azElGimbal._update(testTime, mockUniverse);
      
      expect(southEastZenithToAzEl).toHaveBeenCalledWith(testVector);
      expect(azElGimbal.az).toBe(45.0);
      expect(azElGimbal.el).toBe(30.0);
      expect(azElGimbal._range).toBe(1000.0);
    });

    it('should perform reference transform setup correctly', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(null);
      azElGimbal._update(testTime, mockUniverse);
      
      expect(azElGimbal.reset).toHaveBeenCalled();
      expect(azElGimbal.rotateY).toHaveBeenCalledWith(CMath.PI_OVER_TWO);
      expect(azElGimbal.rotateZ).toHaveBeenCalledWith(CMath.PI_OVER_TWO);
    });

    it('should apply gimbal movements with correct angles', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(new Cartesian3(1, 2, 3));
      southEastZenithToAzEl.mockReturnValue([120.0, 45.0, 2000.0]);
      
      azElGimbal._update(testTime, mockUniverse);
      
      expect(azElGimbal.rotateY).toHaveBeenCalledWith(-120.0 * CMath.RADIANS_PER_DEGREE);
      expect(azElGimbal.rotateX).toHaveBeenCalledWith(45.0 * CMath.RADIANS_PER_DEGREE);
    });

    it('should handle zero azimuth and elevation', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(new Cartesian3(1, 0, 0));
      southEastZenithToAzEl.mockReturnValue([0.0, 0.0, 1.0]);
      
      azElGimbal._update(testTime, mockUniverse);
      
      expect(azElGimbal.az).toBe(0.0);
      expect(azElGimbal.el).toBe(0.0);
      expect(azElGimbal.rotateY).toHaveBeenCalledWith(-0.0);
      expect(azElGimbal.rotateX).toHaveBeenCalledWith(0.0);
    });

    it('should handle negative azimuth correctly', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(new Cartesian3(-1, -2, 3));
      southEastZenithToAzEl.mockReturnValue([-45.0, 60.0, 500.0]);
      
      azElGimbal._update(testTime, mockUniverse);
      
      expect(azElGimbal.az).toBe(-45.0);
      expect(azElGimbal.el).toBe(60.0);
      expect(azElGimbal.rotateY).toHaveBeenCalledWith(-(-45.0) * CMath.RADIANS_PER_DEGREE);
      expect(azElGimbal.rotateX).toHaveBeenCalledWith(60.0 * CMath.RADIANS_PER_DEGREE);
    });

    it('should handle extreme azimuth and elevation values', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(new Cartesian3(1, 1, 1));
      southEastZenithToAzEl.mockReturnValue([359.9, 89.9, 10000.0]);
      
      azElGimbal._update(testTime, mockUniverse);
      
      expect(azElGimbal.az).toBe(359.9);
      expect(azElGimbal.el).toBe(89.9);
      expect(azElGimbal._range).toBe(10000.0);
    });

    it('should call transforms in correct order', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(null);
      
      let callOrder = [];
      azElGimbal.reset.mockImplementation(() => callOrder.push('reset'));
      azElGimbal.rotateY.mockImplementation(() => callOrder.push('rotateY'));
      azElGimbal.rotateZ.mockImplementation(() => callOrder.push('rotateZ'));
      azElGimbal.rotateX.mockImplementation(() => callOrder.push('rotateX'));
      
      azElGimbal._update(testTime, mockUniverse);
      
      expect(callOrder).toEqual(['reset', 'rotateY', 'rotateZ', 'rotateY', 'rotateX']);
    });

    it('should handle different time and universe parameters', () => {
      const anotherTime = JulianDate.addDays(testTime, 1, new JulianDate());
      const anotherUniverse = new Universe();
      
      azElGimbal._trackToLocalVector.mockReturnValue(null);
      azElGimbal._update(anotherTime, anotherUniverse);
      
      expect(azElGimbal._trackToLocalVector).toHaveBeenCalledWith(anotherTime, anotherUniverse);
    });
  });

  describe('inheritance from Gimbal', () => {
    it('should have all Gimbal properties and methods', () => {
      expect(azElGimbal.trackMode).toBeDefined();
      expect(azElGimbal.trackObject).toBeDefined();
      expect(azElGimbal.range).toBeDefined();
      expect(typeof azElGimbal.update).toBe('function');
      expect(typeof azElGimbal._trackToLocalVector).toBe('function');
    });

    it('should call update method correctly', () => {
      const superUpdateSpy = jest.spyOn(Gimbal.prototype, 'update');
      azElGimbal.update(testTime, mockUniverse);
      expect(superUpdateSpy).toHaveBeenCalledWith(testTime, mockUniverse);
      superUpdateSpy.mockRestore();
    });

    it('should inherit trackMode behavior', () => {
      expect(azElGimbal.trackMode).toBe('fixed');
      azElGimbal.trackMode = 'rate';
      expect(azElGimbal.trackMode).toBe('rate');
    });

    it('should inherit trackObject behavior', () => {
      expect(azElGimbal.trackObject).toBeNull();
      azElGimbal.trackObject = mockTrackObject;
      expect(azElGimbal.trackObject).toBe(mockTrackObject);
    });

    it('should inherit range behavior', () => {
      expect(azElGimbal.range).toBe(45000000.0); // Default when not in rate mode
      azElGimbal.trackMode = 'rate';
      azElGimbal._range = 12345;
      expect(azElGimbal.range).toBe(12345);
    });
  });

  describe('coordinate transformation integration', () => {
    beforeEach(() => {
      // Reset mocks for real transform testing
      azElGimbal.reset = jest.fn();
      azElGimbal.rotateY = jest.fn();
      azElGimbal.rotateZ = jest.fn();
      azElGimbal.rotateX = jest.fn();
      azElGimbal._trackToLocalVector = jest.fn();
    });

    it('should handle unit vector in X direction', () => {
      const xVector = new Cartesian3(1, 0, 0);
      azElGimbal._trackToLocalVector.mockReturnValue(xVector);
      southEastZenithToAzEl.mockReturnValue([270.0, 0.0, 1.0]);
      
      azElGimbal._update(testTime, mockUniverse);
      
      expect(southEastZenithToAzEl).toHaveBeenCalledWith(xVector);
      expect(azElGimbal.az).toBe(270.0);
      expect(azElGimbal.el).toBe(0.0);
    });

    it('should handle unit vector in Y direction', () => {
      const yVector = new Cartesian3(0, 1, 0);
      azElGimbal._trackToLocalVector.mockReturnValue(yVector);
      southEastZenithToAzEl.mockReturnValue([0.0, 0.0, 1.0]);
      
      azElGimbal._update(testTime, mockUniverse);
      
      expect(southEastZenithToAzEl).toHaveBeenCalledWith(yVector);
      expect(azElGimbal.az).toBe(0.0);
      expect(azElGimbal.el).toBe(0.0);
    });

    it('should handle unit vector in Z direction', () => {
      const zVector = new Cartesian3(0, 0, 1);
      azElGimbal._trackToLocalVector.mockReturnValue(zVector);
      southEastZenithToAzEl.mockReturnValue([0.0, 90.0, 1.0]);
      
      azElGimbal._update(testTime, mockUniverse);
      
      expect(southEastZenithToAzEl).toHaveBeenCalledWith(zVector);
      expect(azElGimbal.az).toBe(0.0);
      expect(azElGimbal.el).toBe(90.0);
    });

    it('should handle zero vector', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(Cartesian3.ZERO);
      southEastZenithToAzEl.mockReturnValue([0.0, 0.0, 0.0]);
      
      azElGimbal._update(testTime, mockUniverse);
      
      expect(southEastZenithToAzEl).toHaveBeenCalledWith(Cartesian3.ZERO);
      expect(azElGimbal.az).toBe(0.0);
      expect(azElGimbal.el).toBe(0.0);
      expect(azElGimbal._range).toBe(0.0);
    });
  });

  describe('error handling and edge cases', () => {
    beforeEach(() => {
      azElGimbal.reset = jest.fn();
      azElGimbal.rotateY = jest.fn();
      azElGimbal.rotateZ = jest.fn();
      azElGimbal.rotateX = jest.fn();
      azElGimbal._trackToLocalVector = jest.fn();
    });

    it('should handle southEastZenithToAzEl throwing an exception', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(new Cartesian3(1, 2, 3));
      southEastZenithToAzEl.mockImplementation(() => {
        throw new Error('Calculation error');
      });
      
      expect(() => {
        azElGimbal._update(testTime, mockUniverse);
      }).toThrow('Calculation error');
    });

    it('should handle _trackToLocalVector throwing an exception', () => {
      azElGimbal._trackToLocalVector.mockImplementation(() => {
        throw new Error('Vector calculation error');
      });
      
      expect(() => {
        azElGimbal._update(testTime, mockUniverse);
      }).toThrow('Vector calculation error');
    });

    it('should handle transform methods throwing exceptions', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(null);
      azElGimbal.reset.mockImplementation(() => {
        throw new Error('Reset error');
      });
      
      expect(() => {
        azElGimbal._update(testTime, mockUniverse);
      }).toThrow('Reset error');
    });

    it('should preserve azimuth and elevation when localVector is null', () => {
      azElGimbal.az = 123.45;
      azElGimbal.el = 67.89;
      
      azElGimbal._trackToLocalVector.mockReturnValue(null);
      azElGimbal._update(testTime, mockUniverse);
      
      expect(azElGimbal.az).toBe(123.45); // Should remain unchanged
      expect(azElGimbal.el).toBe(67.89); // Should remain unchanged
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      azElGimbal.reset = jest.fn();
      azElGimbal.rotateY = jest.fn();
      azElGimbal.rotateZ = jest.fn();
      azElGimbal.rotateX = jest.fn();
    });

    it('should handle full tracking scenario', () => {
      // Set up tracking mode
      azElGimbal.trackMode = 'rate';
      azElGimbal.trackObject = mockTrackObject;
      azElGimbal.parent = new SimObject('Parent');
      
      // Mock full tracking pipeline
      const trackVector = new Cartesian3(5, 10, 15);
      mockTrackObject.transformPointTo.mockReturnValue(trackVector);
      
      // Use real _trackToLocalVector
      azElGimbal._trackToLocalVector = Gimbal.prototype._trackToLocalVector.bind(azElGimbal);
      
      southEastZenithToAzEl.mockReturnValue([135.0, 25.0, 1500.0]);
      
      azElGimbal._update(testTime, mockUniverse);
      
      expect(mockTrackObject.update).toHaveBeenCalledWith(testTime, mockUniverse);
      expect(southEastZenithToAzEl).toHaveBeenCalledWith(trackVector);
      expect(azElGimbal.az).toBe(135.0);
      expect(azElGimbal.el).toBe(25.0);
      expect(azElGimbal._range).toBe(1500.0);
    });

    it('should handle rapid successive updates', () => {
      azElGimbal._trackToLocalVector = jest.fn().mockReturnValue(new Cartesian3(1, 1, 1));
      
      const angles = [
        [10.0, 20.0, 100.0],
        [15.0, 25.0, 200.0],
        [20.0, 30.0, 300.0]
      ];
      
      angles.forEach((angle, index) => {
        southEastZenithToAzEl.mockReturnValue(angle);
        azElGimbal._update(testTime, mockUniverse);
        
        expect(azElGimbal.az).toBe(angle[0]);
        expect(azElGimbal.el).toBe(angle[1]);
        expect(azElGimbal._range).toBe(angle[2]);
      });
    });

    it('should handle mode switching during operation', () => {
      azElGimbal._trackToLocalVector = jest.fn();
      
      // Start in fixed mode - no vector
      azElGimbal.trackMode = 'fixed';
      azElGimbal._trackToLocalVector.mockReturnValue(null);
      azElGimbal._update(testTime, mockUniverse);
      expect(southEastZenithToAzEl).not.toHaveBeenCalled();
      
      // Switch to rate mode - with vector
      azElGimbal.trackMode = 'rate';
      azElGimbal._trackToLocalVector.mockReturnValue(new Cartesian3(2, 2, 2));
      southEastZenithToAzEl.mockReturnValue([90.0, 45.0, 800.0]);
      azElGimbal._update(testTime, mockUniverse);
      expect(southEastZenithToAzEl).toHaveBeenCalledWith(new Cartesian3(2, 2, 2));
    });
  });

  describe('performance considerations', () => {
    beforeEach(() => {
      azElGimbal.reset = jest.fn();
      azElGimbal.rotateY = jest.fn();
      azElGimbal.rotateZ = jest.fn();
      azElGimbal.rotateX = jest.fn();
      azElGimbal._trackToLocalVector = jest.fn();
    });

    it('should minimize calculations when no tracking is active', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(null);
      azElGimbal._update(testTime, mockUniverse);
      
      expect(southEastZenithToAzEl).not.toHaveBeenCalled();
      expect(azElGimbal.reset).toHaveBeenCalledTimes(1);
      expect(azElGimbal.rotateY).toHaveBeenCalledTimes(2); // Setup rotations only
      expect(azElGimbal.rotateZ).toHaveBeenCalledTimes(1);
      expect(azElGimbal.rotateX).toHaveBeenCalledTimes(1);
    });

    it('should call southEastZenithToAzEl only once per update when tracking', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(new Cartesian3(1, 2, 3));
      azElGimbal._update(testTime, mockUniverse);
      
      expect(southEastZenithToAzEl).toHaveBeenCalledTimes(1);
    });

    it('should reuse az, el, and range properties efficiently', () => {
      azElGimbal._trackToLocalVector.mockReturnValue(new Cartesian3(3, 4, 5));
      southEastZenithToAzEl.mockReturnValue([75.0, 60.0, 2500.0]);
      
      azElGimbal._update(testTime, mockUniverse);
      
      // Properties should be directly assigned, not copied
      expect(azElGimbal.az).toBe(75.0);
      expect(azElGimbal.el).toBe(60.0);
      expect(azElGimbal._range).toBe(2500.0);
    });
  });
});
