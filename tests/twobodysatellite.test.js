import TwoBodySatellite from '../src/engine/objects/TwoBodySatellite.js';
import { Cartesian3, JulianDate, ReferenceFrame } from 'cesium';
import { Math as CMath } from 'cesium';

// Mock the twobody dynamics module
jest.mock('../src/engine/dynamics/twobody.js', () => ({
  vallado: jest.fn(),
  rv2period: jest.fn(),
  rv2ecc: jest.fn()
}));

import { vallado, rv2period, rv2ecc } from '../src/engine/dynamics/twobody.js';

describe('TwoBodySatellite', () => {
  let satellite;
  const mockPosition = new Cartesian3(7000000, 0, 0); // 7000 km from Earth center
  const mockVelocity = new Cartesian3(0, 7546, 0); // Circular orbit velocity
  const mockTime = JulianDate.now();
  const mockOrientation = 'test-orientation';
  const mockName = 'TestSat';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock return values for orbital calculations
    rv2period.mockReturnValue(5553.5); // ~92 minutes for ISS-like orbit
    rv2ecc.mockReturnValue(0.0001); // Nearly circular orbit
  });

  describe('constructor', () => {
    test('should create TwoBodySatellite with correct properties', () => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      expect(satellite._name).toBe(mockName);
      expect(satellite._referenceFrame).toBe(ReferenceFrame.INERTIAL);
      expect(satellite.orientation).toBe(mockOrientation);
      expect(satellite._period).toBe(5553.5);
      expect(satellite._eccentricity).toBe(0.0001);
    });

    test('should use default name when not provided', () => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation);
      expect(satellite._name).toBe('TwoBodySatellite');
    });

    test('should call rv2period with correct parameters', () => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      expect(rv2period).toHaveBeenCalledWith(CMath.GRAVITATIONALPARAMETER, mockPosition, mockVelocity);
    });

    test('should call rv2ecc with correct parameters', () => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      expect(rv2ecc).toHaveBeenCalledWith(CMath.GRAVITATIONALPARAMETER, mockPosition, mockVelocity);
    });

    test('should clone input position vector', () => {
      const originalPosition = new Cartesian3(1000, 2000, 3000);
      satellite = new TwoBodySatellite(originalPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      // Modify original position to verify cloning
      originalPosition.x = 9999;
      
      expect(satellite._epoch.position).toEqual(new Cartesian3(1000, 2000, 3000));
      expect(satellite._epoch.position).not.toBe(originalPosition);
    });

    test('should clone input velocity vector', () => {
      const originalVelocity = new Cartesian3(100, 200, 300);
      satellite = new TwoBodySatellite(mockPosition, originalVelocity, mockTime, mockOrientation, mockName);
      
      // Modify original velocity to verify cloning
      originalVelocity.x = 9999;
      
      expect(satellite._epoch.velocity).toEqual(new Cartesian3(100, 200, 300));
      expect(satellite._epoch.velocity).not.toBe(originalVelocity);
    });

    test('should handle time parameter correctly', () => {
      const originalTime = JulianDate.clone(mockTime);
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, originalTime, mockOrientation, mockName);
      
      // Time should be cloned, not the same object reference
      expect(satellite._epoch.time).not.toBe(originalTime);
      expect(JulianDate.equals(satellite._epoch.time, originalTime)).toBe(true);
    });

    test('should store epoch data correctly', () => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      expect(satellite._epoch).toBeDefined();
      expect(satellite._epoch.position).toBeInstanceOf(Cartesian3);
      expect(satellite._epoch.velocity).toBeInstanceOf(Cartesian3);
      expect(satellite._epoch.time).toBeDefined();
    });

    test('should handle zero vectors', () => {
      const zeroPosition = Cartesian3.ZERO;
      const zeroVelocity = Cartesian3.ZERO;
      
      expect(() => {
        satellite = new TwoBodySatellite(zeroPosition, zeroVelocity, mockTime, mockOrientation, mockName);
      }).not.toThrow();
      
      expect(rv2period).toHaveBeenCalledWith(CMath.GRAVITATIONALPARAMETER, zeroPosition, zeroVelocity);
      expect(rv2ecc).toHaveBeenCalledWith(CMath.GRAVITATIONALPARAMETER, zeroPosition, zeroVelocity);
    });
  });

  describe('_update method', () => {
    let mockUniverse;

    beforeEach(() => {
      mockUniverse = { name: 'testUniverse' };
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
    });

    test('should call vallado with correct parameters', () => {
      const futureTime = JulianDate.addSeconds(mockTime, 3600, new JulianDate()); // 1 hour later
      
      const mockRv = {
        position: new Cartesian3(8000000, 0, 0),
        velocity: new Cartesian3(0, 6000, 0)
      };
      vallado.mockReturnValue(mockRv);
      
      satellite._update(futureTime, mockUniverse);
      
      // Use toHaveBeenCalledWith with approximate matcher for floating point time
      expect(vallado).toHaveBeenCalledWith(
        CMath.GRAVITATIONALPARAMETER,
        satellite._epoch.position,
        satellite._epoch.velocity,
        expect.closeTo(3600, 0.01),
        350
      );
    });

    test('should update position and velocity from vallado result', () => {
      const futureTime = JulianDate.addSeconds(mockTime, 1800, new JulianDate()); // 30 minutes later
      
      const mockRv = {
        position: new Cartesian3(5000000, 5000000, 0),
        velocity: new Cartesian3(-5000, 5000, 0)
      };
      vallado.mockReturnValue(mockRv);
      
      satellite._update(futureTime, mockUniverse);
      
      expect(satellite._position).toEqual(mockRv.position);
      expect(satellite._velocity).toEqual(mockRv.velocity);
      expect(satellite._position).not.toBe(mockRv.position); // Verify cloning
      expect(satellite._velocity).not.toBe(mockRv.velocity); // Verify cloning
    });

    test('should handle negative time differences', () => {
      const pastTime = JulianDate.addSeconds(mockTime, -3600, new JulianDate()); // 1 hour before
      const expectedDeltaSec = -3600;
      
      const mockRv = {
        position: new Cartesian3(6000000, 0, 0),
        velocity: new Cartesian3(0, 8000, 0)
      };
      vallado.mockReturnValue(mockRv);
      
      satellite._update(pastTime, mockUniverse);
      
      expect(vallado).toHaveBeenCalledWith(
        CMath.GRAVITATIONALPARAMETER,
        satellite._epoch.position,
        satellite._epoch.velocity,
        expectedDeltaSec,
        350
      );
    });

    test('should handle zero time difference', () => {
      const sameTime = JulianDate.clone(mockTime);
      
      const mockRv = {
        position: new Cartesian3(7000000, 0, 0),
        velocity: new Cartesian3(0, 7546, 0)
      };
      vallado.mockReturnValue(mockRv);
      
      satellite._update(sameTime, mockUniverse);
      
      expect(vallado).toHaveBeenCalledWith(
        CMath.GRAVITATIONALPARAMETER,
        satellite._epoch.position,
        satellite._epoch.velocity,
        0,
        350
      );
    });

    test('should handle large time differences', () => {
      const futureTime = JulianDate.addDays(mockTime, 365, new JulianDate()); // 1 year later
      const expectedDeltaSec = 365 * 24 * 3600; // seconds in a year
      
      const mockRv = {
        position: new Cartesian3(4000000, 6000000, 2000000),
        velocity: new Cartesian3(-3000, 2000, 5000)
      };
      vallado.mockReturnValue(mockRv);
      
      satellite._update(futureTime, mockUniverse);
      
      expect(vallado).toHaveBeenCalledWith(
        CMath.GRAVITATIONALPARAMETER,
        satellite._epoch.position,
        satellite._epoch.velocity,
        expectedDeltaSec,
        350
      );
    });

    test('should preserve original epoch data during updates', () => {
      const originalEpochPosition = Cartesian3.clone(satellite._epoch.position);
      const originalEpochVelocity = Cartesian3.clone(satellite._epoch.velocity);
      const originalEpochTime = JulianDate.clone(satellite._epoch.time);
      
      const futureTime = JulianDate.addSeconds(mockTime, 1800, new JulianDate());
      const mockRv = {
        position: new Cartesian3(5000000, 5000000, 0),
        velocity: new Cartesian3(-5000, 5000, 0)
      };
      vallado.mockReturnValue(mockRv);
      
      satellite._update(futureTime, mockUniverse);
      
      // Epoch should remain unchanged
      expect(satellite._epoch.position).toEqual(originalEpochPosition);
      expect(satellite._epoch.velocity).toEqual(originalEpochVelocity);
      expect(JulianDate.equals(satellite._epoch.time, originalEpochTime)).toBe(true);
    });
  });

  describe('inheritance from SimObject', () => {
    beforeEach(() => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
    });

    test('should have SimObject properties', () => {
      expect(satellite._position).toBeInstanceOf(Cartesian3);
      expect(satellite._velocity).toBeInstanceOf(Cartesian3);
      expect(satellite._updateListeners).toEqual([]);
      expect(satellite._referenceFrame).toBe(ReferenceFrame.INERTIAL);
    });

    test('should call _update when update is called', () => {
      const mockRv = {
        position: new Cartesian3(8000000, 0, 0),
        velocity: new Cartesian3(0, 6000, 0)
      };
      vallado.mockReturnValue(mockRv);
      
      const futureTime = JulianDate.addSeconds(mockTime, 1800, new JulianDate());
      const mockUniverse = {};
      
      satellite.update(futureTime, mockUniverse);
      
      expect(vallado).toHaveBeenCalled();
      expect(satellite._position).toEqual(mockRv.position);
      expect(satellite._velocity).toEqual(mockRv.velocity);
    });

    test('should inherit getter properties', () => {
      expect(satellite.name).toBe(mockName);
      expect(satellite.period).toBe(5553.5);
      expect(satellite.eccentricity).toBe(0.0001);
      expect(satellite.referenceFrame).toBe(ReferenceFrame.INERTIAL);
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle vallado throwing an exception', () => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      vallado.mockImplementation(() => {
        throw new Error('Vallado propagation failed');
      });
      
      expect(() => {
        satellite._update(JulianDate.addSeconds(mockTime, 3600, new JulianDate()), {});
      }).toThrow('Vallado propagation failed');
    });

    test('should handle rv2period returning NaN', () => {
      rv2period.mockReturnValue(NaN);
      
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      expect(satellite._period).toBeNaN();
    });

    test('should handle rv2ecc returning NaN', () => {
      rv2ecc.mockReturnValue(NaN);
      
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      expect(satellite._eccentricity).toBeNaN();
    });

    test('should handle vallado returning null position', () => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      vallado.mockReturnValue({
        position: null,
        velocity: new Cartesian3(0, 6000, 0)
      });
      
      // This should not throw because Cartesian3.clone(null, target) handles null gracefully
      expect(() => {
        satellite._update(JulianDate.addSeconds(mockTime, 3600, new JulianDate()), {});
      }).not.toThrow();
      
      // When Cartesian3.clone(null, target) is called, the target remains unchanged
      expect(satellite._position).toEqual(new Cartesian3(0, 0, 0));
    });

    test('should handle vallado returning null velocity', () => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      vallado.mockReturnValue({
        position: new Cartesian3(8000000, 0, 0),
        velocity: null
      });
      
      // This should not throw because Cartesian3.clone(null, target) handles null gracefully
      expect(() => {
        satellite._update(JulianDate.addSeconds(mockTime, 3600, new JulianDate()), {});
      }).not.toThrow();
      
      // When Cartesian3.clone(null, target) is called, the target remains unchanged
      expect(satellite._velocity).toEqual(new Cartesian3(0, 0, 0));
    });
  });

  describe('orbital mechanics integration', () => {
    test('should correctly use gravitational parameter', () => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      expect(rv2period).toHaveBeenCalledWith(CMath.GRAVITATIONALPARAMETER, expect.any(Cartesian3), expect.any(Cartesian3));
      expect(rv2ecc).toHaveBeenCalledWith(CMath.GRAVITATIONALPARAMETER, expect.any(Cartesian3), expect.any(Cartesian3));
      
      const futureTime = JulianDate.addSeconds(mockTime, 3600, new JulianDate());
      vallado.mockReturnValue({
        position: new Cartesian3(8000000, 0, 0),
        velocity: new Cartesian3(0, 6000, 0)
      });
      
      satellite._update(futureTime, {});
      
      expect(vallado).toHaveBeenCalledWith(CMath.GRAVITATIONALPARAMETER, expect.any(Cartesian3), expect.any(Cartesian3), expect.any(Number), 350);
    });

    test('should use 350 iterations for vallado propagation', () => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
      
      vallado.mockReturnValue({
        position: new Cartesian3(8000000, 0, 0),
        velocity: new Cartesian3(0, 6000, 0)
      });
      
      satellite._update(JulianDate.addSeconds(mockTime, 3600, new JulianDate()), {});
      
      expect(vallado).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Cartesian3),
        expect.any(Cartesian3),
        expect.any(Number),
        350
      );
    });
  });

  describe('performance considerations', () => {
    beforeEach(() => {
      satellite = new TwoBodySatellite(mockPosition, mockVelocity, mockTime, mockOrientation, mockName);
    });

    test('should only call vallado once per update', () => {
      vallado.mockReturnValue({
        position: new Cartesian3(8000000, 0, 0),
        velocity: new Cartesian3(0, 6000, 0)
      });
      
      satellite._update(JulianDate.addSeconds(mockTime, 3600, new JulianDate()), {});
      
      expect(vallado).toHaveBeenCalledTimes(1);
    });

    test('should reuse position and velocity objects', () => {
      const originalPosition = satellite._position;
      const originalVelocity = satellite._velocity;
      
      vallado.mockReturnValue({
        position: new Cartesian3(8000000, 0, 0),
        velocity: new Cartesian3(0, 6000, 0)
      });
      
      satellite._update(JulianDate.addSeconds(mockTime, 3600, new JulianDate()), {});
      
      // Should modify existing objects, not create new ones
      expect(satellite._position).toBe(originalPosition);
      expect(satellite._velocity).toBe(originalVelocity);
    });
  });
});
