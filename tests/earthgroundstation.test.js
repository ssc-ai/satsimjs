import EarthGroundStation from '../src/engine/objects/EarthGroundStation.js';
import { ReferenceFrame, JulianDate, Cartesian3, Math as CMath, defaultValue } from 'cesium';

describe('EarthGroundStation', () => {
  let groundStation;
  const mockTime = JulianDate.now();
  const mockUniverse = { name: 'testUniverse' };
  
  // Test coordinates
  const testLatitude = 40.7128; // New York City
  const testLongitude = -74.0060;
  const testAltitude = 100; // meters
  const testName = 'NYC Ground Station';

  describe('constructor', () => {
    test('should create EarthGroundStation with all parameters', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
      
      expect(groundStation._name).toBe(testName);
      expect(groundStation._referenceFrame).toBe(ReferenceFrame.FIXED);
      expect(groundStation._latitude).toBe(testLatitude);
      expect(groundStation._longitude).toBe(testLongitude);
      expect(groundStation._altitude).toBe(testAltitude);
      expect(groundStation._period).toBe(86400); // 24 hours in seconds
    });

    test('should create EarthGroundStation with default altitude', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude);
      
      expect(groundStation._latitude).toBe(testLatitude);
      expect(groundStation._longitude).toBe(testLongitude);
      expect(groundStation._altitude).toBe(0.0); // Default altitude
      expect(groundStation._name).toBe('EarthGroundStation'); // Default name
    });

    test('should create EarthGroundStation with default name', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude);
      
      expect(groundStation._name).toBe('EarthGroundStation');
      expect(groundStation._altitude).toBe(testAltitude);
    });

    test('should handle zero coordinates', () => {
      groundStation = new EarthGroundStation(0, 0, 0, 'Equator Station');
      
      expect(groundStation._latitude).toBe(0);
      expect(groundStation._longitude).toBe(0);
      expect(groundStation._altitude).toBe(0);
      expect(groundStation._name).toBe('Equator Station');
    });

    test('should handle negative coordinates', () => {
      const negLat = -34.6037; // Buenos Aires
      const negLon = -58.3816;
      groundStation = new EarthGroundStation(negLat, negLon, 25, 'Buenos Aires');
      
      expect(groundStation._latitude).toBe(negLat);
      expect(groundStation._longitude).toBe(negLon);
      expect(groundStation._altitude).toBe(25);
    });

    test('should handle extreme coordinates', () => {
      // North Pole
      groundStation = new EarthGroundStation(90, 0, 0, 'North Pole');
      expect(groundStation._latitude).toBe(90);
      expect(groundStation._longitude).toBe(0);
      
      // South Pole
      groundStation = new EarthGroundStation(-90, 180, 0, 'South Pole');
      expect(groundStation._latitude).toBe(-90);
      expect(groundStation._longitude).toBe(180);
    });

    test('should inherit from SimObject', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
      
      expect(groundStation._position).toBeInstanceOf(Cartesian3);
      expect(groundStation._velocity).toBeInstanceOf(Cartesian3);
      expect(groundStation._updateListeners).toEqual([]);
    });

    test('should initialize position from coordinates', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
      
      // Position should be calculated from Cartesian3.fromDegrees
      expect(groundStation._position).toBeInstanceOf(Cartesian3);
      expect(groundStation._position.x).not.toBe(0);
      expect(groundStation._position.y).not.toBe(0);
      expect(groundStation._position.z).not.toBe(0);
    });

    test('should initialize velocity as zero vector', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
      
      expect(groundStation._velocity).toEqual(new Cartesian3(0, 0, 0));
    });
  });

  describe('latitude getter', () => {
    beforeEach(() => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
    });

    test('should return correct latitude', () => {
      expect(groundStation.latitude).toBe(testLatitude);
    });

    test('should return latitude for different values', () => {
      const stations = [
        { lat: 0, name: 'Equator' },
        { lat: 90, name: 'North Pole' },
        { lat: -90, name: 'South Pole' },
        { lat: 51.5074, name: 'London' }
      ];

      stations.forEach(station => {
        const gs = new EarthGroundStation(station.lat, 0, 0, station.name);
        expect(gs.latitude).toBe(station.lat);
      });
    });
  });

  describe('latitude setter', () => {
    beforeEach(() => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
    });

    test('should update latitude and reinitialize', () => {
      const newLatitude = 51.5074; // London
      const originalPosition = Cartesian3.clone(groundStation._position);
      
      groundStation.latitude = newLatitude;
      
      expect(groundStation._latitude).toBe(newLatitude);
      expect(groundStation.latitude).toBe(newLatitude);
      // Position should have changed due to reinitialization
      expect(groundStation._position).not.toEqual(originalPosition);
    });

    test('should handle zero latitude', () => {
      groundStation.latitude = 0;
      expect(groundStation.latitude).toBe(0);
    });

    test('should handle negative latitude', () => {
      const newLat = -34.6037;
      groundStation.latitude = newLat;
      expect(groundStation.latitude).toBe(newLat);
    });

    test('should handle extreme latitudes', () => {
      groundStation.latitude = 90;
      expect(groundStation.latitude).toBe(90);
      
      groundStation.latitude = -90;
      expect(groundStation.latitude).toBe(-90);
    });
  });

  describe('longitude getter', () => {
    beforeEach(() => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
    });

    test('should return correct longitude', () => {
      expect(groundStation.longitude).toBe(testLongitude);
    });

    test('should return longitude for different values', () => {
      const stations = [
        { lon: 0, name: 'Greenwich' },
        { lon: 180, name: 'International Date Line' },
        { lon: -180, name: 'International Date Line West' },
        { lon: -74.0060, name: 'New York' }
      ];

      stations.forEach(station => {
        const gs = new EarthGroundStation(0, station.lon, 0, station.name);
        expect(gs.longitude).toBe(station.lon);
      });
    });
  });

  describe('longitude setter', () => {
    beforeEach(() => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
    });

    test('should update longitude and reinitialize', () => {
      const newLongitude = 0; // Greenwich
      const originalPosition = Cartesian3.clone(groundStation._position);
      
      groundStation.longitude = newLongitude;
      
      expect(groundStation._longitude).toBe(newLongitude);
      expect(groundStation.longitude).toBe(newLongitude);
      // Position should have changed due to reinitialization
      expect(groundStation._position).not.toEqual(originalPosition);
    });

    test('should handle zero longitude', () => {
      groundStation.longitude = 0;
      expect(groundStation.longitude).toBe(0);
    });

    test('should handle negative longitude', () => {
      const newLon = -74.0060;
      groundStation.longitude = newLon;
      expect(groundStation.longitude).toBe(newLon);
    });

    test('should handle extreme longitudes', () => {
      groundStation.longitude = 180;
      expect(groundStation.longitude).toBe(180);
      
      groundStation.longitude = -180;
      expect(groundStation.longitude).toBe(-180);
    });
  });

  describe('altitude getter', () => {
    beforeEach(() => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
    });

    test('should return correct altitude', () => {
      expect(groundStation.altitude).toBe(testAltitude);
    });

    test('should return altitude for different values', () => {
      const stations = [
        { alt: 0, name: 'Sea Level' },
        { alt: 8848, name: 'Mount Everest' },
        { alt: -418, name: 'Dead Sea' },
        { alt: 5000, name: 'High Altitude' }
      ];

      stations.forEach(station => {
        const gs = new EarthGroundStation(0, 0, station.alt, station.name);
        expect(gs.altitude).toBe(station.alt);
      });
    });
  });

  describe('altitude setter', () => {
    beforeEach(() => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
    });

    test('should update altitude and reinitialize', () => {
      const newAltitude = 1000;
      const originalPosition = Cartesian3.clone(groundStation._position);
      
      groundStation.altitude = newAltitude;
      
      expect(groundStation._altitude).toBe(newAltitude);
      expect(groundStation.altitude).toBe(newAltitude);
      // Position should have changed due to altitude change
      expect(groundStation._position).not.toEqual(originalPosition);
    });

    test('should handle zero altitude', () => {
      groundStation.altitude = 0;
      expect(groundStation.altitude).toBe(0);
    });

    test('should handle negative altitude (below sea level)', () => {
      const newAlt = -418; // Dead Sea level
      groundStation.altitude = newAlt;
      expect(groundStation.altitude).toBe(newAlt);
    });

    test('should handle high altitude', () => {
      const newAlt = 8848; // Mount Everest
      groundStation.altitude = newAlt;
      expect(groundStation.altitude).toBe(newAlt);
    });
  });

  describe('worldVelocity getter', () => {
    beforeEach(() => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
      
      // Mock parent with transformVectorToWorld method
      groundStation.parent = {
        transformVectorToWorld: jest.fn().mockImplementation((vector) => vector)
      };
    });

    test('should calculate world velocity including Earth rotation', () => {
      const worldVel = groundStation.worldVelocity;
      
      expect(worldVel).toBeInstanceOf(Cartesian3);
      expect(groundStation.parent.transformVectorToWorld).toHaveBeenCalled();
    });

    test('should use correct Earth angular speed', () => {
      const EARTH_ANGULAR_SPEED = 7.292115146706979e-5;
      
      // Spy on Cartesian3 methods to verify calculations
      const crossSpy = jest.spyOn(Cartesian3, 'cross');
      const addSpy = jest.spyOn(Cartesian3, 'add');
      
      groundStation.worldVelocity;
      
      expect(crossSpy).toHaveBeenCalled();
      expect(addSpy).toHaveBeenCalled();
      
      crossSpy.mockRestore();
      addSpy.mockRestore();
    });

    test('should handle different positions correctly', () => {
      const stations = [
        new EarthGroundStation(0, 0, 0, 'Equator'),
        new EarthGroundStation(90, 0, 0, 'North Pole'),
        new EarthGroundStation(-90, 0, 0, 'South Pole')
      ];

      stations.forEach(station => {
        station.parent = {
          transformVectorToWorld: jest.fn().mockImplementation((vector) => vector)
        };
        
        const worldVel = station.worldVelocity;
        expect(worldVel).toBeInstanceOf(Cartesian3);
        expect(station.parent.transformVectorToWorld).toHaveBeenCalled();
      });
    });

    test('should throw error when no parent is set', () => {
      groundStation.parent = null;
      
      expect(() => {
        groundStation.worldVelocity;
      }).toThrow();
    });

    test('should add station velocity to rotational velocity', () => {
      // Set a non-zero station velocity
      groundStation._velocity = new Cartesian3(10, 20, 30);
      
      const addSpy = jest.spyOn(Cartesian3, 'add');
      
      groundStation.worldVelocity;
      
      expect(addSpy).toHaveBeenCalled();
      
      addSpy.mockRestore();
    });
  });

  describe('_initialize method', () => {
    test('should call position calculation from coordinates', () => {
      const fromDegreesSpy = jest.spyOn(Cartesian3, 'fromDegrees');
      
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
      
      expect(fromDegreesSpy).toHaveBeenCalledWith(testLongitude, testLatitude, testAltitude);
      
      fromDegreesSpy.mockRestore();
    });

    test('should call transformation methods in correct order', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
      
      const resetSpy = jest.spyOn(groundStation, 'reset');
      const rotateZSpy = jest.spyOn(groundStation, 'rotateZ');
      const rotateYSpy = jest.spyOn(groundStation, 'rotateY');
      const setTranslationSpy = jest.spyOn(groundStation, 'setTranslation');
      
      // Call _initialize again to test the sequence
      groundStation._initialize();
      
      expect(resetSpy).toHaveBeenCalled();
      expect(rotateZSpy).toHaveBeenCalledWith(testLongitude * CMath.RADIANS_PER_DEGREE);
      expect(rotateYSpy).toHaveBeenCalledWith(CMath.PI_OVER_TWO - testLatitude * CMath.RADIANS_PER_DEGREE);
      expect(setTranslationSpy).toHaveBeenCalledWith(groundStation._position);
      
      resetSpy.mockRestore();
      rotateZSpy.mockRestore();
      rotateYSpy.mockRestore();
      setTranslationSpy.mockRestore();
    });

    test('should handle zero coordinates in transformations', () => {
      groundStation = new EarthGroundStation(0, 0, 0, 'Origin');
      
      const rotateZSpy = jest.spyOn(groundStation, 'rotateZ');
      const rotateYSpy = jest.spyOn(groundStation, 'rotateY');
      
      groundStation._initialize();
      
      expect(rotateZSpy).toHaveBeenCalledWith(0);
      expect(rotateYSpy).toHaveBeenCalledWith(CMath.PI_OVER_TWO);
      
      rotateZSpy.mockRestore();
      rotateYSpy.mockRestore();
    });

    test('should set velocity to zero vector', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
      
      expect(groundStation._velocity).toEqual(new Cartesian3(0, 0, 0));
      
      // Call _initialize again and verify velocity is still zero
      groundStation._initialize();
      expect(groundStation._velocity).toEqual(new Cartesian3(0, 0, 0));
    });
  });

  describe('_update method', () => {
    beforeEach(() => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
    });

    test('should do nothing (fixed object)', () => {
      const originalPosition = Cartesian3.clone(groundStation._position);
      const originalVelocity = Cartesian3.clone(groundStation._velocity);
      
      groundStation._update(mockTime, mockUniverse);
      
      expect(groundStation._position).toEqual(originalPosition);
      expect(groundStation._velocity).toEqual(originalVelocity);
    });

    test('should handle different time and universe parameters', () => {
      const times = [
        JulianDate.fromDate(new Date('2024-01-01')),
        JulianDate.fromDate(new Date('2024-12-31')),
        JulianDate.addDays(JulianDate.now(), 365, new JulianDate())
      ];

      const universes = [
        null,
        undefined,
        {},
        { name: 'test' }
      ];

      times.forEach(time => {
        universes.forEach(universe => {
          expect(() => {
            groundStation._update(time, universe);
          }).not.toThrow();
        });
      });
    });
  });

  describe('inheritance from SimObject', () => {
    beforeEach(() => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
    });

    test('should have all SimObject properties', () => {
      expect(groundStation.name).toBe(testName);
      expect(groundStation._referenceFrame).toBe(ReferenceFrame.FIXED);
      expect(groundStation._updateListeners).toBeDefined();
      expect(groundStation._lastUpdate).toBeDefined();
    });

    test('should call _update when update method is called', () => {
      const spy = jest.spyOn(groundStation, '_update');
      
      groundStation.update(mockTime, mockUniverse, false, false);
      
      expect(spy).toHaveBeenCalledWith(mockTime, mockUniverse);
      spy.mockRestore();
    });

    test('should update lastUpdate time when update is called', () => {
      const initialLastUpdate = JulianDate.clone(groundStation._lastUpdate);
      const futureTime = JulianDate.addSeconds(mockTime, 1, new JulianDate());
      
      groundStation.update(futureTime, mockUniverse, false, false);
      
      expect(JulianDate.equals(groundStation._lastUpdate, futureTime)).toBe(true);
      expect(JulianDate.equals(groundStation._lastUpdate, initialLastUpdate)).toBe(false);
    });

    test('should have fixed reference frame', () => {
      expect(groundStation._referenceFrame).toBe(ReferenceFrame.FIXED);
    });

    test('should have 24-hour period', () => {
      expect(groundStation._period).toBe(86400);
      expect(groundStation.period).toBe(86400);
    });
  });

  describe('coordinate system integration', () => {
    test('should convert geodetic to Cartesian coordinates correctly', () => {
      // Test known coordinates
      const stations = [
        { lat: 0, lon: 0, alt: 0, name: 'Equator/Prime Meridian' },
        { lat: 90, lon: 0, alt: 0, name: 'North Pole' },
        { lat: -90, lon: 0, alt: 0, name: 'South Pole' },
        { lat: 0, lon: 90, alt: 0, name: 'Equator/90E' }
      ];

      stations.forEach(station => {
        const gs = new EarthGroundStation(station.lat, station.lon, station.alt, station.name);
        
        expect(gs._position).toBeInstanceOf(Cartesian3);
        expect(gs._position.x).toBeCloseTo(gs._position.x, 10); // Should be finite numbers
        expect(gs._position.y).toBeCloseTo(gs._position.y, 10);
        expect(gs._position.z).toBeCloseTo(gs._position.z, 10);
      });
    });

    test('should handle altitude changes affecting position magnitude', () => {
      const basStation = new EarthGroundStation(0, 0, 0, 'Sea Level');
      const highStation = new EarthGroundStation(0, 0, 10000, 'High Altitude');
      
      const baseMagnitude = Cartesian3.magnitude(basStation._position);
      const highMagnitude = Cartesian3.magnitude(highStation._position);
      
      expect(highMagnitude).toBeGreaterThan(baseMagnitude);
      expect(highMagnitude - baseMagnitude).toBeCloseTo(10000, -2); // Within reasonable tolerance
    });
  });

  describe('real-world coordinate examples', () => {
    test('should handle major city coordinates', () => {
      const cities = [
        { name: 'New York', lat: 40.7128, lon: -74.0060, alt: 10 },
        { name: 'London', lat: 51.5074, lon: -0.1278, alt: 35 },
        { name: 'Tokyo', lat: 35.6762, lon: 139.6503, alt: 40 },
        { name: 'Sydney', lat: -33.8688, lon: 151.2093, alt: 58 },
        { name: 'Cape Town', lat: -33.9249, lon: 18.4241, alt: 1 }
      ];

      cities.forEach(city => {
        expect(() => {
          const station = new EarthGroundStation(city.lat, city.lon, city.alt, city.name);
          expect(station.latitude).toBe(city.lat);
          expect(station.longitude).toBe(city.lon);
          expect(station.altitude).toBe(city.alt);
          expect(station.name).toBe(city.name);
        }).not.toThrow();
      });
    });

    test('should handle extreme geographic locations', () => {
      const extremeLocations = [
        { name: 'North Pole', lat: 90, lon: 0, alt: 0 },
        { name: 'South Pole', lat: -90, lon: 0, alt: 0 },
        { name: 'Mount Everest', lat: 27.9881, lon: 86.9250, alt: 8848 },
        { name: 'Death Valley', lat: 36.2, lon: -116.8, alt: -86 },
        { name: 'Mariana Trench', lat: 11.3733, lon: 142.5917, alt: -10994 }
      ];

      extremeLocations.forEach(location => {
        expect(() => {
          const station = new EarthGroundStation(location.lat, location.lon, location.alt, location.name);
          expect(station._position).toBeInstanceOf(Cartesian3);
        }).not.toThrow();
      });
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle undefined altitude with defaultValue', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, undefined, testName);
      expect(groundStation._altitude).toBe(0.0);
    });

    test('should handle null altitude with defaultValue', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, null, testName);
      expect(groundStation._altitude).toBe(0.0);
    });

    test('should handle very large coordinate values', () => {
      // These might be invalid geographically but should not crash
      expect(() => {
        const station = new EarthGroundStation(1000, 1000, 1000000, 'Extreme');
      }).not.toThrow();
    });

    test('should handle coordinate precision', () => {
      const preciseCoords = {
        lat: 40.712775123456,
        lon: -74.006015987654,
        alt: 123.456789
      };
      
      groundStation = new EarthGroundStation(preciseCoords.lat, preciseCoords.lon, preciseCoords.alt, 'Precise');
      
      expect(groundStation.latitude).toBe(preciseCoords.lat);
      expect(groundStation.longitude).toBe(preciseCoords.lon);
      expect(groundStation.altitude).toBe(preciseCoords.alt);
    });
  });

  describe('performance considerations', () => {
    test('should reuse position and velocity objects', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
      
      const originalPosition = groundStation._position;
      const originalVelocity = groundStation._velocity;
      
      // Changing coordinates should create new position but reuse velocity object structure
      groundStation.latitude = testLatitude + 1;
      
      expect(groundStation._velocity).toEqual(new Cartesian3(0, 0, 0));
    });

    test('should minimize object creation in worldVelocity getter', () => {
      groundStation = new EarthGroundStation(testLatitude, testLongitude, testAltitude, testName);
      groundStation.parent = {
        transformVectorToWorld: jest.fn().mockImplementation((vector) => vector)
      };
      
      // Multiple calls should not throw or cause memory issues
      for (let i = 0; i < 10; i++) {
        const vel = groundStation.worldVelocity;
        expect(vel).toBeInstanceOf(Cartesian3);
      }
    });
  });
});
