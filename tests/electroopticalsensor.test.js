// Mock cesium and SimObject dependencies first
jest.mock('cesium', () => ({
  JulianDate: jest.fn(),
  Cartesian3: {
    ZERO: { x: 0, y: 0, z: 0 },
    clone: jest.fn()
  }
}));

jest.mock('../src/engine/objects/SimObject.js', () => {
  const mockUpdate = jest.fn();
  return jest.fn().mockImplementation((name) => {
    const instance = {
      name: name || 'MockSimObject',
      _referenceFrame: null,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      lastUpdate: null,
      update: mockUpdate,
      _update: jest.fn()
    };
    return instance;
  });
});

import ElectroOpicalSensor from '../src/engine/objects/ElectroOpticalSensor.js';
import { JulianDate } from 'cesium';

// Mock universe object
const mockUniverse = {
  time: new JulianDate(),
  objects: []
};

describe('ElectroOpicalSensor', () => {
  describe('constructor', () => {
    it('should create ElectroOpicalSensor with all parameters', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      expect(sensor.height).toBe(100);
      expect(sensor.width).toBe(200);
      expect(sensor.y_fov).toBe(10);
      expect(sensor.x_fov).toBe(20);
      expect(sensor.field_of_regard).toEqual([]);
      expect(sensor.name).toBe('TestSensor');
    });

    it('should create ElectroOpicalSensor with default field_of_regard', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20);

      expect(sensor.height).toBe(100);
      expect(sensor.width).toBe(200);
      expect(sensor.y_fov).toBe(10);
      expect(sensor.x_fov).toBe(20);
      expect(sensor.field_of_regard).toEqual([]);
    });

    it('should create ElectroOpicalSensor with default name', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, []);

      expect(sensor.height).toBe(100);
      expect(sensor.width).toBe(200);
      expect(sensor.y_fov).toBe(10);
      expect(sensor.x_fov).toBe(20);
      expect(sensor.field_of_regard).toEqual([]);
      expect(sensor.name).toBe('ElectroOpticalSensor');
    });

    it('should create ElectroOpicalSensor with all defaults', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20);

      expect(sensor.height).toBe(100);
      expect(sensor.width).toBe(200);
      expect(sensor.y_fov).toBe(10);
      expect(sensor.x_fov).toBe(20);
      expect(sensor.field_of_regard).toEqual([]);
      expect(sensor.name).toBe('ElectroOpticalSensor');
    });

    it('should calculate y_ifov correctly', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      expect(sensor.y_ifov).toBe(0.1); // 10 / 100
    });

    it('should calculate x_ifov correctly', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      expect(sensor.x_ifov).toBe(0.1); // 20 / 200
    });

    it('should store field_of_regard correctly', () => {
      const fieldOfRegard = [
        { name: 'region1', bounds: [0, 0, 10, 10] },
        { name: 'region2', bounds: [20, 20, 30, 30] }
      ];
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, fieldOfRegard, 'TestSensor');

      expect(sensor.field_of_regard).toBe(fieldOfRegard);
      expect(sensor.field_of_regard).toHaveLength(2);
      expect(sensor.field_of_regard[0].name).toBe('region1');
      expect(sensor.field_of_regard[1].name).toBe('region2');
    });

    it('should handle zero dimensions', () => {
      const sensor = new ElectroOpicalSensor(0, 0, 0, 0, [], 'ZeroSensor');

      expect(sensor.height).toBe(0);
      expect(sensor.width).toBe(0);
      expect(sensor.y_fov).toBe(0);
      expect(sensor.x_fov).toBe(0);
      expect(sensor.y_ifov).toBe(NaN); // 0 / 0 = NaN
      expect(sensor.x_ifov).toBe(NaN); // 0 / 0 = NaN
    });

    it('should handle very small dimensions', () => {
      const sensor = new ElectroOpicalSensor(1, 1, 0.1, 0.1, [], 'SmallSensor');

      expect(sensor.height).toBe(1);
      expect(sensor.width).toBe(1);
      expect(sensor.y_fov).toBe(0.1);
      expect(sensor.x_fov).toBe(0.1);
      expect(sensor.y_ifov).toBe(0.1); // 0.1 / 1
      expect(sensor.x_ifov).toBe(0.1); // 0.1 / 1
    });

    it('should handle large dimensions', () => {
      const sensor = new ElectroOpicalSensor(10000, 20000, 180, 360, [], 'LargeSensor');

      expect(sensor.height).toBe(10000);
      expect(sensor.width).toBe(20000);
      expect(sensor.y_fov).toBe(180);
      expect(sensor.x_fov).toBe(360);
      expect(sensor.y_ifov).toBe(0.018); // 180 / 10000
      expect(sensor.x_ifov).toBe(0.018); // 360 / 20000
    });

    it('should handle negative dimensions', () => {
      const sensor = new ElectroOpicalSensor(-100, -200, -10, -20, [], 'NegativeSensor');

      expect(sensor.height).toBe(-100);
      expect(sensor.width).toBe(-200);
      expect(sensor.y_fov).toBe(-10);
      expect(sensor.x_fov).toBe(-20);
      expect(sensor.y_ifov).toBe(0.1); // -10 / -100
      expect(sensor.x_ifov).toBe(0.1); // -20 / -200
    });

    it('should handle fractional dimensions', () => {
      const sensor = new ElectroOpicalSensor(50.5, 100.7, 5.3, 10.9, [], 'FractionalSensor');

      expect(sensor.height).toBe(50.5);
      expect(sensor.width).toBe(100.7);
      expect(sensor.y_fov).toBe(5.3);
      expect(sensor.x_fov).toBe(10.9);
      expect(sensor.y_ifov).toBeCloseTo(0.10495, 4); // 5.3 / 50.5
      expect(sensor.x_ifov).toBeCloseTo(0.10824, 4); // 10.9 / 100.7
    });
  });

  describe('inheritance from SimObject', () => {
    it('should extend SimObject', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      // Check that it has properties that would come from SimObject constructor
      expect(sensor.name).toBe('TestSensor');
      expect(sensor).toHaveProperty('_referenceFrame');
      expect(sensor).toHaveProperty('position');
      expect(sensor).toHaveProperty('velocity');
    });

    it('should call SimObject constructor with name parameter', () => {
      const SimObject = require('../src/engine/objects/SimObject.js');
      
      new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');
      
      expect(SimObject).toHaveBeenCalledWith('TestSensor');
    });

    it('should call SimObject constructor with default name', () => {
      const SimObject = require('../src/engine/objects/SimObject.js');
      SimObject.mockClear();
      
      new ElectroOpicalSensor(100, 200, 10, 20);
      
      expect(SimObject).toHaveBeenCalledWith('ElectroOpticalSensor');
    });

    it('should have access to SimObject methods', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      expect(sensor).toHaveProperty('update');
      expect(sensor).toHaveProperty('_update');
      expect(typeof sensor.update).toBe('function');
      expect(typeof sensor._update).toBe('function');
    });
  });

  describe('_update method', () => {
    it('should be defined and callable', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      expect(typeof sensor._update).toBe('function');
      expect(() => sensor._update(new JulianDate(), mockUniverse)).not.toThrow();
    });

    it('should handle JulianDate time parameter', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');
      const time = new JulianDate();

      expect(() => sensor._update(time, mockUniverse)).not.toThrow();
    });

    it('should handle universe parameter', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');
      const time = new JulianDate();

      expect(() => sensor._update(time, mockUniverse)).not.toThrow();
    });

    it('should handle null time parameter', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      expect(() => sensor._update(null, mockUniverse)).not.toThrow();
    });

    it('should handle undefined time parameter', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      expect(() => sensor._update(undefined, mockUniverse)).not.toThrow();
    });

    it('should handle null universe parameter', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');
      const time = new JulianDate();

      expect(() => sensor._update(time, null)).not.toThrow();
    });

    it('should handle undefined universe parameter', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');
      const time = new JulianDate();

      expect(() => sensor._update(time, undefined)).not.toThrow();
    });

    it('should handle both null parameters', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      expect(() => sensor._update(null, null)).not.toThrow();
    });

    it('should handle both undefined parameters', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      expect(() => sensor._update(undefined, undefined)).not.toThrow();
    });

    it('should do nothing (as documented in TODO comment)', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');
      const time = new JulianDate();
      
      // Capture initial state
      const initialHeight = sensor.height;
      const initialWidth = sensor.width;
      const initialYFov = sensor.y_fov;
      const initialXFov = sensor.x_fov;
      const initialFieldOfRegard = sensor.field_of_regard;

      // Call _update
      sensor._update(time, mockUniverse);

      // Verify nothing changed
      expect(sensor.height).toBe(initialHeight);
      expect(sensor.width).toBe(initialWidth);
      expect(sensor.y_fov).toBe(initialYFov);
      expect(sensor.x_fov).toBe(initialXFov);
      expect(sensor.field_of_regard).toBe(initialFieldOfRegard);
    });
  });

  describe('field of view calculations', () => {
    it('should calculate IFOV correctly for square sensor', () => {
      const sensor = new ElectroOpicalSensor(100, 100, 10, 10, [], 'SquareSensor');

      expect(sensor.y_ifov).toBe(0.1);
      expect(sensor.x_ifov).toBe(0.1);
    });

    it('should calculate IFOV correctly for rectangular sensor', () => {
      const sensor = new ElectroOpicalSensor(200, 400, 20, 40, [], 'RectangularSensor');

      expect(sensor.y_ifov).toBe(0.1); // 20 / 200
      expect(sensor.x_ifov).toBe(0.1); // 40 / 400
    });

    it('should calculate IFOV correctly for different aspect ratios', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 5, 20, [], 'AspectRatioSensor');

      expect(sensor.y_ifov).toBe(0.05); // 5 / 100
      expect(sensor.x_ifov).toBe(0.1); // 20 / 200
    });

    it('should handle high-resolution sensors', () => {
      const sensor = new ElectroOpicalSensor(4096, 4096, 1, 1, [], 'HighResSensor');

      expect(sensor.y_ifov).toBeCloseTo(0.000244, 6); // 1 / 4096
      expect(sensor.x_ifov).toBeCloseTo(0.000244, 6); // 1 / 4096
    });

    it('should handle low-resolution sensors', () => {
      const sensor = new ElectroOpicalSensor(10, 10, 90, 90, [], 'LowResSensor');

      expect(sensor.y_ifov).toBe(9); // 90 / 10
      expect(sensor.x_ifov).toBe(9); // 90 / 10
    });
  });

  describe('field of regard handling', () => {
    it('should handle empty field of regard', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'EmptyFORSensor');

      expect(sensor.field_of_regard).toEqual([]);
      expect(sensor.field_of_regard).toHaveLength(0);
    });

    it('should handle single field of regard entry', () => {
      const fieldOfRegard = [{ name: 'region1', angle: 45 }];
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, fieldOfRegard, 'SingleFORSensor');

      expect(sensor.field_of_regard).toBe(fieldOfRegard);
      expect(sensor.field_of_regard).toHaveLength(1);
      expect(sensor.field_of_regard[0].name).toBe('region1');
      expect(sensor.field_of_regard[0].angle).toBe(45);
    });

    it('should handle multiple field of regard entries', () => {
      const fieldOfRegard = [
        { name: 'region1', angle: 45, elevation: 10 },
        { name: 'region2', angle: 90, elevation: 20 },
        { name: 'region3', angle: 135, elevation: 30 }
      ];
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, fieldOfRegard, 'MultiFORSensor');

      expect(sensor.field_of_regard).toBe(fieldOfRegard);
      expect(sensor.field_of_regard).toHaveLength(3);
      expect(sensor.field_of_regard[0].name).toBe('region1');
      expect(sensor.field_of_regard[1].name).toBe('region2');
      expect(sensor.field_of_regard[2].name).toBe('region3');
    });

    it('should handle complex field of regard objects', () => {
      const fieldOfRegard = [{
        name: 'complex_region',
        bounds: {
          north: 45,
          south: -45,
          east: 180,
          west: -180
        },
        constraints: ['no_sun_glint', 'min_elevation_10'],
        priority: 1
      }];
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, fieldOfRegard, 'ComplexFORSensor');

      expect(sensor.field_of_regard).toBe(fieldOfRegard);
      expect(sensor.field_of_regard[0].name).toBe('complex_region');
      expect(sensor.field_of_regard[0].bounds.north).toBe(45);
      expect(sensor.field_of_regard[0].constraints).toContain('no_sun_glint');
      expect(sensor.field_of_regard[0].priority).toBe(1);
    });

    it('should preserve field of regard reference (not clone)', () => {
      const fieldOfRegard = [{ name: 'region1' }];
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, fieldOfRegard, 'RefSensor');

      expect(sensor.field_of_regard).toBe(fieldOfRegard);
      expect(sensor.field_of_regard === fieldOfRegard).toBe(true);

      // Modifications to original should be reflected
      fieldOfRegard.push({ name: 'region2' });
      expect(sensor.field_of_regard).toHaveLength(2);
    });
  });

  describe('property immutability and data integrity', () => {
    it('should maintain property values after construction', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      // Properties should remain constant
      expect(sensor.height).toBe(100);
      expect(sensor.width).toBe(200);
      expect(sensor.y_fov).toBe(10);
      expect(sensor.x_fov).toBe(20);
      
      // IFOV should remain constant
      expect(sensor.y_ifov).toBe(0.1);
      expect(sensor.x_ifov).toBe(0.1);
    });

    it('should maintain property types', () => {
      const sensor = new ElectroOpicalSensor(100, 200, 10, 20, [], 'TestSensor');

      expect(typeof sensor.height).toBe('number');
      expect(typeof sensor.width).toBe('number');
      expect(typeof sensor.y_fov).toBe('number');
      expect(typeof sensor.x_fov).toBe('number');
      expect(typeof sensor.y_ifov).toBe('number');
      expect(typeof sensor.x_ifov).toBe('number');
      expect(typeof sensor.name).toBe('string');
      expect(Array.isArray(sensor.field_of_regard)).toBe(true);
    });

    it('should handle all numeric edge cases consistently', () => {
      // Test with various numeric edge cases
      const testCases = [
        [0, 1, 0, 1],
        [1, 0, 1, 0],
        [Number.MAX_VALUE, Number.MAX_VALUE, 1, 1],
        [Number.MIN_VALUE, Number.MIN_VALUE, 1, 1],
        [Number.POSITIVE_INFINITY, 1, 1, 1],
        [1, Number.POSITIVE_INFINITY, 1, 1]
      ];

      testCases.forEach(([height, width, y_fov, x_fov], index) => {
        const sensor = new ElectroOpicalSensor(height, width, y_fov, x_fov, [], `EdgeCase${index}`);
        
        expect(sensor.height).toBe(height);
        expect(sensor.width).toBe(width);
        expect(sensor.y_fov).toBe(y_fov);
        expect(sensor.x_fov).toBe(x_fov);
        
        // IFOV calculations should be consistent
        expect(sensor.y_ifov).toBe(y_fov / height);
        expect(sensor.x_ifov).toBe(x_fov / width);
      });
    });
  });

  describe('integration and real-world scenarios', () => {
    it('should handle typical satellite sensor configuration', () => {
      const fieldOfRegard = [
        { name: 'nadir', elevation_min: -90, elevation_max: 0 },
        { name: 'horizon', elevation_min: 0, elevation_max: 90 }
      ];
      const sensor = new ElectroOpicalSensor(2048, 2048, 2, 2, fieldOfRegard, 'SatelliteSensor');

      expect(sensor.height).toBe(2048);
      expect(sensor.width).toBe(2048);
      expect(sensor.y_fov).toBe(2);
      expect(sensor.x_fov).toBe(2);
      expect(sensor.y_ifov).toBeCloseTo(0.0009765625, 10); // 2 / 2048
      expect(sensor.x_ifov).toBeCloseTo(0.0009765625, 10); // 2 / 2048
      expect(sensor.field_of_regard).toHaveLength(2);
    });

    it('should handle ground-based telescope configuration', () => {
      const fieldOfRegard = [
        { name: 'zenith_avoidance', elevation_min: 10, elevation_max: 85 }
      ];
      const sensor = new ElectroOpicalSensor(4096, 4096, 1, 1, fieldOfRegard, 'TelescopeSensor');

      expect(sensor.height).toBe(4096);
      expect(sensor.width).toBe(4096);
      expect(sensor.y_fov).toBe(1);
      expect(sensor.x_fov).toBe(1);
      expect(sensor.y_ifov).toBeCloseTo(0.000244140625, 12); // 1 / 4096
      expect(sensor.x_ifov).toBeCloseTo(0.000244140625, 12); // 1 / 4096
      expect(sensor.field_of_regard[0].name).toBe('zenith_avoidance');
    });

    it('should handle wide-field survey sensor configuration', () => {
      const sensor = new ElectroOpicalSensor(1024, 1024, 30, 30, [], 'SurveySensor');

      expect(sensor.height).toBe(1024);
      expect(sensor.width).toBe(1024);
      expect(sensor.y_fov).toBe(30);
      expect(sensor.x_fov).toBe(30);
      expect(sensor.y_ifov).toBeCloseTo(0.029296875, 9); // 30 / 1024
      expect(sensor.x_ifov).toBeCloseTo(0.029296875, 9); // 30 / 1024
    });

    it('should support multiple sensor instances with different configurations', () => {
      const sensor1 = new ElectroOpicalSensor(512, 512, 5, 5, [], 'Sensor1');
      const sensor2 = new ElectroOpicalSensor(1024, 1024, 10, 10, [], 'Sensor2');
      const sensor3 = new ElectroOpicalSensor(2048, 2048, 2, 2, [], 'Sensor3');

      // Each should maintain its own configuration
      expect(sensor1.height).toBe(512);
      expect(sensor2.height).toBe(1024);
      expect(sensor3.height).toBe(2048);

      expect(sensor1.y_ifov).toBeCloseTo(0.009765625, 9); // 5 / 512
      expect(sensor2.y_ifov).toBeCloseTo(0.009765625, 9); // 10 / 1024
      expect(sensor3.y_ifov).toBeCloseTo(0.0009765625, 10); // 2 / 2048
    });
  });
});
