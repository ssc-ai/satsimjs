import SGP4Satellite from '../src/engine/objects/SGP4Satellite.js';
import { Cartesian3, JulianDate, ReferenceFrame } from 'cesium';

// Mock the satellite.js module
jest.mock('satellite.js', () => ({
  twoline2satrec: jest.fn(),
  sgp4: jest.fn()
}));

import { sgp4, twoline2satrec } from 'satellite.js';

describe('SGP4Satellite', () => {
  let satellite;
  const mockTle1 = '1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927';
  const mockTle2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537';
  const mockOrientation = 'test-orientation';
  const mockName = 'ISS';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock twoline2satrec return value
    const mockSatrec = {
      jdsatepoch: 2454732.01782528,
      no: 0.0011076056 * 2 * Math.PI / 86400, // mean motion in rad/sec
      ecco: 0.0006703 // eccentricity
    };
    
    twoline2satrec.mockReturnValue(mockSatrec);
    
    satellite = new SGP4Satellite(mockTle1, mockTle2, mockOrientation, mockName);
  });

  describe('constructor', () => {
    test('should create SGP4Satellite with correct properties', () => {
      expect(twoline2satrec).toHaveBeenCalledWith(mockTle1, mockTle2);
      expect(satellite._name).toBe(mockName);
      expect(satellite._referenceFrame).toBe(ReferenceFrame.INERTIAL);
      expect(satellite.orientation).toBe(mockOrientation);
    });

    test('should use default name when not provided', () => {
      const defaultSatellite = new SGP4Satellite(mockTle1, mockTle2, mockOrientation);
      expect(defaultSatellite._name).toBe('SGP4Satellite');
    });

    test('should calculate period from mean motion', () => {
      // Period should be 2π / n where n is mean motion
      const expectedPeriod = 2 * Math.PI / satellite._satrec.no * 60; // convert to minutes
      expect(satellite._period).toBeCloseTo(expectedPeriod, 5);
    });

    test('should set eccentricity from satrec', () => {
      expect(satellite._eccentricity).toBe(0.0006703);
    });

    test('should set epoch from satrec', () => {
      expect(satellite._epoch.dayNumber).toBe(2454732);
    });
  });

  describe('_update method', () => {
    let mockTime;
    let mockUniverse;

    beforeEach(() => {
      mockTime = JulianDate.now();
      mockUniverse = { name: 'testUniverse' };
    });

    test('should handle successful SGP4 propagation', () => {
      const mockPosition = new Cartesian3(1000, 2000, 3000); // in km
      const mockVelocity = new Cartesian3(4, 5, 6); // in km/s
      const mockPosVel = {
        position: mockPosition,
        velocity: mockVelocity
      };

      sgp4.mockReturnValue(mockPosVel);

      satellite._update(mockTime, mockUniverse);

      // Should convert from km to meters
      expect(satellite._position).toEqual(new Cartesian3(1000000, 2000000, 3000000));
      expect(satellite._velocity).toEqual(new Cartesian3(4000, 5000, 6000));
    });

    test('should handle SGP4 failure with false position', () => {
      const mockPosVel = {
        position: false,
        velocity: false
      };

      sgp4.mockReturnValue(mockPosVel);

      satellite._update(mockTime, mockUniverse);

      // Should set position and velocity to zero
      expect(satellite._position).toEqual(Cartesian3.ZERO);
      expect(satellite._velocity).toEqual(Cartesian3.ZERO);
    });

    test('should handle SGP4 failure with undefined position', () => {
      const mockPosVel = {
        position: undefined,
        velocity: undefined
      };

      sgp4.mockReturnValue(mockPosVel);

      satellite._update(mockTime, mockUniverse);

      // Should set position and velocity to zero
      expect(satellite._position).toEqual(Cartesian3.ZERO);
      expect(satellite._velocity).toEqual(Cartesian3.ZERO);
    });

    test('should handle null positionAndVelocity object', () => {
      sgp4.mockReturnValue(null);

      satellite._update(mockTime, mockUniverse);

      // Should set position and velocity to zero
      expect(satellite._position).toEqual(Cartesian3.ZERO);
      expect(satellite._velocity).toEqual(Cartesian3.ZERO);
    });

    test('should handle undefined positionAndVelocity object', () => {
      sgp4.mockReturnValue(undefined);

      satellite._update(mockTime, mockUniverse);

      // Should set position and velocity to zero
      expect(satellite._position).toEqual(Cartesian3.ZERO);
      expect(satellite._velocity).toEqual(Cartesian3.ZERO);
    });

    test('should calculate correct time delta in minutes', () => {
      const mockPosVel = {
        position: new Cartesian3(1, 2, 3),
        velocity: new Cartesian3(4, 5, 6)
      };

      sgp4.mockReturnValue(mockPosVel);

      // Set a specific time difference
      const futureTime = JulianDate.addSeconds(satellite._epoch, 3600, new JulianDate()); // 1 hour later
      
      satellite._update(futureTime, mockUniverse);

      // Should call sgp4 with time difference in minutes (3600 seconds = 60 minutes)
      expect(sgp4).toHaveBeenCalledWith(satellite._satrec, 60);
    });

    test('should handle negative time delta', () => {
      const mockPosVel = {
        position: new Cartesian3(1, 2, 3),
        velocity: new Cartesian3(4, 5, 6)
      };

      sgp4.mockReturnValue(mockPosVel);

      // Set a time before epoch
      const pastTime = JulianDate.addSeconds(satellite._epoch, -3600, new JulianDate()); // 1 hour before
      
      satellite._update(pastTime, mockUniverse);

      // Should call sgp4 with negative time difference
      expect(sgp4).toHaveBeenCalledWith(satellite._satrec, -60);
    });
  });

  describe('inheritance from SimObject', () => {
    test('should have SimObject properties', () => {
      expect(satellite._position).toBeInstanceOf(Cartesian3);
      expect(satellite._velocity).toBeInstanceOf(Cartesian3);
      expect(satellite._updateListeners).toEqual([]);
    });

    test('should call _update when update is called', () => {
      const mockPosVel = {
        position: new Cartesian3(1, 2, 3),
        velocity: new Cartesian3(4, 5, 6)
      };

      sgp4.mockReturnValue(mockPosVel);
      
      // Mock setTranslation method
      satellite.setTranslation = jest.fn();
      
      const mockTime = JulianDate.now();
      const mockUniverse = {};
      
      satellite.update(mockTime, mockUniverse);
      
      expect(sgp4).toHaveBeenCalled();
      expect(satellite.setTranslation).toHaveBeenCalledWith(satellite._position);
    });
  });

  describe('error handling edge cases', () => {
    test('should handle malformed TLE data gracefully', () => {
      // This tests the constructor's ability to handle bad TLE data
      // Since twoline2satrec is mocked, we simulate it returning invalid data
      const invalidSatrec = {
        jdsatepoch: NaN,
        no: 0,
        ecco: NaN
      };
      
      twoline2satrec.mockReturnValue(invalidSatrec);
      
      expect(() => {
        new SGP4Satellite('invalid', 'tle', 'orientation');
      }).not.toThrow();
    });

    test('should handle SGP4 throwing an exception', () => {
      sgp4.mockImplementation(() => {
        throw new Error('SGP4 calculation failed');
      });

      expect(() => {
        satellite._update(JulianDate.now(), {});
      }).toThrow('SGP4 calculation failed');
    });
  });

  describe('performance considerations', () => {
    test('should only call sgp4 once per update', () => {
      const mockPosVel = {
        position: new Cartesian3(1, 2, 3),
        velocity: new Cartesian3(4, 5, 6)
      };

      sgp4.mockReturnValue(mockPosVel);
      
      satellite._update(JulianDate.now(), {});
      
      expect(sgp4).toHaveBeenCalledTimes(1);
    });

    test('should reuse position and velocity objects', () => {
      const mockPosVel = {
        position: new Cartesian3(1, 2, 3),
        velocity: new Cartesian3(4, 5, 6)
      };

      sgp4.mockReturnValue(mockPosVel);
      
      const originalPosition = satellite._position;
      const originalVelocity = satellite._velocity;
      
      satellite._update(JulianDate.now(), {});
      
      // Should modify existing objects, not create new ones
      expect(satellite._position).toBe(originalPosition);
      expect(satellite._velocity).toBe(originalVelocity);
    });
  });
});
