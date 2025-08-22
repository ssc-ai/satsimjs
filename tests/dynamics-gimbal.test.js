import { Cartesian3, Math as CMath } from 'cesium';
import { southEastZenithToAzEl, spaceBasedToAzEl } from '../src/engine/dynamics/gimbal.js';

// Mock Cesium
jest.mock('cesium', () => ({
  Cartesian3: {
    magnitude: jest.fn((cartesian) => {
      return Math.sqrt(cartesian.x * cartesian.x + cartesian.y * cartesian.y + cartesian.z * cartesian.z);
    })
  },
  Math: {
    TWO_PI: 2 * Math.PI,
    DEGREES_PER_RADIAN: 180 / Math.PI
  }
}));

describe('Dynamics Gimbal Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('southEastZenithToAzEl', () => {
    test('should handle zero vector', () => {
      const input = { x: 0, y: 0, z: 0 };
      const [az, el, mag] = southEastZenithToAzEl(input);
      
      expect(az).toBe(0);
      expect(el).toBe(0);
      expect(mag).toBe(0);
    });

    test('should handle vector with zero x and y components', () => {
      const input = { x: 0, y: 0, z: 5 };
      const [az, el, mag] = southEastZenithToAzEl(input);
      
      expect(az).toBe(0);
      expect(el).toBe(90); // 90 degrees for vertical vector
      expect(mag).toBe(5);
    });

    test('should handle vector pointing east', () => {
      const input = { x: -1, y: 0, z: 0 };
      const [az, el, mag] = southEastZenithToAzEl(input);
      
      expect(az).toBe(0); // East direction
      expect(el).toBe(0); // Horizontal
      expect(mag).toBe(1);
    });

    test('should handle vector pointing north', () => {
      const input = { x: 0, y: 1, z: 0 };
      const [az, el, mag] = southEastZenithToAzEl(input);
      
      expect(az).toBe(90); // North direction
      expect(el).toBe(0); // Horizontal
      expect(mag).toBe(1);
    });

    test('should handle vector pointing south', () => {
      const input = { x: 0, y: -1, z: 0 };
      const [az, el, mag] = southEastZenithToAzEl(input);
      
      expect(az).toBe(270); // South direction
      expect(el).toBe(0); // Horizontal
      expect(mag).toBe(1);
    });

    test('should handle vector pointing west', () => {
      const input = { x: 1, y: 0, z: 0 };
      const [az, el, mag] = southEastZenithToAzEl(input);
      
      expect(az).toBe(180); // West direction
      expect(el).toBe(0); // Horizontal
      expect(mag).toBe(1);
    });

    test('should handle negative azimuth correctly', () => {
      const input = { x: 1, y: -1, z: 0 }; // Southwest direction
      const [az, el, mag] = southEastZenithToAzEl(input);
      
      expect(az).toBeGreaterThan(180);
      expect(az).toBeLessThan(270);
      expect(el).toBe(0);
      expect(mag).toBeCloseTo(Math.sqrt(2));
    });

    test('should handle very small magnitude', () => {
      const input = { x: 1e-10, y: 1e-10, z: 1e-10 };
      const [az, el, mag] = southEastZenithToAzEl(input);
      
      expect(el).toBe(0); // Should be zero for very small magnitude
      expect(mag).toBeCloseTo(Math.sqrt(3e-20));
    });

    test('should handle 45-degree elevation', () => {
      const input = { x: -1, y: 0, z: 1 };
      const [az, el, mag] = southEastZenithToAzEl(input);
      
      expect(az).toBe(0); // East direction
      expect(el).toBeCloseTo(45); // 45-degree elevation
      expect(mag).toBeCloseTo(Math.sqrt(2));
    });

    test('should handle arbitrary 3D vector', () => {
      const input = { x: -3, y: 4, z: 5 };
      const [az, el, mag] = southEastZenithToAzEl(input);
      
      expect(az).toBeGreaterThan(0);
      expect(az).toBeLessThan(360);
      expect(el).toBeGreaterThan(0);
      expect(el).toBeLessThan(90);
      expect(mag).toBeCloseTo(Math.sqrt(50));
    });

    test('should handle negative elevation', () => {
      const input = { x: -1, y: 0, z: -1 };
      const [az, el, mag] = southEastZenithToAzEl(input);
      
      expect(az).toBe(0); // East direction
      expect(el).toBeCloseTo(-45); // Negative elevation
      expect(mag).toBeCloseTo(Math.sqrt(2));
    });
  });

  describe('spaceBasedToAzEl', () => {
    test('should handle zero vector', () => {
      const input = { x: 0, y: 0, z: 0 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBe(0);
      expect(el).toBe(0);
      expect(mag).toBe(0);
    });

    test('should handle vector with zero x and y components', () => {
      const input = { x: 0, y: 0, z: -5 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBe(0);
      expect(el).toBe(0); // Pointing nadir in space-based system
      expect(mag).toBe(5);
    });

    test('should handle vector pointing in positive z direction', () => {
      const input = { x: 0, y: 0, z: 5 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBe(0);
      expect(el).toBe(180); // Pointing up in space-based system
      expect(mag).toBe(5);
    });

    test('should handle vector pointing east', () => {
      const input = { x: -1, y: 0, z: 0 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBe(0); // East direction
      expect(el).toBe(90); // Horizontal in space-based system
      expect(mag).toBe(1);
    });

    test('should handle vector pointing north', () => {
      const input = { x: 0, y: 1, z: 0 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBe(90); // North direction
      expect(el).toBe(90); // Horizontal in space-based system
      expect(mag).toBe(1);
    });

    test('should handle vector pointing south', () => {
      const input = { x: 0, y: -1, z: 0 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBe(270); // South direction
      expect(el).toBe(90); // Horizontal in space-based system
      expect(mag).toBe(1);
    });

    test('should handle vector pointing west', () => {
      const input = { x: 1, y: 0, z: 0 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBe(180); // West direction
      expect(el).toBe(90); // Horizontal in space-based system
      expect(mag).toBe(1);
    });

    test('should handle negative azimuth correctly', () => {
      const input = { x: 1, y: -1, z: 0 }; // Southwest direction
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBeGreaterThan(180);
      expect(az).toBeLessThan(270);
      expect(el).toBe(90);
      expect(mag).toBeCloseTo(Math.sqrt(2));
    });

    test('should handle very small r and z', () => {
      const input = { x: 1e-10, y: 1e-10, z: 1e-10 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(el).toBe(0); // Should be zero for very small values
      expect(mag).toBeCloseTo(Math.sqrt(3e-20));
    });

    test('should handle 45-degree elevation in space system', () => {
      const input = { x: -1, y: 0, z: -1 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBe(0); // East direction
      expect(el).toBeCloseTo(45); // 45-degree elevation in space system
      expect(mag).toBeCloseTo(Math.sqrt(2));
    });

    test('should handle arbitrary 3D vector', () => {
      const input = { x: -3, y: 4, z: -5 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBeGreaterThan(0);
      expect(az).toBeLessThan(360);
      expect(el).toBeGreaterThan(0);
      expect(el).toBeLessThan(180);
      expect(mag).toBeCloseTo(Math.sqrt(50));
    });

    test('should handle vectors in xy-plane', () => {
      const input = { x: 3, y: 4, z: 0 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBeGreaterThan(90);
      expect(az).toBeLessThan(180);
      expect(el).toBe(90); // Horizontal in space system
      expect(mag).toBe(5);
    });

    test('should handle diagonal vector', () => {
      const input = { x: 1, y: 1, z: -1 };
      const [az, el, mag] = spaceBasedToAzEl(input);
      
      expect(az).toBeCloseTo(135); // Northeast direction in azimuth calculation
      expect(el).toBeCloseTo(54.74); // Calculated elevation for space-based system
      expect(mag).toBeCloseTo(Math.sqrt(3));
    });
  });

  describe('edge cases and comparisons', () => {
    test('should handle very large values', () => {
      const input = { x: -1e6, y: 1e6, z: 1e6 };
      
      const [az1, el1, mag1] = southEastZenithToAzEl(input);
      const [az2, el2, mag2] = spaceBasedToAzEl(input);
      
      expect(az1).toBeCloseTo(az2); // Azimuth should be similar for both systems
      expect(mag1).toBeCloseTo(mag2); // Magnitude should be the same
      expect(mag1).toBeCloseTo(Math.sqrt(3e12));
    });

    test('should handle very small non-zero values', () => {
      const input = { x: -1e-8, y: 1e-8, z: 1e-8 };
      
      const [az1, el1, mag1] = southEastZenithToAzEl(input);
      const [az2, el2, mag2] = spaceBasedToAzEl(input);
      
      expect(az1).toBeCloseTo(az2); // Azimuth should be similar
      expect(mag1).toBeCloseTo(mag2); // Magnitude should be the same
    });

    test('should produce different elevations for same vector', () => {
      const input = { x: -1, y: 0, z: 1 };
      
      const [az1, el1, mag1] = southEastZenithToAzEl(input);
      const [az2, el2, mag2] = spaceBasedToAzEl(input);
      
      expect(az1).toBeCloseTo(az2); // Same azimuth
      expect(el1).not.toBeCloseTo(el2); // Different elevation systems
      expect(mag1).toBeCloseTo(mag2); // Same magnitude
    });

    test('should handle precision edge cases', () => {
      // Test boundary conditions for the tolerance checks
      const inputs = [
        { x: 1e-9, y: 1e-9, z: 1e-9 },
        { x: 1e-10, y: 0, z: 0 },
        { x: 0, y: 1e-10, z: 0 }
      ];

      inputs.forEach(input => {
        expect(() => southEastZenithToAzEl(input)).not.toThrow();
        expect(() => spaceBasedToAzEl(input)).not.toThrow();
      });
    });
  });
});
