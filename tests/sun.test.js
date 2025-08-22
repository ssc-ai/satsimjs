import Sun from '../src/engine/objects/Sun.js';
import { ReferenceFrame, JulianDate, Cartesian3, Simon1994PlanetaryPositions } from 'cesium';

// Mock the Simon1994PlanetaryPositions module
jest.mock('cesium', () => {
  const originalCesium = jest.requireActual('cesium');
  return {
    ...originalCesium,
    Simon1994PlanetaryPositions: {
      computeSunPositionInEarthInertialFrame: jest.fn()
    }
  };
});

describe('Sun', () => {
  let sun;
  const mockTime = JulianDate.now();
  const mockUniverse = { name: 'testUniverse' };

  beforeEach(() => {
    jest.clearAllMocks();
    sun = new Sun();
  });

  describe('constructor', () => {
    test('should create Sun with correct default properties', () => {
      expect(sun._name).toBe('Sun');
      expect(sun._referenceFrame).toBe(ReferenceFrame.INERTIAL);
    });

    test('should inherit from SimObject', () => {
      expect(sun._position).toBeInstanceOf(Cartesian3);
      expect(sun._velocity).toBeInstanceOf(Cartesian3);
      expect(sun._updateListeners).toEqual([]);
    });

    test('should initialize position and velocity as zero vectors', () => {
      expect(sun._position).toEqual(Cartesian3.ZERO);
      expect(sun._velocity).toEqual(Cartesian3.ZERO);
    });

    test('should have inertial reference frame', () => {
      expect(sun.referenceFrame).toBe(ReferenceFrame.INERTIAL);
    });
  });

  describe('_update method', () => {
    test('should call Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame', () => {
      sun._update(mockTime, mockUniverse);
      
      expect(Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame)
        .toHaveBeenCalledWith(mockTime, sun._position);
    });

    test('should update position through Simon1994PlanetaryPositions call', () => {
      // Mock the position computation to modify the position object
      Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame
        .mockImplementation((time, result) => {
          result.x = 149597870.7; // 1 AU in km
          result.y = 0;
          result.z = 0;
        });

      sun._update(mockTime, mockUniverse);
      
      expect(sun._position.x).toBe(149597870.7);
      expect(sun._position.y).toBe(0);
      expect(sun._position.z).toBe(0);
    });

    test('should handle different times correctly', () => {
      const time1 = JulianDate.fromDate(new Date('2024-01-01T12:00:00Z'));
      const time2 = JulianDate.fromDate(new Date('2024-06-01T12:00:00Z'));
      
      sun._update(time1, mockUniverse);
      expect(Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame)
        .toHaveBeenCalledWith(time1, sun._position);
      
      jest.clearAllMocks();
      
      sun._update(time2, mockUniverse);
      expect(Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame)
        .toHaveBeenCalledWith(time2, sun._position);
    });

    test('should pass the same position object for in-place updates', () => {
      const originalPosition = sun._position;
      
      sun._update(mockTime, mockUniverse);
      
      expect(Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame)
        .toHaveBeenCalledWith(mockTime, originalPosition);
      expect(sun._position).toBe(originalPosition); // Same object reference
    });

    test('should handle universe parameter (not used but should not cause errors)', () => {
      expect(() => {
        sun._update(mockTime, null);
      }).not.toThrow();
      
      expect(() => {
        sun._update(mockTime, undefined);
      }).not.toThrow();
      
      expect(() => {
        sun._update(mockTime, {});
      }).not.toThrow();
    });
  });

  describe('inheritance from SimObject', () => {
    test('should have all SimObject properties', () => {
      expect(sun.name).toBe('Sun');
      expect(sun.referenceFrame).toBe(ReferenceFrame.INERTIAL);
      expect(sun._updateListeners).toBeDefined();
      expect(sun._lastUpdate).toBeDefined();
    });

    test('should call _update when update method is called', () => {
      const spy = jest.spyOn(sun, '_update');
      
      sun.update(mockTime, mockUniverse);
      
      expect(spy).toHaveBeenCalledWith(mockTime, mockUniverse);
      spy.mockRestore();
    });

    test('should update lastUpdate time when update is called', () => {
      const initialLastUpdate = JulianDate.clone(sun._lastUpdate);
      
      // Wait a small amount to ensure time difference
      const futureTime = JulianDate.addSeconds(mockTime, 1, new JulianDate());
      sun.update(futureTime, mockUniverse);
      
      expect(JulianDate.equals(sun._lastUpdate, futureTime)).toBe(true);
      expect(JulianDate.equals(sun._lastUpdate, initialLastUpdate)).toBe(false);
    });

    test('should have world position and velocity getters', () => {
      // For inertial reference frame, world position should be the same as position
      expect(sun.worldPosition).toEqual(sun._position);
      expect(sun.worldVelocity).toEqual(sun._velocity);
    });
  });

  describe('integration with Simon1994PlanetaryPositions', () => {
    test('should handle Simon1994PlanetaryPositions throwing an exception', () => {
      Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame
        .mockImplementation(() => {
          throw new Error('Planetary position calculation failed');
        });

      expect(() => {
        sun._update(mockTime, mockUniverse);
      }).toThrow('Planetary position calculation failed');
    });

    test('should work with realistic sun position values', () => {
      // Mock realistic sun position (approximately 1 AU)
      Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame
        .mockImplementation((time, result) => {
          result.x = 1.496e8; // ~1 AU in km
          result.y = 0;
          result.z = 0;
        });

      sun._update(mockTime, mockUniverse);
      
      expect(sun._position.x).toBeCloseTo(1.496e8, 0);
      expect(sun._position.y).toBe(0);
      expect(sun._position.z).toBe(0);
    });

    test('should handle position updates over time', () => {
      let positionCallCount = 0;
      
      Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame
        .mockImplementation((time, result) => {
          positionCallCount++;
          // Simulate different positions at different times
          result.x = 1.496e8 * Math.cos(positionCallCount * 0.1);
          result.y = 1.496e8 * Math.sin(positionCallCount * 0.1);
          result.z = 0;
        });

      // Update multiple times
      for (let i = 0; i < 3; i++) {
        const testTime = JulianDate.addDays(mockTime, i, new JulianDate());
        sun._update(testTime, mockUniverse);
      }
      
      expect(positionCallCount).toBe(3);
      expect(Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame)
        .toHaveBeenCalledTimes(3);
    });
  });

  describe('performance considerations', () => {
    test('should only call computeSunPositionInEarthInertialFrame once per update', () => {
      sun._update(mockTime, mockUniverse);
      
      expect(Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame)
        .toHaveBeenCalledTimes(1);
    });

    test('should reuse position object to avoid allocations', () => {
      const originalPosition = sun._position;
      
      sun._update(mockTime, mockUniverse);
      
      // Position object should be the same reference (modified in-place)
      expect(sun._position).toBe(originalPosition);
    });
  });

  describe('edge cases', () => {
    test('should handle extreme Julian dates', () => {
      const extremeDates = [
        new JulianDate(0, 0), // Very early date
        JulianDate.fromDate(new Date('1900-01-01')), // Historical date
        JulianDate.fromDate(new Date('2100-12-31')), // Future date
      ];

      extremeDates.forEach(date => {
        expect(() => {
          sun._update(date, mockUniverse);
        }).not.toThrow();
        
        expect(Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame)
          .toHaveBeenCalledWith(date, sun._position);
      });
    });

    test('should not modify velocity during position updates', () => {
      const originalVelocity = Cartesian3.clone(sun._velocity);
      
      Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame
        .mockImplementation((time, result) => {
          result.x = 1.496e8;
          result.y = 0;
          result.z = 0;
        });

      sun._update(mockTime, mockUniverse);
      
      expect(sun._velocity).toEqual(originalVelocity);
    });
  });

  describe('astronomical accuracy', () => {
    test('should use Simon1994 planetary theory for position computation', () => {
      // This test ensures we're using the correct astronomical model
      sun._update(mockTime, mockUniverse);
      
      expect(Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame)
        .toHaveBeenCalled();
      
      // Verify the method signature
      const call = Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame.mock.calls[0];
      expect(call).toHaveLength(2);
      expect(call[0]).toBe(mockTime); // First argument should be time
      expect(call[1]).toBe(sun._position); // Second argument should be result position
    });
  });
});
