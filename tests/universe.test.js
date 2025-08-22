import { jest } from '@jest/globals';
import Universe from '../src/engine/Universe.js';
import Earth from '../src/engine/objects/Earth.js';
import Sun from '../src/engine/objects/Sun.js';
import SGP4Satellite from '../src/engine/objects/SGP4Satellite.js';
import EarthGroundStation from '../src/engine/objects/EarthGroundStation.js';
import AzElGimbal from '../src/engine/objects/AzElGimbal.js';
import ElectroOpicalSensor from '../src/engine/objects/ElectroOpticalSensor.js';
import LagrangeInterpolatedObject from '../src/engine/objects/LagrangeInterpolatedObject.js';
import TwoBodySatellite from '../src/engine/objects/TwoBodySatellite.js';
import SimObject from '../src/engine/objects/SimObject.js';
import Observatory from '../src/engine/objects/Observatory.js';
import { Cartesian3, JulianDate } from 'cesium';

// Mock all the imported classes
jest.mock('../src/engine/objects/Earth.js');
jest.mock('../src/engine/objects/Sun.js');
jest.mock('../src/engine/objects/SGP4Satellite.js');
jest.mock('../src/engine/objects/EarthGroundStation.js');
jest.mock('../src/engine/objects/AzElGimbal.js');
jest.mock('../src/engine/objects/ElectroOpticalSensor.js');
jest.mock('../src/engine/objects/LagrangeInterpolatedObject.js');
jest.mock('../src/engine/objects/TwoBodySatellite.js');
jest.mock('../src/engine/objects/SimObject.js');
jest.mock('../src/engine/objects/Observatory.js');

// Mock console.warn to test warning messages
const originalWarn = console.warn;

describe('Universe', () => {
  let universe;
  let mockEarth;
  let mockSun;
  let mockObject;
  let mockTime;

  beforeEach(() => {
    // Clear all mock instances and calls
    jest.clearAllMocks();
    
    // Setup mock objects with proper methods
    mockEarth = {
      name: 'Earth',
      update: jest.fn(),
      attach: jest.fn(),
      removeChild: jest.fn()
    };
    
    mockSun = {
      name: 'Sun',
      update: jest.fn()
    };
    
    mockObject = {
      name: 'TestObject',
      update: jest.fn(),
      parent: null,
      attach: jest.fn(),
      removeChild: jest.fn()
    };

    mockTime = new JulianDate();

    // Mock constructors
    Earth.mockImplementation(() => mockEarth);
    Sun.mockImplementation(() => mockSun);
    SimObject.mockImplementation(() => mockObject);

    // Mock console.warn
    console.warn = jest.fn();

    universe = new Universe();
  });

  afterEach(() => {
    // Restore console.warn
    console.warn = originalWarn;
  });

  describe('constructor', () => {
    test('should create a universe with Earth and Sun objects', () => {
      expect(Earth).toHaveBeenCalledTimes(1);
      expect(Sun).toHaveBeenCalledTimes(1);
      expect(universe.earth).toBe(mockEarth);
      expect(universe.sun).toBe(mockSun);
    });

    test('should initialize empty collections', () => {
      expect(Object.keys(universe.objects)).toHaveLength(0);
      expect(universe.trackables).toHaveLength(0);
      expect(universe.gimbals).toHaveLength(0);
      expect(universe.sensors).toHaveLength(0);
    });

    test('should have proper getter methods', () => {
      expect(typeof universe.earth).toBe('object');
      expect(typeof universe.sun).toBe('object');
      expect(typeof universe.objects).toBe('object');
      expect(Array.isArray(universe.trackables)).toBe(true);
      expect(Array.isArray(universe.gimbals)).toBe(true);
      expect(Array.isArray(universe.sensors)).toBe(true);
    });
  });

  describe('hasObject', () => {
    test('should return false for non-existent object', () => {
      expect(universe.hasObject('NonExistent')).toBe(false);
    });

    test('should return true for existing object', () => {
      universe.addObject(mockObject);
      expect(universe.hasObject('TestObject')).toBe(true);
    });

    test('should handle empty string name', () => {
      expect(universe.hasObject('')).toBe(false);
    });

    test('should handle null name', () => {
      expect(universe.hasObject(null)).toBe(false);
    });

    test('should handle undefined name', () => {
      expect(universe.hasObject(undefined)).toBe(false);
    });
  });

  describe('getObject', () => {
    test('should return undefined for non-existent object', () => {
      expect(universe.getObject('NonExistent')).toBeUndefined();
    });

    test('should return object for existing object', () => {
      universe.addObject(mockObject);
      expect(universe.getObject('TestObject')).toBe(mockObject);
    });

    test('should return correct object when multiple objects exist', () => {
      const mockObject2 = { name: 'TestObject2', update: jest.fn() };
      universe.addObject(mockObject);
      universe.addObject(mockObject2);
      
      expect(universe.getObject('TestObject')).toBe(mockObject);
      expect(universe.getObject('TestObject2')).toBe(mockObject2);
    });
  });

  describe('addObject', () => {
    test('should add object as trackable by default', () => {
      const result = universe.addObject(mockObject);
      
      expect(universe.objects['TestObject']).toBe(mockObject);
      expect(universe.trackables).toContain(mockObject);
      expect(universe._nontrackables).not.toContain(mockObject);
      expect(result).toBe(mockObject);
    });

    test('should add object as non-trackable when specified', () => {
      const result = universe.addObject(mockObject, false);
      
      expect(universe.objects['TestObject']).toBe(mockObject);
      expect(universe._nontrackables).toContain(mockObject);
      expect(universe.trackables).not.toContain(mockObject);
      expect(result).toBe(mockObject);
    });

    test('should warn when adding object with duplicate name', () => {
      universe.addObject(mockObject);
      const duplicateObject = { name: 'TestObject', update: jest.fn() };
      
      universe.addObject(duplicateObject);
      
      expect(console.warn).toHaveBeenCalledWith(
        'Object with name TestObject already exists in universe: {object}'
      );
      expect(universe.objects['TestObject']).toBe(duplicateObject); // Last one wins
    });

    test('should handle multiple objects with different trackable settings', () => {
      const trackableObj = { name: 'Trackable', update: jest.fn() };
      const nonTrackableObj = { name: 'NonTrackable', update: jest.fn() };
      
      universe.addObject(trackableObj, true);
      universe.addObject(nonTrackableObj, false);
      
      expect(universe.trackables).toContain(trackableObj);
      expect(universe.trackables).not.toContain(nonTrackableObj);
      expect(universe._nontrackables).toContain(nonTrackableObj);
      expect(universe._nontrackables).not.toContain(trackableObj);
    });

    test('should handle object with no name property gracefully', () => {
      const noNameObject = { update: jest.fn() };
      const result = universe.addObject(noNameObject);
      
      expect(universe.objects[undefined]).toBe(noNameObject);
      expect(result).toBe(noNameObject);
    });
  });

  describe('removeObject', () => {
    test('should remove existing object from all collections', () => {
      universe.addObject(mockObject);
      expect(universe.hasObject('TestObject')).toBe(true);
      expect(universe.trackables).toContain(mockObject);
      
      universe.removeObject(mockObject);
      
      expect(universe.hasObject('TestObject')).toBe(false);
      expect(universe.trackables).not.toContain(mockObject);
    });

    test('should remove non-trackable object', () => {
      universe.addObject(mockObject, false);
      expect(universe.hasObject('TestObject')).toBe(true);
      expect(universe._nontrackables).toContain(mockObject);
      
      universe.removeObject(mockObject);
      
      expect(universe.hasObject('TestObject')).toBe(false);
      expect(universe._nontrackables).not.toContain(mockObject);
    });

    test('should handle removing non-existent object gracefully', () => {
      const nonExistentObject = { name: 'NonExistent', update: jest.fn() };
      
      expect(() => universe.removeObject(nonExistentObject)).not.toThrow();
    });

    test('should remove object from parent when parent exists', () => {
      const mockParent = { removeChild: jest.fn() };
      mockObject.parent = mockParent;
      universe.addObject(mockObject);
      
      universe.removeObject(mockObject);
      
      expect(mockParent.removeChild).toHaveBeenCalledWith(mockObject);
    });

    test('should handle object with no parent', () => {
      mockObject.parent = null;
      universe.addObject(mockObject);
      
      expect(() => universe.removeObject(mockObject)).not.toThrow();
    });

    test('should handle object with undefined parent', () => {
      mockObject.parent = undefined;
      universe.addObject(mockObject);
      
      expect(() => universe.removeObject(mockObject)).not.toThrow();
    });

    test('should remove object that appears in both trackable and non-trackable arrays', () => {
      // This shouldn't happen in normal use, but test the robustness
      universe.addObject(mockObject, true);
      universe._nontrackables.push(mockObject); // Artificially add to both
      
      universe.removeObject(mockObject);
      
      expect(universe.trackables).not.toContain(mockObject);
      expect(universe._nontrackables).not.toContain(mockObject);
    });
  });

  describe('addGroundSite', () => {
    let mockGroundStation;

    beforeEach(() => {
      mockGroundStation = {
        name: 'GroundSite',
        attach: jest.fn(),
        update: jest.fn()
      };
      EarthGroundStation.mockImplementation(() => mockGroundStation);
    });

    test('should create and add ground station with default trackable setting', () => {
      const result = universe.addGroundSite('TestSite', 40.7, -74.0, 100);
      
      expect(EarthGroundStation).toHaveBeenCalledWith(40.7, -74.0, 100, 'TestSite');
      expect(mockGroundStation.attach).toHaveBeenCalledWith(mockEarth);
      expect(universe.objects[mockGroundStation.name]).toBe(mockGroundStation);
      expect(universe._nontrackables).toContain(mockGroundStation);
      expect(universe.trackables).not.toContain(mockGroundStation);
      expect(result).toBe(mockGroundStation);
    });

    test('should create trackable ground station when specified', () => {
      const result = universe.addGroundSite('TestSite', 40.7, -74.0, 100, true);
      
      expect(universe.trackables).toContain(mockGroundStation);
      expect(universe._nontrackables).not.toContain(mockGroundStation);
      expect(result).toBe(mockGroundStation);
    });

    test('should handle different coordinate values', () => {
      universe.addGroundSite('NorthPole', 90, 0, 0);
      universe.addGroundSite('SouthPole', -90, 180, 2000);
      universe.addGroundSite('Equator', 0, 0, -100); // Below sea level
      
      expect(EarthGroundStation).toHaveBeenCalledTimes(3);
      expect(EarthGroundStation).toHaveBeenNthCalledWith(1, 90, 0, 0, 'NorthPole');
      expect(EarthGroundStation).toHaveBeenNthCalledWith(2, -90, 180, 2000, 'SouthPole');
      expect(EarthGroundStation).toHaveBeenNthCalledWith(3, 0, 0, -100, 'Equator');
    });

    test('should handle zero coordinates', () => {
      universe.addGroundSite('Origin', 0, 0, 0);
      
      expect(EarthGroundStation).toHaveBeenCalledWith(0, 0, 0, 'Origin');
    });

    test('should handle extreme coordinate values', () => {
      universe.addGroundSite('Extreme', 89.999, 179.999, 10000);
      
      expect(EarthGroundStation).toHaveBeenCalledWith(89.999, 179.999, 10000, 'Extreme');
    });
  });

  describe('addSGP4Satellite', () => {
    let mockSatellite;
    let mockLagrangeObject;

    beforeEach(() => {
      mockSatellite = {
        name: 'SGP4Sat',
        update: jest.fn()
      };
      
      mockLagrangeObject = {
        name: 'LagrangeSat',
        update: jest.fn()
      };
      
      SGP4Satellite.mockImplementation((line1, line2, orientation, name) => {
        return { ...mockSatellite, name: name };
      });
      LagrangeInterpolatedObject.mockImplementation(() => mockLagrangeObject);
    });

    test('should create SGP4 satellite with default settings', () => {
      const line1 = '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990';
      const line2 = '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891';
      
      const result = universe.addSGP4Satellite('ISS', line1, line2, 'nadir');
      
      expect(SGP4Satellite).toHaveBeenCalledWith(line1, line2, 'nadir', 'ISS');
      expect(universe.trackables).toHaveLength(1);
      expect(universe.trackables[0].name).toBe('ISS');
      expect(result.name).toBe('ISS');
    });

    test('should create Lagrange interpolated SGP4 satellite when specified', () => {
      const line1 = '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990';
      const line2 = '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891';
      
      const result = universe.addSGP4Satellite('ISS', line1, line2, 'nadir', true);
      
      expect(SGP4Satellite).toHaveBeenCalledWith(line1, line2, 'nadir', 'ISS');
      expect(LagrangeInterpolatedObject).toHaveBeenCalledWith(expect.objectContaining({ name: 'ISS' }));
      expect(universe.trackables).toContain(mockLagrangeObject);
      expect(result).toBe(mockLagrangeObject);
    });

    test('should create non-trackable satellite when specified', () => {
      const line1 = '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990';
      const line2 = '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891';
      
      const result = universe.addSGP4Satellite('ISS', line1, line2, 'nadir', false, false);
      
      expect(universe._nontrackables).toHaveLength(1);
      expect(universe._nontrackables[0].name).toBe('ISS');
      expect(universe.trackables).toHaveLength(0);
      expect(result.name).toBe('ISS');
    });

    test('should handle different orientation values', () => {
      const line1 = '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990';
      const line2 = '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891';
      
      universe.addSGP4Satellite('Sat1', line1, line2, 'nadir');
      universe.addSGP4Satellite('Sat2', line1, line2, 'velocity');
      universe.addSGP4Satellite('Sat3', line1, line2, 'fixed');
      
      expect(SGP4Satellite).toHaveBeenCalledTimes(3);
      expect(SGP4Satellite).toHaveBeenNthCalledWith(1, line1, line2, 'nadir', 'Sat1');
      expect(SGP4Satellite).toHaveBeenNthCalledWith(2, line1, line2, 'velocity', 'Sat2');
      expect(SGP4Satellite).toHaveBeenNthCalledWith(3, line1, line2, 'fixed', 'Sat3');
    });

    test('should create Lagrange interpolated non-trackable satellite', () => {
      const line1 = '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990';
      const line2 = '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891';
      
      const result = universe.addSGP4Satellite('ISS', line1, line2, 'nadir', true, false);
      
      expect(LagrangeInterpolatedObject).toHaveBeenCalledWith(expect.objectContaining({ name: 'ISS' }));
      expect(universe._nontrackables).toContain(mockLagrangeObject);
      expect(universe.trackables).not.toContain(mockLagrangeObject);
      expect(result).toBe(mockLagrangeObject);
    });
  });

  describe('addTwoBodySatellite', () => {
    let mockSatellite;
    let mockLagrangeObject;

    beforeEach(() => {
      mockSatellite = {
        name: 'TwoBodySat',
        update: jest.fn()
      };
      
      mockLagrangeObject = {
        name: 'LagrangeTwoBody',
        update: jest.fn()
      };
      
      TwoBodySatellite.mockImplementation((r0, v0, t0, orientation, name) => {
        return { ...mockSatellite, name: name };
      });
      LagrangeInterpolatedObject.mockImplementation(() => mockLagrangeObject);
    });

    test('should create two-body satellite with default settings', () => {
      const r0 = new Cartesian3(7000000, 0, 0);
      const v0 = new Cartesian3(0, 7500, 0);
      const t0 = new JulianDate();
      
      const result = universe.addTwoBodySatellite('TwoBody', r0, v0, t0, 'nadir');
      
      expect(TwoBodySatellite).toHaveBeenCalledWith(r0, v0, t0, 'nadir', 'TwoBody');
      expect(universe.trackables).toContain(result);
      expect(result.name).toBe('TwoBody');
    });

    test('should create Lagrange interpolated two-body satellite when specified', () => {
      const r0 = new Cartesian3(7000000, 0, 0);
      const v0 = new Cartesian3(0, 7500, 0);
      const t0 = new JulianDate();
      
      const result = universe.addTwoBodySatellite('TwoBody', r0, v0, t0, 'nadir', true);
      
      expect(TwoBodySatellite).toHaveBeenCalledWith(r0, v0, t0, 'nadir', 'TwoBody');
      expect(LagrangeInterpolatedObject).toHaveBeenCalledWith(expect.objectContaining({ name: 'TwoBody' }));
      expect(universe.trackables).toContain(mockLagrangeObject);
      expect(result).toBe(mockLagrangeObject);
    });

    test('should create non-trackable two-body satellite when specified', () => {
      const r0 = new Cartesian3(7000000, 0, 0);
      const v0 = new Cartesian3(0, 7500, 0);
      const t0 = new JulianDate();
      
      const result = universe.addTwoBodySatellite('TwoBody', r0, v0, t0, 'nadir', false, false);
      
      expect(universe._nontrackables).toContain(result);
      expect(universe.trackables).not.toContain(result);
      expect(result.name).toBe('TwoBody');
    });

    test('should handle different position and velocity vectors', () => {
      const positions = [
        new Cartesian3(7000000, 0, 0),
        new Cartesian3(0, 7000000, 0),
        new Cartesian3(0, 0, 7000000)
      ];
      
      const velocities = [
        new Cartesian3(0, 7500, 0),
        new Cartesian3(-7500, 0, 0),
        new Cartesian3(0, 0, 7500)
      ];
      
      const times = [
        new JulianDate(),
        JulianDate.addDays(new JulianDate(), 1, new JulianDate()),
        JulianDate.addDays(new JulianDate(), 2, new JulianDate())
      ];
      
      positions.forEach((r0, i) => {
        universe.addTwoBodySatellite(`Sat${i}`, r0, velocities[i], times[i], 'nadir');
      });
      
      expect(TwoBodySatellite).toHaveBeenCalledTimes(3);
      positions.forEach((r0, i) => {
        expect(TwoBodySatellite).toHaveBeenNthCalledWith(
          i + 1, 
          r0, 
          velocities[i], 
          times[i], 
          'nadir', 
          `Sat${i}`
        );
      });
    });

    test('should handle zero vectors', () => {
      const r0 = new Cartesian3(0, 0, 0);
      const v0 = new Cartesian3(0, 0, 0);
      const t0 = new JulianDate();
      
      const result = universe.addTwoBodySatellite('ZeroSat', r0, v0, t0, 'fixed');
      
      expect(TwoBodySatellite).toHaveBeenCalledWith(r0, v0, t0, 'fixed', 'ZeroSat');
      expect(result.name).toBe('ZeroSat');
    });

    test('should create Lagrange interpolated non-trackable two-body satellite', () => {
      const r0 = new Cartesian3(7000000, 0, 0);
      const v0 = new Cartesian3(0, 7500, 0);
      const t0 = new JulianDate();
      
      const result = universe.addTwoBodySatellite('TwoBody', r0, v0, t0, 'nadir', true, false);
      
      expect(LagrangeInterpolatedObject).toHaveBeenCalledWith(expect.objectContaining({ name: 'TwoBody' }));
      expect(universe._nontrackables).toContain(mockLagrangeObject);
      expect(universe.trackables).not.toContain(mockLagrangeObject);
      expect(result).toBe(mockLagrangeObject);
    });
  });

  describe('addGroundElectroOpticalObservatory', () => {
    let mockSite;
    let mockGimbal;
    let mockSensor;
    let mockObservatory;

    beforeEach(() => {
      mockSite = {
        name: 'ObservatorySite',
        attach: jest.fn(),
        update: jest.fn()
      };
      
      mockGimbal = {
        name: 'ObservatoryGimbal', // Updated to match expected naming
        attach: jest.fn(),
        update: jest.fn()
      };
      
      mockSensor = {
        name: 'ObservatorySensor', // Updated to match expected naming
        attach: jest.fn(),
        update: jest.fn()
      };
      
      mockObservatory = {
        site: mockSite,
        gimbal: mockGimbal,
        sensor: mockSensor
      };
      
      EarthGroundStation.mockImplementation((lat, lon, alt, name) => {
        return { ...mockSite, name: name };
      });
      AzElGimbal.mockImplementation((name) => {
        return { ...mockGimbal, name: name };
      });
      ElectroOpicalSensor.mockImplementation((h, w, y, x, for_, name) => {
        return { ...mockSensor, name: name };
      });
      Observatory.mockImplementation(() => mockObservatory);
    });

    test('should create complete observatory with all components', () => {
      const result = universe.addGroundElectroOpticalObservatory(
        'TestObs', 40.7, -74.0, 100, 'azEl', 
        1024, 768, 1.0, 1.5, [{ az_min: 0, az_max: 360, el_min: 10, el_max: 90 }]
      );
      
      // Verify site creation and attachment
      expect(EarthGroundStation).toHaveBeenCalledWith(40.7, -74.0, 100, 'TestObs');
      expect(mockSite.attach).toHaveBeenCalledWith(mockEarth);
      
      // Verify gimbal creation and attachment
      expect(AzElGimbal).toHaveBeenCalledWith('TestObs Gimbal');
      expect(mockGimbal.attach).toHaveBeenCalledWith(expect.objectContaining({ name: 'TestObs' }));
      
      // Verify sensor creation and attachment
      expect(ElectroOpicalSensor).toHaveBeenCalledWith(
        1024, 768, 1.0, 1.5, 
        [{ az_min: 0, az_max: 360, el_min: 10, el_max: 90 }], 
        'TestObs Sensor'
      );
      expect(mockSensor.attach).toHaveBeenCalledWith(expect.objectContaining({ name: 'TestObs Gimbal' }));
      
      // Verify observatory creation
      expect(Observatory).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestObs' }),
        expect.objectContaining({ name: 'TestObs Gimbal' }),
        expect.objectContaining({ name: 'TestObs Sensor' })
      );
      
      // Verify collections are updated
      expect(universe.objects['TestObs']).toEqual(expect.objectContaining({ name: 'TestObs' }));
      expect(universe.gimbals).toContainEqual(expect.objectContaining({ name: 'TestObs Gimbal' }));
      expect(universe.sensors).toContainEqual(expect.objectContaining({ name: 'TestObs Sensor' }));
      expect(universe._observatories).toContain(mockObservatory);
      
      expect(result).toBe(mockObservatory);
    });

    test('should handle different sensor configurations', () => {
      universe.addGroundElectroOpticalObservatory(
        'HighRes', 35.0, -106.0, 2000, 'azEl',
        4096, 4096, 0.5, 0.5, []
      );
      
      expect(ElectroOpicalSensor).toHaveBeenCalledWith(
        4096, 4096, 0.5, 0.5, [], 'HighRes Sensor'
      );
    });

    test('should handle different geographical locations', () => {
      // Test multiple observatories at different locations
      const locations = [
        { name: 'Arctic', lat: 85, lon: 0, alt: 0 },
        { name: 'Antarctic', lat: -80, lon: 180, alt: 3000 },
        { name: 'Equatorial', lat: 0, lon: 0, alt: 500 }
      ];
      
      locations.forEach(loc => {
        universe.addGroundElectroOpticalObservatory(
          loc.name, loc.lat, loc.lon, loc.alt, 'azEl',
          1024, 1024, 1.0, 1.0, []
        );
      });
      
      expect(EarthGroundStation).toHaveBeenCalledTimes(3);
      locations.forEach((loc, i) => {
        expect(EarthGroundStation).toHaveBeenNthCalledWith(
          i + 1, loc.lat, loc.lon, loc.alt, loc.name
        );
      });
    });

    test('should handle complex field of regard configurations', () => {
      const complexFoR = [
        { az_min: 0, az_max: 90, el_min: 20, el_max: 80 },
        { az_min: 180, az_max: 270, el_min: 30, el_max: 70 }
      ];
      
      universe.addGroundElectroOpticalObservatory(
        'Complex', 40.0, -120.0, 1000, 'azEl',
        2048, 1536, 0.8, 1.2, complexFoR
      );
      
      expect(ElectroOpicalSensor).toHaveBeenCalledWith(
        2048, 1536, 0.8, 1.2, complexFoR, 'Complex Sensor'
      );
    });

    test('should add components to correct collections', () => {
      const initialObjectsCount = Object.keys(universe.objects).length;
      const initialGimbalsCount = universe.gimbals.length;
      const initialSensorsCount = universe.sensors.length;
      const initialObservatoriesCount = universe._observatories.length;
      
      universe.addGroundElectroOpticalObservatory(
        'TestObs', 40.7, -74.0, 100, 'azEl',
        1024, 768, 1.0, 1.5, []
      );
      
      expect(Object.keys(universe.objects)).toHaveLength(initialObjectsCount + 3); // site, gimbal, sensor
      expect(universe.gimbals).toHaveLength(initialGimbalsCount + 1);
      expect(universe.sensors).toHaveLength(initialSensorsCount + 1);
      expect(universe._observatories).toHaveLength(initialObservatoriesCount + 1);
    });

    test('should handle zero field of view values', () => {
      universe.addGroundElectroOpticalObservatory(
        'ZeroFOV', 40.0, -120.0, 1000, 'azEl',
        1024, 768, 0, 0, []
      );
      
      expect(ElectroOpicalSensor).toHaveBeenCalledWith(
        1024, 768, 0, 0, [], 'ZeroFOV Sensor'
      );
    });

    test('should handle very large sensor dimensions', () => {
      universe.addGroundElectroOpticalObservatory(
        'HugeSensor', 40.0, -120.0, 1000, 'azEl',
        16384, 16384, 5.0, 5.0, []
      );
      
      expect(ElectroOpicalSensor).toHaveBeenCalledWith(
        16384, 16384, 5.0, 5.0, [], 'HugeSensor Sensor'
      );
    });
  });

  describe('update', () => {
    let trackableObject1;
    let trackableObject2;
    let nonTrackableObject1;
    let observatory1;
    let observatory2;

    beforeEach(() => {
      // Create mock objects
      trackableObject1 = { name: 'Trackable1', update: jest.fn() };
      trackableObject2 = { name: 'Trackable2', update: jest.fn() };
      nonTrackableObject1 = { name: 'NonTrackable1', update: jest.fn() };
      
      observatory1 = {
        site: { update: jest.fn() },
        gimbal: { update: jest.fn() },
        sensor: { update: jest.fn() }
      };
      
      observatory2 = {
        site: { update: jest.fn() },
        gimbal: { update: jest.fn() },
        sensor: { update: jest.fn() }
      };
      
      // Add objects to universe
      universe.addObject(trackableObject1, true);
      universe.addObject(trackableObject2, true);
      universe.addObject(nonTrackableObject1, false);
      universe._observatories.push(observatory1, observatory2);
    });

    test('should update all objects with default forceUpdate', () => {
      universe.update(mockTime);
      
      // Verify Earth and Sun are updated
      expect(mockEarth.update).toHaveBeenCalledWith(mockTime, universe, false);
      expect(mockSun.update).toHaveBeenCalledWith(mockTime, universe, false);
      
      // Verify trackable objects are updated
      expect(trackableObject1.update).toHaveBeenCalledWith(mockTime, universe, false);
      expect(trackableObject2.update).toHaveBeenCalledWith(mockTime, universe, false);
      
      // Verify non-trackable objects are updated
      expect(nonTrackableObject1.update).toHaveBeenCalledWith(mockTime, universe, false);
      
      // Verify observatory components are updated
      expect(observatory1.site.update).toHaveBeenCalledWith(mockTime, universe, false);
      expect(observatory1.gimbal.update).toHaveBeenCalledWith(mockTime, universe, false);
      expect(observatory1.sensor.update).toHaveBeenCalledWith(mockTime, universe, false);
      expect(observatory2.site.update).toHaveBeenCalledWith(mockTime, universe, false);
      expect(observatory2.gimbal.update).toHaveBeenCalledWith(mockTime, universe, false);
      expect(observatory2.sensor.update).toHaveBeenCalledWith(mockTime, universe, false);
    });

    test('should update all objects with forceUpdate=true', () => {
      universe.update(mockTime, true);
      
      // Verify Earth and Sun are updated with forceUpdate
      expect(mockEarth.update).toHaveBeenCalledWith(mockTime, universe, true);
      expect(mockSun.update).toHaveBeenCalledWith(mockTime, universe, true);
      
      // Verify trackable objects are updated with forceUpdate
      expect(trackableObject1.update).toHaveBeenCalledWith(mockTime, universe, true);
      expect(trackableObject2.update).toHaveBeenCalledWith(mockTime, universe, true);
      
      // Verify non-trackable objects are updated with forceUpdate
      expect(nonTrackableObject1.update).toHaveBeenCalledWith(mockTime, universe, true);
      
      // Verify observatory components are updated with forceUpdate
      expect(observatory1.site.update).toHaveBeenCalledWith(mockTime, universe, true);
      expect(observatory1.gimbal.update).toHaveBeenCalledWith(mockTime, universe, true);
      expect(observatory1.sensor.update).toHaveBeenCalledWith(mockTime, universe, true);
    });

    test('should handle empty collections gracefully', () => {
      // Create a new universe with no added objects
      const emptyUniverse = new Universe();
      
      expect(() => emptyUniverse.update(mockTime)).not.toThrow();
      
      // Earth and Sun should be updated (they're always present)
      // Note: Earth and Sun are created for every new Universe instance
      expect(mockEarth.update).toHaveBeenCalledWith(mockTime, emptyUniverse, false);
      expect(mockSun.update).toHaveBeenCalledWith(mockTime, emptyUniverse, false);
    });

    test('should handle objects throwing errors during update', () => {
      const errorObject = { 
        name: 'ErrorObject', 
        update: jest.fn(() => { throw new Error('Update failed'); })
      };
      universe.addObject(errorObject);
      
      // The error should propagate, but other objects should still be processed
      expect(() => universe.update(mockTime)).toThrow('Update failed');
    });

    test('should handle different time types', () => {
      const differentTimes = [
        new JulianDate(),
        JulianDate.addDays(new JulianDate(), 1, new JulianDate()),
        JulianDate.addSeconds(new JulianDate(), 3600, new JulianDate())
      ];
      
      differentTimes.forEach(time => {
        jest.clearAllMocks(); // Clear previous calls
        universe.update(time);
        
        expect(mockEarth.update).toHaveBeenCalledWith(time, universe, false);
        expect(mockSun.update).toHaveBeenCalledWith(time, universe, false);
      });
    });

    test('should maintain update order (Earth, Sun, trackables, non-trackables, observatories)', () => {
      const updateOrder = [];
      
      // Mock update functions to record call order
      mockEarth.update.mockImplementation(() => updateOrder.push('Earth'));
      mockSun.update.mockImplementation(() => updateOrder.push('Sun'));
      trackableObject1.update.mockImplementation(() => updateOrder.push('Trackable1'));
      trackableObject2.update.mockImplementation(() => updateOrder.push('Trackable2'));
      nonTrackableObject1.update.mockImplementation(() => updateOrder.push('NonTrackable1'));
      observatory1.site.update.mockImplementation(() => updateOrder.push('Obs1Site'));
      observatory1.gimbal.update.mockImplementation(() => updateOrder.push('Obs1Gimbal'));
      observatory1.sensor.update.mockImplementation(() => updateOrder.push('Obs1Sensor'));
      
      universe.update(mockTime);
      
      expect(updateOrder[0]).toBe('Earth');
      expect(updateOrder[1]).toBe('Sun');
      expect(updateOrder.slice(2, 4)).toContain('Trackable1');
      expect(updateOrder.slice(2, 4)).toContain('Trackable2');
      expect(updateOrder[4]).toBe('NonTrackable1');
      expect(updateOrder.slice(5)).toContain('Obs1Site');
      expect(updateOrder.slice(5)).toContain('Obs1Gimbal');
      expect(updateOrder.slice(5)).toContain('Obs1Sensor');
    });

    test('should handle multiple update calls', () => {
      universe.update(mockTime);
      universe.update(mockTime, true);
      universe.update(JulianDate.addDays(mockTime, 1, new JulianDate()));
      
      expect(mockEarth.update).toHaveBeenCalledTimes(3);
      expect(mockSun.update).toHaveBeenCalledTimes(3);
      expect(trackableObject1.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('property getters', () => {
    test('should return Earth object', () => {
      expect(universe.earth).toBe(mockEarth);
    });

    test('should return Sun object', () => {
      expect(universe.sun).toBe(mockSun);
    });

    test('should return objects collection', () => {
      const testObj = { name: 'TestObj', update: jest.fn() };
      universe.addObject(testObj);
      
      const objects = universe.objects;
      expect(objects).toEqual(universe._objects);
      expect(objects['TestObj']).toBe(testObj);
    });

    test('should return trackables array', () => {
      const testObj = { name: 'TestObj', update: jest.fn() };
      universe.addObject(testObj, true);
      
      const trackables = universe.trackables;
      expect(trackables).toBe(universe._trackables);
      expect(trackables).toContain(testObj);
    });

    test('should return gimbals array', () => {
      const gimbals = universe.gimbals;
      expect(gimbals).toBe(universe._gimbals);
      expect(Array.isArray(gimbals)).toBe(true);
    });

    test('should return sensors array', () => {
      const sensors = universe.sensors;
      expect(sensors).toBe(universe._sensors);
      expect(Array.isArray(sensors)).toBe(true);
    });

    test('should maintain reference integrity for collections', () => {
      const objects1 = universe.objects;
      const objects2 = universe.objects;
      const trackables1 = universe.trackables;
      const trackables2 = universe.trackables;
      
      expect(objects1).toBe(objects2);
      expect(trackables1).toBe(trackables2);
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle null and undefined names in object operations', () => {
      const nullNameObj = { name: null, update: jest.fn() };
      const undefinedNameObj = { name: undefined, update: jest.fn() };
      
      universe.addObject(nullNameObj);
      universe.addObject(undefinedNameObj);
      
      expect(universe.objects[null]).toBe(nullNameObj);
      expect(universe.objects[undefined]).toBe(undefinedNameObj);
      expect(universe.hasObject(null)).toBe(true);
      expect(universe.hasObject(undefined)).toBe(true);
    });

    test('should handle objects without update method', () => {
      const noUpdateObj = { name: 'NoUpdate' };
      universe.addObject(noUpdateObj);
      
      expect(() => universe.update(mockTime)).toThrow();
    });

    test('should handle very large numbers of objects', () => {
      const objects = [];
      for (let i = 0; i < 1000; i++) {
        const obj = { name: `Object${i}`, update: jest.fn() };
        objects.push(obj);
        universe.addObject(obj, i % 2 === 0); // Alternate trackable/non-trackable
      }
      
      expect(universe.trackables).toHaveLength(500);
      expect(universe._nontrackables).toHaveLength(500);
      
      // Should update all objects without performance issues
      const startTime = Date.now();
      universe.update(mockTime);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      
      objects.forEach(obj => {
        expect(obj.update).toHaveBeenCalledWith(mockTime, universe, false);
      });
    });

    test('should handle duplicate object additions correctly', () => {
      const obj1 = { name: 'Duplicate', update: jest.fn(), id: 1 };
      const obj2 = { name: 'Duplicate', update: jest.fn(), id: 2 };
      
      universe.addObject(obj1);
      expect(universe.getObject('Duplicate')).toBe(obj1);
      
      universe.addObject(obj2); // Should warn and replace
      expect(console.warn).toHaveBeenCalled();
      expect(universe.getObject('Duplicate')).toBe(obj2);
      
      // Both should be in trackables (addObject adds to arrays even if name exists)
      expect(universe.trackables).toContain(obj1);
      expect(universe.trackables).toContain(obj2);
    });

    test('should handle removal of objects not in any array', () => {
      const outsideObj = { name: 'Outside', update: jest.fn() };
      universe._objects['Outside'] = outsideObj; // Add to objects but not arrays
      
      expect(() => universe.removeObject(outsideObj)).not.toThrow();
      expect(universe.hasObject('Outside')).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete satellite tracking scenario', () => {
      // Add ground station
      const station = universe.addGroundSite('TestStation', 40.7, -74.0, 100);
      
      // Add satellite
      const line1 = '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990';
      const line2 = '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891';
      const satellite = universe.addSGP4Satellite('ISS', line1, line2, 'nadir');
      
      // Add observatory
      const observatory = universe.addGroundElectroOpticalObservatory(
        'TestObs', 40.7, -74.0, 100, 'azEl',
        1024, 768, 1.0, 1.5, []
      );
      
      // Update universe
      universe.update(mockTime);
      
      // Verify objects were created
      // Note: Observatory method overwrites objects[name] with site, so TestObs points to site
      expect(universe.hasObject('ISS')).toBe(true);
      expect(universe.hasObject('TestObs')).toBe(true); // This is the site
      expect(universe.hasObject('TestObs Gimbal')).toBe(true);
      expect(universe.hasObject('TestObs Sensor')).toBe(true);
      expect(universe.gimbals).toHaveLength(1);
      expect(universe.sensors).toHaveLength(1);
      expect(universe._observatories).toHaveLength(1);
    });

    test('should handle mixed object types and trackability', () => {
      // Add various objects with different trackability
      const groundSite = universe.addGroundSite('Site', 0, 0, 0, false);
      const trackableSite = universe.addGroundSite('TrackableSite', 0, 0, 0, true);
      
      const line1 = '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990';
      const line2 = '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891';
      const satellite = universe.addSGP4Satellite('Sat', line1, line2, 'nadir', false, true);
      const nonTrackableSat = universe.addSGP4Satellite('NonTrackSat', line1, line2, 'nadir', false, false);
      
      const r0 = new Cartesian3(7000000, 0, 0);
      const v0 = new Cartesian3(0, 7500, 0);
      const t0 = new JulianDate();
      const twoBody = universe.addTwoBodySatellite('TwoBody', r0, v0, t0, 'nadir', false, true);
      
      // Verify correct categorization 
      // trackableSite, satellite (Sat), twoBody should be trackable = 3 items
      expect(universe.trackables).toHaveLength(3); 
      // groundSite, nonTrackableSat should be non-trackable = 2 items
      expect(universe._nontrackables).toHaveLength(2); 
      
      // Update should handle all types
      universe.update(mockTime);
      
      // All mock objects should have been updated
      expect(mockEarth.update).toHaveBeenCalled();
      expect(mockSun.update).toHaveBeenCalled();
    });

    test('should handle dynamic object addition and removal during updates', () => {
      const initialObj = { name: 'Initial', update: jest.fn() };
      universe.addObject(initialObj);
      
      // Track the dynamically added object outside the closure
      let addedObj = null;
      
      // Add object that adds another object during its update (only once)
      const dynamicAdder = {
        name: 'DynamicAdder',
        hasAdded: false,
        update: jest.fn().mockImplementation(function() {
          if (!this.hasAdded) {
            addedObj = { name: 'AddedDuringUpdate', update: jest.fn() };
            universe.addObject(addedObj);
            this.hasAdded = true;
          }
        })
      };
      universe.addObject(dynamicAdder);
      
      // Initial update - should add the new object
      universe.update(mockTime);
      
      expect(universe.hasObject('AddedDuringUpdate')).toBe(true);
      expect(dynamicAdder.update).toHaveBeenCalled();
      expect(addedObj).not.toBeNull();
      
      // Subsequent update should include the dynamically added object
      universe.update(JulianDate.addDays(mockTime, 1, new JulianDate()));
      
      // The dynamically added object should now be updated
      expect(addedObj.update).toHaveBeenCalled();
    });
  });
});
