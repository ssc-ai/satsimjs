const { Cartesian3 } = require('cesium');
const { mvToPe, peToMv, lambertianSphereToMv, calculateTargetBrightness } = require('../src/engine/geometry/photometry.js');

describe('Photometry Functions', () => {
    describe('mvToPe', () => {
        test('should convert magnitude to photoelectrons correctly', () => {
            const mv = 10;
            const zeropoint = 25;
            const pe = mvToPe(mv, zeropoint);
            
            expect(pe).toBeCloseTo(1000000, 5);
        });

        test('should handle zero magnitude', () => {
            const mv = 0;
            const zeropoint = 25;
            const pe = mvToPe(mv, zeropoint);
            
            expect(pe).toBeCloseTo(10000000000, 5);
        });

        test('should handle negative magnitude', () => {
            const mv = -5;
            const zeropoint = 25;
            const pe = mvToPe(mv, zeropoint);
            
            expect(pe).toBeCloseTo(1000000000000, 0);
        });
    });

    describe('peToMv', () => {
        test('should convert photoelectrons to magnitude correctly', () => {
            const pe = 1000000;
            const zeropoint = 25;
            const mv = peToMv(pe, zeropoint);
            
            expect(mv).toBeCloseTo(10, 5);
        });

        test('should handle single photoelectron', () => {
            const pe = 1;
            const zeropoint = 25;
            const mv = peToMv(pe, zeropoint);
            
            expect(mv).toBeCloseTo(25, 5);
        });
    });

    describe('mvToPe and peToMv inverse relationship', () => {
        test('should be inverse functions', () => {
            const originalMv = 12.3;
            const zeropoint = 25;
            
            const pe = mvToPe(originalMv, zeropoint);
            const convertedMv = peToMv(pe, zeropoint);
            
            expect(convertedMv).toBeCloseTo(originalMv, 10);
        });
    });

    describe('lambertianSphereToMv', () => {
        test('should calculate magnitude for Lambertian sphere correctly', () => {
            const phaseAngle = 45;
            const range = 1e6;
            const radius = 1000;
            const albedo = 0.3;
            
            const mv = lambertianSphereToMv(phaseAngle, range, radius, albedo);
            
            expect(mv).toBeDefined();
            expect(typeof mv).toBe('number');
            expect(isFinite(mv)).toBe(true);
        });

        test('should be dimmer at larger ranges', () => {
            const phaseAngle = 45;
            const radius = 1000;
            const albedo = 0.3;
            
            const mv1 = lambertianSphereToMv(phaseAngle, 1e6, radius, albedo);
            const mv2 = lambertianSphereToMv(phaseAngle, 2e6, radius, albedo);
            
            expect(mv2).toBeGreaterThan(mv1);
        });

        test('should be brighter for larger objects', () => {
            const phaseAngle = 45;
            const range = 1e6;
            const albedo = 0.3;
            
            const mv1 = lambertianSphereToMv(phaseAngle, range, 1000, albedo);
            const mv2 = lambertianSphereToMv(phaseAngle, range, 2000, albedo);
            
            expect(mv2).toBeLessThan(mv1);
        });
    });

    describe('calculateTargetBrightness', () => {
        let mockObserver, mockTarget, mockSun;

        beforeEach(() => {
            mockObserver = {
                worldPosition: new Cartesian3(0, 0, 0)
            };

            mockTarget = {
                worldPosition: new Cartesian3(1000000, 1000000, 0),
                model: {
                    mode: 'lambertianSphere',
                    diameter: 2000,
                    albedo: 0.3
                }
            };

            mockSun = {
                worldPosition: new Cartesian3(1000000, 0, 0)
            };
        });

        test('should calculate target brightness with all parameters', () => {
            const result = calculateTargetBrightness(mockObserver, mockTarget, mockSun);
            
            expect(result).toBeDefined();
            expect(result.mv).toBeDefined();
            expect(result.phaseAngle).toBeDefined();
            expect(result.range).toBeDefined();
            
            expect(typeof result.mv).toBe('number');
            expect(isFinite(result.mv)).toBe(true);
        });

        test('should calculate correct range', () => {
            mockTarget.worldPosition = new Cartesian3(3000, 4000, 0);
            
            const result = calculateTargetBrightness(mockObserver, mockTarget, mockSun);
            
            expect(result.range).toBeCloseTo(5000, 1);
        });

        test('should handle target without model', () => {
            delete mockTarget.model;
            
            const result = calculateTargetBrightness(mockObserver, mockTarget, mockSun);
            
            expect(result).toBeDefined();
            expect(result.mv).toBeUndefined();
            expect(result.phaseAngle).toBeDefined();
            expect(result.range).toBeDefined();
        });

        test('should handle target with non-lambertian model', () => {
            mockTarget.model.mode = 'other';
            
            const result = calculateTargetBrightness(mockObserver, mockTarget, mockSun);
            
            expect(result).toBeDefined();
            expect(result.mv).toBeUndefined();
            expect(result.phaseAngle).toBeDefined();
            expect(result.range).toBeDefined();
        });

        test('should return brighter magnitude for larger targets', () => {
            mockTarget.model.diameter = 1000;
            const result1 = calculateTargetBrightness(mockObserver, mockTarget, mockSun);
            
            mockTarget.model.diameter = 5000;
            const result2 = calculateTargetBrightness(mockObserver, mockTarget, mockSun);
            
            expect(result2.mv).toBeLessThan(result1.mv);
        });
    });

    describe('Integration tests', () => {
        test('should work with lunar observation scenario', () => {
            const observer = {
                worldPosition: new Cartesian3(0, 0, 0)
            };
            
            const moon = {
                worldPosition: new Cartesian3(384400000, 0, 0),
                model: {
                    mode: 'lambertianSphere',
                    diameter: 3474000,
                    albedo: 0.12
                }
            };
            
            const sun = {
                worldPosition: new Cartesian3(0, 1.5e11, 0)
            };
            
            const result = calculateTargetBrightness(observer, moon, sun);
            
            expect(result.mv).toBeDefined();
            expect(result.mv).toBeLessThan(5);
            expect(result.phaseAngle).toBeCloseTo(90, 0);
        });
    });
});
