// Mock the complex dependencies first
jest.mock('cesium', () => ({
  JulianDate: jest.fn(),
  Cartesian3: {
    ZERO: { x: 0, y: 0, z: 0 },
    clone: jest.fn()
  },
  Math: {
    toRadians: jest.fn()
  },
  Matrix3: {
    transpose: jest.fn()
  },
  Matrix4: {
    fromRotation: jest.fn()
  },
  Transforms: {
    computeIcrfToFixedMatrix: jest.fn(),
    computeTemeToPseudoFixedMatrix: jest.fn()
  }
}));

jest.mock('../src/engine/dynamics/gimbal.js', () => ({
  southEastZenithToAzEl: jest.fn()
}));

jest.mock('../src/engine/dynamics/twobody.js', () => ({
  rv2period: jest.fn(),
  rv2ecc: jest.fn()
}));

// Mock the object classes
jest.mock('../src/engine/objects/SimObject.js', () => {
  return jest.fn().mockImplementation((name) => ({
    name: name || 'MockSimObject',
    _referenceFrame: null,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 }
  }));
});

jest.mock('../src/engine/objects/Gimbal.js', () => {
  return jest.fn().mockImplementation((name) => ({
    name: name || 'MockGimbal',
    _trackMode: 'fixed',
    _trackObject: null,
    _range: 1000
  }));
});

jest.mock('../src/engine/objects/ElectroOpticalSensor.js', () => {
  return jest.fn().mockImplementation((height, width, y_fov, x_fov, field_of_regard, name) => ({
    name: name || 'MockSensor',
    height: height,
    width: width,
    y_fov: y_fov,
    x_fov: x_fov,
    field_of_regard: field_of_regard || []
  }));
});

import Observatory from '../src/engine/objects/Observatory.js';
import SimObject from '../src/engine/objects/SimObject.js';
import Gimbal from '../src/engine/objects/Gimbal.js';
import ElectroOpicalSensor from '../src/engine/objects/ElectroOpticalSensor.js';

describe('Observatory', () => {
  let mockSite, mockGimbal, mockSensor;

  beforeEach(() => {
    // Create mock instances
    mockSite = new SimObject('TestSite');
    mockGimbal = new Gimbal('TestGimbal');
    mockSensor = new ElectroOpicalSensor(100, 100, 10, 10, [], 'TestSensor');

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create Observatory with all required parameters', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);

      expect(observatory._site).toBe(mockSite);
      expect(observatory._gimbal).toBe(mockGimbal);
      expect(observatory._sensor).toBe(mockSensor);
    });

    it('should store references to all components correctly', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);

      expect(observatory.site).toBe(mockSite);
      expect(observatory.gimbal).toBe(mockGimbal);
      expect(observatory.sensor).toBe(mockSensor);
    });

    it('should handle different site objects', () => {
      const altSite = new SimObject('AlternateSite');
      const observatory = new Observatory(altSite, mockGimbal, mockSensor);

      expect(observatory.site).toBe(altSite);
      expect(observatory.gimbal).toBe(mockGimbal);
      expect(observatory.sensor).toBe(mockSensor);
    });

    it('should handle different gimbal objects', () => {
      const altGimbal = new Gimbal('AlternateGimbal');
      const observatory = new Observatory(mockSite, altGimbal, mockSensor);

      expect(observatory.site).toBe(mockSite);
      expect(observatory.gimbal).toBe(altGimbal);
      expect(observatory.sensor).toBe(mockSensor);
    });

    it('should handle different sensor objects', () => {
      const altSensor = new ElectroOpicalSensor(200, 200, 20, 20, [], 'AlternateSensor');
      const observatory = new Observatory(mockSite, mockGimbal, altSensor);

      expect(observatory.site).toBe(mockSite);
      expect(observatory.gimbal).toBe(mockGimbal);
      expect(observatory.sensor).toBe(altSensor);
    });
  });

  describe('site getter', () => {
    it('should return the site object', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      expect(observatory.site).toBe(mockSite);
    });

    it('should return different site objects correctly', () => {
      const site1 = new SimObject('Site1');
      const site2 = new SimObject('Site2');
      
      const observatory1 = new Observatory(site1, mockGimbal, mockSensor);
      const observatory2 = new Observatory(site2, mockGimbal, mockSensor);
      
      expect(observatory1.site).toBe(site1);
      expect(observatory2.site).toBe(site2);
    });

    it('should reflect changes made via setter', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      const newSite = new SimObject('NewSite');
      
      observatory.site = newSite;
      
      expect(observatory.site).toBe(newSite);
    });
  });

  describe('site setter', () => {
    it('should set the site object', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      const newSite = new SimObject('NewSite');
      
      observatory.site = newSite;
      
      expect(observatory._site).toBe(newSite);
      expect(observatory.site).toBe(newSite);
    });

    it('should allow setting site to null', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      observatory.site = null;
      
      expect(observatory.site).toBeNull();
    });

    it('should allow setting site to undefined', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      observatory.site = undefined;
      
      expect(observatory.site).toBeUndefined();
    });

    it('should handle multiple site changes', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      const site1 = new SimObject('Site1');
      const site2 = new SimObject('Site2');
      const site3 = new SimObject('Site3');
      
      observatory.site = site1;
      expect(observatory.site).toBe(site1);
      
      observatory.site = site2;
      expect(observatory.site).toBe(site2);
      
      observatory.site = site3;
      expect(observatory.site).toBe(site3);
    });
  });

  describe('gimbal getter', () => {
    it('should return the gimbal object', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      expect(observatory.gimbal).toBe(mockGimbal);
    });

    it('should return different gimbal objects correctly', () => {
      const gimbal1 = new Gimbal('Gimbal1');
      const gimbal2 = new Gimbal('Gimbal2');
      
      const observatory1 = new Observatory(mockSite, gimbal1, mockSensor);
      const observatory2 = new Observatory(mockSite, gimbal2, mockSensor);
      
      expect(observatory1.gimbal).toBe(gimbal1);
      expect(observatory2.gimbal).toBe(gimbal2);
    });

    it('should reflect changes made via setter', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      const newGimbal = new Gimbal('NewGimbal');
      
      observatory.gimbal = newGimbal;
      
      expect(observatory.gimbal).toBe(newGimbal);
    });
  });

  describe('gimbal setter', () => {
    it('should set the gimbal object', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      const newGimbal = new Gimbal('NewGimbal');
      
      observatory.gimbal = newGimbal;
      
      expect(observatory._gimbal).toBe(newGimbal);
      expect(observatory.gimbal).toBe(newGimbal);
    });

    it('should allow setting gimbal to null', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      observatory.gimbal = null;
      
      expect(observatory.gimbal).toBeNull();
    });

    it('should allow setting gimbal to undefined', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      observatory.gimbal = undefined;
      
      expect(observatory.gimbal).toBeUndefined();
    });

    it('should handle multiple gimbal changes', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      const gimbal1 = new Gimbal('Gimbal1');
      const gimbal2 = new Gimbal('Gimbal2');
      const gimbal3 = new Gimbal('Gimbal3');
      
      observatory.gimbal = gimbal1;
      expect(observatory.gimbal).toBe(gimbal1);
      
      observatory.gimbal = gimbal2;
      expect(observatory.gimbal).toBe(gimbal2);
      
      observatory.gimbal = gimbal3;
      expect(observatory.gimbal).toBe(gimbal3);
    });
  });

  describe('sensor getter', () => {
    it('should return the sensor object', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      expect(observatory.sensor).toBe(mockSensor);
    });

    it('should return different sensor objects correctly', () => {
      const sensor1 = new ElectroOpicalSensor(100, 100, 10, 10, [], 'Sensor1');
      const sensor2 = new ElectroOpicalSensor(200, 200, 20, 20, [], 'Sensor2');
      
      const observatory1 = new Observatory(mockSite, mockGimbal, sensor1);
      const observatory2 = new Observatory(mockSite, mockGimbal, sensor2);
      
      expect(observatory1.sensor).toBe(sensor1);
      expect(observatory2.sensor).toBe(sensor2);
    });

    it('should reflect changes made via setter', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      const newSensor = new ElectroOpicalSensor(300, 300, 30, 30, [], 'NewSensor');
      
      observatory.sensor = newSensor;
      
      expect(observatory.sensor).toBe(newSensor);
    });
  });

  describe('sensor setter', () => {
    it('should set the sensor object', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      const newSensor = new ElectroOpicalSensor(300, 300, 30, 30, [], 'NewSensor');
      
      observatory.sensor = newSensor;
      
      expect(observatory._sensor).toBe(newSensor);
      expect(observatory.sensor).toBe(newSensor);
    });

    it('should allow setting sensor to null', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      observatory.sensor = null;
      
      expect(observatory.sensor).toBeNull();
    });

    it('should allow setting sensor to undefined', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      observatory.sensor = undefined;
      
      expect(observatory.sensor).toBeUndefined();
    });

    it('should handle multiple sensor changes', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      const sensor1 = new ElectroOpicalSensor(100, 100, 10, 10, [], 'Sensor1');
      const sensor2 = new ElectroOpicalSensor(200, 200, 20, 20, [], 'Sensor2');
      const sensor3 = new ElectroOpicalSensor(300, 300, 30, 30, [], 'Sensor3');
      
      observatory.sensor = sensor1;
      expect(observatory.sensor).toBe(sensor1);
      
      observatory.sensor = sensor2;
      expect(observatory.sensor).toBe(sensor2);
      
      observatory.sensor = sensor3;
      expect(observatory.sensor).toBe(sensor3);
    });
  });

  describe('component composition behavior', () => {
    it('should maintain independent references to all components', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      // Verify components are independently accessible
      expect(observatory.site).toBe(mockSite);
      expect(observatory.gimbal).toBe(mockGimbal);
      expect(observatory.sensor).toBe(mockSensor);
      
      // Verify they're different objects
      expect(observatory.site).not.toBe(observatory.gimbal);
      expect(observatory.site).not.toBe(observatory.sensor);
      expect(observatory.gimbal).not.toBe(observatory.sensor);
    });

    it('should allow independent modification of components', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      const newSite = new SimObject('NewSite');
      const newGimbal = new Gimbal('NewGimbal');
      const newSensor = new ElectroOpicalSensor(400, 400, 40, 40, [], 'NewSensor');
      
      // Change each component independently
      observatory.site = newSite;
      expect(observatory.site).toBe(newSite);
      expect(observatory.gimbal).toBe(mockGimbal); // unchanged
      expect(observatory.sensor).toBe(mockSensor); // unchanged
      
      observatory.gimbal = newGimbal;
      expect(observatory.site).toBe(newSite); // unchanged
      expect(observatory.gimbal).toBe(newGimbal);
      expect(observatory.sensor).toBe(mockSensor); // unchanged
      
      observatory.sensor = newSensor;
      expect(observatory.site).toBe(newSite); // unchanged
      expect(observatory.gimbal).toBe(newGimbal); // unchanged
      expect(observatory.sensor).toBe(newSensor);
    });

    it('should handle all components being null', () => {
      const observatory = new Observatory(null, null, null);
      
      expect(observatory.site).toBeNull();
      expect(observatory.gimbal).toBeNull();
      expect(observatory.sensor).toBeNull();
    });

    it('should handle all components being undefined', () => {
      const observatory = new Observatory(undefined, undefined, undefined);
      
      expect(observatory.site).toBeUndefined();
      expect(observatory.gimbal).toBeUndefined();
      expect(observatory.sensor).toBeUndefined();
    });
  });

  describe('edge cases and integration scenarios', () => {
    it('should handle mixed null and valid components', () => {
      const observatory = new Observatory(mockSite, null, mockSensor);
      
      expect(observatory.site).toBe(mockSite);
      expect(observatory.gimbal).toBeNull();
      expect(observatory.sensor).toBe(mockSensor);
    });

    it('should handle mixed undefined and valid components', () => {
      const observatory = new Observatory(undefined, mockGimbal, undefined);
      
      expect(observatory.site).toBeUndefined();
      expect(observatory.gimbal).toBe(mockGimbal);
      expect(observatory.sensor).toBeUndefined();
    });

    it('should maintain state consistency across getter/setter operations', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      // Perform multiple operations and verify consistency
      for (let i = 0; i < 5; i++) {
        const testSite = new SimObject(`Site${i}`);
        const testGimbal = new Gimbal(`Gimbal${i}`);
        const testSensor = new ElectroOpicalSensor(i*100, i*100, i*10, i*10, [], `Sensor${i}`);
        
        observatory.site = testSite;
        observatory.gimbal = testGimbal;
        observatory.sensor = testSensor;
        
        expect(observatory.site).toBe(testSite);
        expect(observatory.gimbal).toBe(testGimbal);
        expect(observatory.sensor).toBe(testSensor);
      }
    });

    it('should handle rapid component swapping', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      // Create arrays of test components
      const sites = Array.from({length: 3}, (_, i) => new SimObject(`Site${i}`));
      const gimbals = Array.from({length: 3}, (_, i) => new Gimbal(`Gimbal${i}`));
      const sensors = Array.from({length: 3}, (_, i) => 
        new ElectroOpicalSensor(i*100+100, i*100+100, i*10+10, i*10+10, [], `Sensor${i}`)
      );
      
      // Rapidly swap components
      for (let i = 0; i < 10; i++) {
        const siteIdx = i % sites.length;
        const gimbalIdx = i % gimbals.length;
        const sensorIdx = i % sensors.length;
        
        observatory.site = sites[siteIdx];
        observatory.gimbal = gimbals[gimbalIdx];
        observatory.sensor = sensors[sensorIdx];
        
        expect(observatory.site).toBe(sites[siteIdx]);
        expect(observatory.gimbal).toBe(gimbals[gimbalIdx]);
        expect(observatory.sensor).toBe(sensors[sensorIdx]);
      }
    });
  });

  describe('property integrity and data structure validation', () => {
    it('should maintain private property consistency with public getters', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      expect(observatory._site).toBe(observatory.site);
      expect(observatory._gimbal).toBe(observatory.gimbal);
      expect(observatory._sensor).toBe(observatory.sensor);
      
      // Change via setters and verify private properties
      const newSite = new SimObject('New');
      const newGimbal = new Gimbal('New');
      const newSensor = new ElectroOpicalSensor(50, 50, 5, 5, [], 'New');
      
      observatory.site = newSite;
      observatory.gimbal = newGimbal;
      observatory.sensor = newSensor;
      
      expect(observatory._site).toBe(newSite);
      expect(observatory._gimbal).toBe(newGimbal);
      expect(observatory._sensor).toBe(newSensor);
    });

    it('should preserve object references without cloning', () => {
      const observatory = new Observatory(mockSite, mockGimbal, mockSensor);
      
      // Verify that getter returns the exact same object reference
      expect(observatory.site).toBe(mockSite);
      expect(observatory.gimbal).toBe(mockGimbal);
      expect(observatory.sensor).toBe(mockSensor);
      
      // Verify that the reference is maintained, not copied
      expect(observatory.site === mockSite).toBe(true);
      expect(observatory.gimbal === mockGimbal).toBe(true);
      expect(observatory.sensor === mockSensor).toBe(true);
    });

    it('should handle object property mutations correctly', () => {
      const mutableSite = new SimObject('MutableSite');
      const observatory = new Observatory(mutableSite, mockGimbal, mockSensor);
      
      // The observatory should reflect changes to the object it holds
      expect(observatory.site).toBe(mutableSite);
      
      // If we modify the site object itself, observatory should see the changes
      // (since it holds a reference, not a copy)
      expect(observatory.site === mutableSite).toBe(true);
    });
  });
});
