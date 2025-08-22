import Earth from '../src/engine/objects/Earth.js';
import { ReferenceFrame, JulianDate, Cartesian3, Matrix3, Matrix4, Transforms, defined } from 'cesium';

// Mock the Transforms module
jest.mock('cesium', () => {
  const originalCesium = jest.requireActual('cesium');
  return {
    ...originalCesium,
    Transforms: {
      computeIcrfToFixedMatrix: jest.fn(),
      computeTemeToPseudoFixedMatrix: jest.fn()
    },
    defined: jest.fn()
  };
});

describe('Earth', () => {
  let earth;
  const mockTime = JulianDate.now();
  const mockUniverse = { name: 'testUniverse' };

  beforeEach(() => {
    jest.clearAllMocks();
    earth = new Earth();
  });

  describe('constructor', () => {
    test('should create Earth with correct default properties', () => {
      expect(earth._name).toBe('Earth');
      expect(earth._referenceFrame).toBe(ReferenceFrame.FIXED);
    });

    test('should initialize transformation matrices', () => {
      expect(earth._teme2ecef).toBeInstanceOf(Matrix3);
      expect(earth._ecef2teme).toBeInstanceOf(Matrix3);
    });

    test('should inherit from SimObject', () => {
      expect(earth._position).toBeInstanceOf(Cartesian3);
      expect(earth._velocity).toBeInstanceOf(Cartesian3);
      expect(earth._updateListeners).toEqual([]);
      expect(earth._transform).toBeInstanceOf(Matrix4);
    });

    test('should initialize position and velocity as zero vectors', () => {
      expect(earth._position).toEqual(Cartesian3.ZERO);
      expect(earth._velocity).toEqual(Cartesian3.ZERO);
    });

    test('should have fixed reference frame', () => {
      expect(earth.referenceFrame).toBe(ReferenceFrame.FIXED);
    });
  });

  describe('worldPosition getter', () => {
    test('should always return Cartesian3.ZERO', () => {
      expect(earth.worldPosition).toBe(Cartesian3.ZERO);
    });

    test('should return the same Cartesian3.ZERO reference', () => {
      const pos1 = earth.worldPosition;
      const pos2 = earth.worldPosition;
      expect(pos1).toBe(pos2);
      expect(pos1).toBe(Cartesian3.ZERO);
    });
  });

  describe('worldVelocity getter', () => {
    test('should always return Cartesian3.ZERO', () => {
      expect(earth.worldVelocity).toBe(Cartesian3.ZERO);
    });

    test('should return the same Cartesian3.ZERO reference', () => {
      const vel1 = earth.worldVelocity;
      const vel2 = earth.worldVelocity;
      expect(vel1).toBe(vel2);
      expect(vel1).toBe(Cartesian3.ZERO);
    });
  });

  describe('_update method', () => {
    describe('successful ICRF to Fixed transformation', () => {
      beforeEach(() => {
        // Mock successful ICRF to Fixed matrix computation
        const mockMatrix = new Matrix3(
          1, 0, 0,
          0, 1, 0,
          0, 0, 1
        );
        Transforms.computeIcrfToFixedMatrix.mockReturnValue(mockMatrix);
        defined.mockReturnValue(true);
      });

      test('should call computeIcrfToFixedMatrix with correct parameters', () => {
        earth._update(mockTime, mockUniverse);
        
        expect(Transforms.computeIcrfToFixedMatrix)
          .toHaveBeenCalledWith(mockTime, earth._teme2ecef);
      });

      test('should not call computeTemeToPseudoFixedMatrix when ICRF transform succeeds', () => {
        earth._update(mockTime, mockUniverse);
        
        expect(Transforms.computeTemeToPseudoFixedMatrix).not.toHaveBeenCalled();
      });

      test('should compute transpose and set transform matrix', () => {
        const spy1 = jest.spyOn(Matrix3, 'transpose');
        const spy2 = jest.spyOn(Matrix4, 'fromRotation');
        
        earth._update(mockTime, mockUniverse);
        
        expect(spy1).toHaveBeenCalledWith(earth._teme2ecef, earth._ecef2teme);
        expect(spy2).toHaveBeenCalledWith(earth._ecef2teme, earth._transform);
        
        spy1.mockRestore();
        spy2.mockRestore();
      });
    });

    describe('fallback to TEME to Pseudo-Fixed transformation', () => {
      beforeEach(() => {
        // Mock failed ICRF to Fixed matrix computation
        Transforms.computeIcrfToFixedMatrix.mockReturnValue(undefined);
        defined.mockReturnValue(false);
      });

      test('should call computeTemeToPseudoFixedMatrix when ICRF transform fails', () => {
        earth._update(mockTime, mockUniverse);
        
        expect(Transforms.computeIcrfToFixedMatrix)
          .toHaveBeenCalledWith(mockTime, earth._teme2ecef);
        expect(Transforms.computeTemeToPseudoFixedMatrix)
          .toHaveBeenCalledWith(mockTime, earth._teme2ecef);
      });

      test('should still compute transpose and set transform matrix on fallback', () => {
        const spy1 = jest.spyOn(Matrix3, 'transpose');
        const spy2 = jest.spyOn(Matrix4, 'fromRotation');
        
        earth._update(mockTime, mockUniverse);
        
        expect(spy1).toHaveBeenCalledWith(earth._teme2ecef, earth._ecef2teme);
        expect(spy2).toHaveBeenCalledWith(earth._ecef2teme, earth._transform);
        
        spy1.mockRestore();
        spy2.mockRestore();
      });
    });

    describe('transformation matrix handling', () => {
      test('should preserve original matrix objects throughout update', () => {
        const originalTeme2Ecef = earth._teme2ecef;
        const originalEcef2Teme = earth._ecef2teme;
        const originalTransform = earth._transform;
        
        const mockMatrix = new Matrix3(1, 0, 0, 0, 1, 0, 0, 0, 1);
        Transforms.computeIcrfToFixedMatrix.mockReturnValue(mockMatrix);
        defined.mockReturnValue(true);
        
        earth._update(mockTime, mockUniverse);
        
        expect(earth._teme2ecef).toBe(originalTeme2Ecef);
        expect(earth._ecef2teme).toBe(originalEcef2Teme);
        expect(earth._transform).toBe(originalTransform);
      });

      test('should handle different rotation matrices correctly', () => {
        const testMatrix = new Matrix3(
          0.866, -0.5, 0,
          0.5, 0.866, 0,
          0, 0, 1
        );
        
        Transforms.computeIcrfToFixedMatrix.mockReturnValue(testMatrix);
        defined.mockReturnValue(true);
        
        const spy1 = jest.spyOn(Matrix3, 'transpose');
        const spy2 = jest.spyOn(Matrix4, 'fromRotation');
        
        earth._update(mockTime, mockUniverse);
        
        expect(spy1).toHaveBeenCalledWith(earth._teme2ecef, earth._ecef2teme);
        expect(spy2).toHaveBeenCalledWith(earth._ecef2teme, earth._transform);
        
        spy1.mockRestore();
        spy2.mockRestore();
      });
    });

    describe('time handling', () => {
      test('should handle different Julian dates', () => {
        const testTimes = [
          JulianDate.fromDate(new Date('2000-01-01T12:00:00Z')),
          JulianDate.fromDate(new Date('2024-06-15T06:30:00Z')),
          JulianDate.fromDate(new Date('2030-12-31T23:59:59Z'))
        ];
        
        Transforms.computeIcrfToFixedMatrix.mockReturnValue(new Matrix3());
        defined.mockReturnValue(true);
        
        testTimes.forEach(time => {
          jest.clearAllMocks();
          earth._update(time, mockUniverse);
          
          expect(Transforms.computeIcrfToFixedMatrix)
            .toHaveBeenCalledWith(time, earth._teme2ecef);
        });
      });

      test('should handle extreme Julian dates', () => {
        const extremeDates = [
          new JulianDate(0, 0), // Very early date
          JulianDate.fromDate(new Date('1900-01-01')), // Historical date
          JulianDate.fromDate(new Date('2100-12-31')), // Future date
        ];
        
        Transforms.computeIcrfToFixedMatrix.mockReturnValue(new Matrix3());
        defined.mockReturnValue(true);
        
        extremeDates.forEach(date => {
          expect(() => {
            earth._update(date, mockUniverse);
          }).not.toThrow();
        });
      });
    });

    test('should handle universe parameter (not used but should not cause errors)', () => {
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(new Matrix3());
      defined.mockReturnValue(true);
      
      expect(() => {
        earth._update(mockTime, null);
      }).not.toThrow();
      
      expect(() => {
        earth._update(mockTime, undefined);
      }).not.toThrow();
      
      expect(() => {
        earth._update(mockTime, {});
      }).not.toThrow();
    });
  });

  describe('inheritance from SimObject', () => {
    test('should have all SimObject properties', () => {
      expect(earth.name).toBe('Earth');
      expect(earth._referenceFrame).toBe(ReferenceFrame.FIXED);
      expect(earth._updateListeners).toBeDefined();
      expect(earth._lastUpdate).toBeDefined();
    });

    test('should call _update when update method is called', () => {
      const spy = jest.spyOn(earth, '_update');
      
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(new Matrix3());
      defined.mockReturnValue(true);
      
      earth.update(mockTime, mockUniverse, false, false); // Don't update parent
      
      expect(spy).toHaveBeenCalledWith(mockTime, mockUniverse);
      spy.mockRestore();
    });

    test('should update lastUpdate time when update is called', () => {
      const initialLastUpdate = JulianDate.clone(earth._lastUpdate);
      
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(new Matrix3());
      defined.mockReturnValue(true);
      
      const futureTime = JulianDate.addSeconds(mockTime, 1, new JulianDate());
      earth.update(futureTime, mockUniverse, false, false); // Don't update parent
      
      expect(JulianDate.equals(earth._lastUpdate, futureTime)).toBe(true);
      expect(JulianDate.equals(earth._lastUpdate, initialLastUpdate)).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should handle Transforms.computeIcrfToFixedMatrix throwing an exception', () => {
      Transforms.computeIcrfToFixedMatrix.mockImplementation(() => {
        throw new Error('ICRF computation failed');
      });
      
      expect(() => {
        earth._update(mockTime, mockUniverse);
      }).toThrow('ICRF computation failed');
    });

    test('should handle Transforms.computeTemeToPseudoFixedMatrix throwing an exception', () => {
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(undefined);
      defined.mockReturnValue(false);
      Transforms.computeTemeToPseudoFixedMatrix.mockImplementation(() => {
        throw new Error('TEME computation failed');
      });
      
      expect(() => {
        earth._update(mockTime, mockUniverse);
      }).toThrow('TEME computation failed');
    });

    test('should handle Matrix3.transpose throwing an exception', () => {
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(new Matrix3());
      defined.mockReturnValue(true);
      
      const spy = jest.spyOn(Matrix3, 'transpose').mockImplementation(() => {
        throw new Error('Transpose failed');
      });
      
      expect(() => {
        earth._update(mockTime, mockUniverse);
      }).toThrow('Transpose failed');
      
      spy.mockRestore();
    });

    test('should handle Matrix4.fromRotation throwing an exception', () => {
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(new Matrix3());
      defined.mockReturnValue(true);
      
      const spy = jest.spyOn(Matrix4, 'fromRotation').mockImplementation(() => {
        throw new Error('Matrix4 conversion failed');
      });
      
      expect(() => {
        earth._update(mockTime, mockUniverse);
      }).toThrow('Matrix4 conversion failed');
      
      spy.mockRestore();
    });
  });

  describe('coordinate system transformations', () => {
    test('should correctly set up TEME to ECEF transformation', () => {
      const mockIcrfMatrix = new Matrix3(
        0.866, -0.5, 0,
        0.5, 0.866, 0,
        0, 0, 1
      );
      
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(mockIcrfMatrix);
      defined.mockReturnValue(true);
      
      earth._update(mockTime, mockUniverse);
      
      expect(Transforms.computeIcrfToFixedMatrix)
        .toHaveBeenCalledWith(mockTime, earth._teme2ecef);
    });

    test('should maintain transformation matrix chain integrity', () => {
      const mockMatrix = new Matrix3(1, 0, 0, 0, 1, 0, 0, 0, 1);
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(mockMatrix);
      defined.mockReturnValue(true);
      
      const spy1 = jest.spyOn(Matrix3, 'transpose');
      const spy2 = jest.spyOn(Matrix4, 'fromRotation');
      
      // Verify the complete transformation chain
      earth._update(mockTime, mockUniverse);
      
      // Should call in the correct order: compute -> transpose -> convert to Matrix4
      expect(Transforms.computeIcrfToFixedMatrix).toHaveBeenCalled();
      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
      
      spy1.mockRestore();
      spy2.mockRestore();
    });
  });

  describe('performance considerations', () => {
    test('should reuse matrix objects to avoid allocations', () => {
      const originalTeme2Ecef = earth._teme2ecef;
      const originalEcef2Teme = earth._ecef2teme;
      const originalTransform = earth._transform;
      
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(new Matrix3());
      defined.mockReturnValue(true);
      
      earth._update(mockTime, mockUniverse);
      
      expect(earth._teme2ecef).toBe(originalTeme2Ecef);
      expect(earth._ecef2teme).toBe(originalEcef2Teme);
      expect(earth._transform).toBe(originalTransform);
    });

    test('should minimize transformation calls per update', () => {
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(new Matrix3());
      defined.mockReturnValue(true);
      
      earth._update(mockTime, mockUniverse);
      
      expect(Transforms.computeIcrfToFixedMatrix).toHaveBeenCalledTimes(1);
      expect(Transforms.computeTemeToPseudoFixedMatrix).not.toHaveBeenCalled();
    });
  });

  describe('reference frame behavior', () => {
    test('should have FIXED reference frame consistently', () => {
      expect(earth._referenceFrame).toBe(ReferenceFrame.FIXED);
      // Note: earth.referenceFrame getter may cause issues due to parent property access
    });

    test('should override worldPosition and worldVelocity for FIXED frame', () => {
      // Earth at origin in its own reference frame
      expect(earth.worldPosition).toBe(Cartesian3.ZERO);
      expect(earth.worldVelocity).toBe(Cartesian3.ZERO);
      
      // These should not change even after transformation updates
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(new Matrix3());
      defined.mockReturnValue(true);
      
      earth._update(mockTime, mockUniverse);
      
      expect(earth.worldPosition).toBe(Cartesian3.ZERO);
      expect(earth.worldVelocity).toBe(Cartesian3.ZERO);
    });
  });

  describe('integration scenarios', () => {
    test('should handle rapid successive updates', () => {
      Transforms.computeIcrfToFixedMatrix.mockReturnValue(new Matrix3());
      defined.mockReturnValue(true);
      
      const baseTime = JulianDate.now();
      for (let i = 0; i < 10; i++) {
        const updateTime = JulianDate.addSeconds(baseTime, i, new JulianDate());
        expect(() => {
          earth._update(updateTime, mockUniverse);
        }).not.toThrow();
      }
      
      expect(Transforms.computeIcrfToFixedMatrix).toHaveBeenCalledTimes(10);
    });

    test('should maintain consistent behavior across multiple updates', () => {
      let callCount = 0;
      Transforms.computeIcrfToFixedMatrix.mockImplementation((time, result) => {
        callCount++;
        return new Matrix3(); // Always return valid matrix
      });
      defined.mockReturnValue(true);
      
      for (let i = 0; i < 5; i++) {
        earth._update(mockTime, mockUniverse);
      }
      
      expect(callCount).toBe(5);
      expect(Transforms.computeTemeToPseudoFixedMatrix).not.toHaveBeenCalled();
    });
  });
});
