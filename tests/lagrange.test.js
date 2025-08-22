import { JulianDate, LagrangePolynomialApproximation, Cartesian3 } from 'cesium';
import { lagrange_fast, lagrange, initialize } from '../src/engine/dynamics/lagrange.js';

// Mock Cesium
jest.mock('cesium', () => ({
  JulianDate: {
    secondsDifference: jest.fn((time, epoch) => {
      // Mock implementation - return difference in seconds
      return 1000; // Default mock value
    }),
    clone: jest.fn((date, result) => {
      if (result) {
        result.dayNumber = date.dayNumber;
        result.secondsOfDay = date.secondsOfDay;
        return result;
      }
      return { dayNumber: date.dayNumber, secondsOfDay: date.secondsOfDay };
    }),
    addSeconds: jest.fn((date, seconds, result) => {
      if (result) {
        result.dayNumber = date.dayNumber;
        result.secondsOfDay = date.secondsOfDay + seconds;
        return result;
      }
      return { dayNumber: date.dayNumber, secondsOfDay: date.secondsOfDay + seconds };
    })
  },
  LagrangePolynomialApproximation: {
    interpolateOrderZero: jest.fn((t, times, positions, stride, result) => {
      // Mock implementation that fills result array
      result[0] = 1.0; // x
      result[1] = 2.0; // y
      result[2] = 3.0; // z
      return result;
    })
  },
  Cartesian3: {
    fromArray: jest.fn((array, startIndex, result) => {
      if (result) {
        result.x = array[startIndex];
        result.y = array[startIndex + 1];
        result.z = array[startIndex + 2];
        return result;
      }
      return { x: array[startIndex], y: array[startIndex + 1], z: array[startIndex + 2] };
    })
  }
}));

describe('Lagrange Interpolation Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('lagrange_fast', () => {
    test('should interpolate position at given time', () => {
      const times = [0, 100, 200, 300];
      const positions = [
        1, 2, 3,    // t=0
        4, 5, 6,    // t=100
        7, 8, 9,    // t=200
        10, 11, 12  // t=300
      ];
      const t = 150; // Interpolate at t=150
      const result = { x: 0, y: 0, z: 0 };

      const returnValue = lagrange_fast(times, positions, t, result);

      expect(LagrangePolynomialApproximation.interpolateOrderZero).toHaveBeenCalledWith(
        t, times, positions, 3, expect.any(Array)
      );
      expect(Cartesian3.fromArray).toHaveBeenCalledWith(
        expect.any(Array), 0, result
      );
      expect(returnValue).toBe(result);
    });

    test('should handle empty result parameter', () => {
      const times = [0, 100];
      const positions = [1, 2, 3, 4, 5, 6];
      const t = 50;

      const returnValue = lagrange_fast(times, positions, t);

      expect(LagrangePolynomialApproximation.interpolateOrderZero).toHaveBeenCalled();
      expect(Cartesian3.fromArray).toHaveBeenCalledWith(
        expect.any(Array), 0, undefined
      );
    });

    test('should handle single time point', () => {
      const times = [0];
      const positions = [1, 2, 3];
      const t = 0;
      const result = { x: 0, y: 0, z: 0 };

      lagrange_fast(times, positions, t, result);

      expect(LagrangePolynomialApproximation.interpolateOrderZero).toHaveBeenCalledWith(
        t, times, positions, 3, expect.any(Array)
      );
    });

    test('should handle large position arrays', () => {
      const times = [0, 1, 2, 3, 4, 5];
      const positions = new Array(18).fill(0).map((_, i) => i + 1); // 6 points * 3 components
      const t = 2.5;
      const result = { x: 0, y: 0, z: 0 };

      lagrange_fast(times, positions, t, result);

      expect(LagrangePolynomialApproximation.interpolateOrderZero).toHaveBeenCalledWith(
        t, times, positions, 3, expect.any(Array)
      );
    });

    test('should clear internal array on each call', () => {
      const times = [0, 100];
      const positions = [1, 2, 3, 4, 5, 6];
      const t1 = 50;
      const t2 = 75;

      lagrange_fast(times, positions, t1);
      lagrange_fast(times, positions, t2);

      expect(LagrangePolynomialApproximation.interpolateOrderZero).toHaveBeenCalledTimes(2);
    });
  });

  describe('lagrange', () => {
    test('should use existing data when within time range', () => {
      const times = [0, 180, 360, 540, 720, 900, 1080]; // 7 points, 180s interval
      const positions = new Array(21).fill(0).map((_, i) => i); // 7 points * 3 components
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn();
      const result = { x: 0, y: 0, z: 0 };

      // Mock delta to be within range
      JulianDate.secondsDifference.mockReturnValue(500); // Within [0, 1080]

      const returnValue = lagrange(times, positions, epoch, time, update, result);

      expect(JulianDate.secondsDifference).toHaveBeenCalledWith(time, epoch);
      expect(update).not.toHaveBeenCalled(); // Should not reinitialize
      expect(LagrangePolynomialApproximation.interpolateOrderZero).toHaveBeenCalledWith(
        500, times, positions, 3, expect.any(Array)
      );
      expect(returnValue).toBe(result);
    });

    test('should reinitialize when insufficient points', () => {
      const times = [0, 180]; // Less than 7 points
      const positions = [1, 2, 3, 4, 5, 6];
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn(() => ({ x: 10, y: 20, z: 30 }));
      const result = { x: 0, y: 0, z: 0 };

      // Mock delta calculation
      JulianDate.secondsDifference
        .mockReturnValueOnce(1000) // Initial check
        .mockReturnValueOnce(0);   // After reinitialization

      const returnValue = lagrange(times, positions, epoch, time, update, result, 180);

      expect(update).toHaveBeenCalled(); // Should reinitialize
      expect(times.length).toBe(7); // Should have been populated with 7 points
      expect(positions.length).toBe(21); // Should have been populated with 7*3 components
    });

    test('should reinitialize when delta before first time', () => {
      const times = [100, 280, 460, 640, 820, 1000, 1180]; // Start at 100
      const positions = new Array(21).fill(0);
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 50 }; // Before first time
      const update = jest.fn(() => ({ x: 10, y: 20, z: 30 }));
      const result = { x: 0, y: 0, z: 0 };

      JulianDate.secondsDifference
        .mockReturnValueOnce(50) // Less than times[0] = 100
        .mockReturnValueOnce(0); // After reinitialization

      lagrange(times, positions, epoch, time, update, result);

      expect(update).toHaveBeenCalled();
    });

    test('should reinitialize when delta after last time', () => {
      const times = [0, 180, 360, 540, 720, 900, 1080];
      const positions = new Array(21).fill(0);
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 2000 }; // After last time
      const update = jest.fn(() => ({ x: 10, y: 20, z: 30 }));
      const result = { x: 0, y: 0, z: 0 };

      JulianDate.secondsDifference
        .mockReturnValueOnce(1500) // Greater than times[6] = 1080
        .mockReturnValueOnce(0);   // After reinitialization

      lagrange(times, positions, epoch, time, update, result);

      expect(update).toHaveBeenCalled();
    });

    test('should use custom interval', () => {
      const times = [];
      const positions = [];
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn(() => ({ x: 10, y: 20, z: 30 }));
      const result = { x: 0, y: 0, z: 0 };
      const customInterval = 300; // Custom interval

      JulianDate.secondsDifference
        .mockReturnValueOnce(1000) // Initial check
        .mockReturnValueOnce(0);   // After reinitialization

      lagrange(times, positions, epoch, time, update, result, customInterval);

      expect(update).toHaveBeenCalled();
      // The initialize function should be called with the custom interval
    });

    test('should handle exact boundary conditions', () => {
      const times = [0, 180, 360, 540, 720, 900, 1080];
      const positions = new Array(21).fill(0);
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1080 }; // Exactly at last time
      const update = jest.fn();
      const result = { x: 0, y: 0, z: 0 };

      JulianDate.secondsDifference.mockReturnValue(1080); // Exactly at boundary

      lagrange(times, positions, epoch, time, update, result);

      expect(update).not.toHaveBeenCalled(); // Should not reinitialize
    });
  });

  describe('initialize', () => {
    test('should initialize times and positions arrays', () => {
      const times = [1, 2, 3]; // Should be cleared
      const positions = [4, 5, 6]; // Should be cleared
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn((t) => ({ x: t.secondsOfDay / 100, y: t.secondsOfDay / 50, z: t.secondsOfDay / 25 }));
      const interval = 200;
      const numPoints = 5;

      // Mock JulianDate operations
      JulianDate.clone.mockImplementation((date, result) => {
        if (result) {
          result.dayNumber = date.dayNumber;
          result.secondsOfDay = date.secondsOfDay;
          return result;
        }
        return { dayNumber: date.dayNumber, secondsOfDay: date.secondsOfDay };
      });

      JulianDate.addSeconds.mockImplementation((date, seconds, result) => {
        if (result) {
          result.secondsOfDay = date.secondsOfDay + seconds;
          return result;
        }
        return { dayNumber: date.dayNumber, secondsOfDay: date.secondsOfDay + seconds };
      });

      initialize(times, positions, epoch, time, update, interval, numPoints);

      expect(times.length).toBe(5); // Should be populated with 5 points
      expect(positions.length).toBe(15); // Should be populated with 5*3 components
      expect(update).toHaveBeenCalledTimes(numPoints);
      expect(JulianDate.clone).toHaveBeenCalled();
      expect(JulianDate.addSeconds).toHaveBeenCalled();
    });

    test('should set epoch to first time point', () => {
      const times = [];
      const positions = [];
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn(() => ({ x: 1, y: 2, z: 3 }));
      const interval = 100;
      const numPoints = 3;

      // Track the first call to JulianDate.clone
      JulianDate.clone.mockImplementation((source, result) => {
        if (result && result === epoch) {
          // This is the epoch setting
          result.dayNumber = source.dayNumber;
          result.secondsOfDay = source.secondsOfDay;
          return result;
        }
        return { dayNumber: source.dayNumber, secondsOfDay: source.secondsOfDay };
      });

      initialize(times, positions, epoch, time, update, interval, numPoints);

      // Epoch should be set to the first computed time
      expect(JulianDate.clone).toHaveBeenCalledWith(expect.any(Object), epoch);
    });

    test('should handle default parameters', () => {
      const times = [];
      const positions = [];
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn(() => ({ x: 1, y: 2, z: 3 }));
      const interval = 180;
      const numPoints = 7;

      initialize(times, positions, epoch, time, update, interval, numPoints);

      expect(update).toHaveBeenCalledTimes(7); // Default numPoints
    });

    test('should populate positions array correctly', () => {
      const times = [];
      const positions = [];
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn((t) => ({ x: 10, y: 20, z: 30 }));
      const interval = 100;
      const numPoints = 2;

      initialize(times, positions, epoch, time, update, interval, numPoints);

      expect(positions).toEqual([10, 20, 30, 10, 20, 30]); // 2 points * 3 components each
      expect(times).toEqual([0, 100]); // interval * i for i = 0, 1
    });

    test('should handle zero interval', () => {
      const times = [];
      const positions = [];
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn(() => ({ x: 1, y: 2, z: 3 }));
      const interval = 0;
      const numPoints = 3;

      initialize(times, positions, epoch, time, update, interval, numPoints);

      expect(times).toEqual([0, 0, 0]); // All zeros with zero interval
      expect(update).toHaveBeenCalledTimes(3);
    });

    test('should handle single point', () => {
      const times = [];
      const positions = [];
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn(() => ({ x: 5, y: 10, z: 15 }));
      const interval = 100;
      const numPoints = 1;

      initialize(times, positions, epoch, time, update, interval, numPoints);

      expect(times).toEqual([0]);
      expect(positions).toEqual([5, 10, 15]);
      expect(update).toHaveBeenCalledTimes(1);
    });

    test('should handle large number of points', () => {
      const times = [];
      const positions = [];
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn((t) => ({ x: 1, y: 1, z: 1 }));
      const interval = 10;
      const numPoints = 100;

      initialize(times, positions, epoch, time, update, interval, numPoints);

      expect(times.length).toBe(100);
      expect(positions.length).toBe(300); // 100 points * 3 components
      expect(update).toHaveBeenCalledTimes(100);
    });
  });

  describe('integration tests', () => {
    test('should work together - full lagrange interpolation cycle', () => {
      const times = [];
      const positions = [];
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn(() => ({ x: 100, y: 200, z: 300 }));
      const result = { x: 0, y: 0, z: 0 };

      // First call should initialize
      JulianDate.secondsDifference.mockReturnValueOnce(1000).mockReturnValueOnce(0);

      lagrange(times, positions, epoch, time, update, result);

      expect(update).toHaveBeenCalled(); // Initialization occurred
      expect(LagrangePolynomialApproximation.interpolateOrderZero).toHaveBeenCalled();
    });

    test('should handle repeated calls efficiently', () => {
      const times = [0, 180, 360, 540, 720, 900, 1080];
      const positions = new Array(21).fill(0).map((_, i) => i);
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time1 = { dayNumber: 1, secondsOfDay: 500 };
      const time2 = { dayNumber: 1, secondsOfDay: 600 };
      const update = jest.fn();
      const result = { x: 0, y: 0, z: 0 };

      JulianDate.secondsDifference
        .mockReturnValueOnce(500) // First call
        .mockReturnValueOnce(600); // Second call

      lagrange(times, positions, epoch, time1, update, result);
      lagrange(times, positions, epoch, time2, update, result);

      expect(update).not.toHaveBeenCalled(); // No reinitialization needed
      expect(LagrangePolynomialApproximation.interpolateOrderZero).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    test('should handle empty arrays gracefully', () => {
      const times = [];
      const positions = [];
      const t = 100;
      const result = { x: 0, y: 0, z: 0 };

      expect(() => lagrange_fast(times, positions, t, result)).not.toThrow();
    });

    test('should handle negative time values', () => {
      const times = [-200, -100, 0, 100, 200];
      const positions = new Array(15).fill(0);
      const t = -50;
      const result = { x: 0, y: 0, z: 0 };

      expect(() => lagrange_fast(times, positions, t, result)).not.toThrow();
    });

    test('should handle very large time values', () => {
      const times = [1e6, 1e6 + 180, 1e6 + 360];
      const positions = new Array(9).fill(0);
      const t = 1e6 + 200;
      const result = { x: 0, y: 0, z: 0 };

      expect(() => lagrange_fast(times, positions, t, result)).not.toThrow();
    });

    test('should handle update function errors gracefully', () => {
      const times = [];
      const positions = [];
      const epoch = { dayNumber: 1, secondsOfDay: 0 };
      const time = { dayNumber: 1, secondsOfDay: 1000 };
      const update = jest.fn(() => { throw new Error('Update failed'); });

      expect(() => initialize(times, positions, epoch, time, update, 180, 1)).toThrow('Update failed');
    });
  });
});
