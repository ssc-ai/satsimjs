import { Cartesian3, JulianDate } from 'cesium';
import { getVisibility } from '../src/engine/geometry/visibility.js';

// Mock the dependencies
jest.mock('../src/engine/dynamics/gimbal.js', () => ({
    southEastZenithToAzEl: jest.fn()
}));

jest.mock('../src/engine/geometry/photometry.js', () => ({
    calculateTargetBrightness: jest.fn()
}));

import { southEastZenithToAzEl } from '../src/engine/dynamics/gimbal.js';
import { calculateTargetBrightness } from '../src/engine/geometry/photometry.js';

describe('Visibility Functions', () => {
    let mockUniverse, mockViewer, mockObservatory, mockSatellite;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock universe
        mockUniverse = {
            sun: {
                worldPosition: new Cartesian3(1e11, 0, 0)
            }
        };

        // Mock viewer
        mockViewer = {
            clock: {
                currentTime: JulianDate.now()
            }
        };

        // Mock satellite
        mockSatellite = {
            worldPosition: new Cartesian3(1e6, 0, 0),
            update: jest.fn()
        };

        // Mock observatory
        mockObservatory = {
            sensor: {
                name: 'TestSensor',
                field_of_regard: [
                    {
                        clock: [0, 90],     // Azimuth range 0-90 degrees
                        elevation: [10, 80] // Elevation range 10-80 degrees
                    }
                ]
            },
            site: {
                transformPointFromWorld: jest.fn()
            }
        };

        // Setup default mock returns
        southEastZenithToAzEl.mockReturnValue([45, 30, 1e6]); // az=45°, el=30°, range=1e6m
        calculateTargetBrightness.mockReturnValue({
            phaseAngle: 45,
            range: 1e6,
            mv: 12.5
        });
    });

    describe('getVisibility', () => {
        test('should process single observatory and satellite', () => {
            const observatories = [mockObservatory];
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility).toHaveLength(1);
            expect(visibility[0]).toEqual({
                sensor: 'TestSensor',
                az: 45,
                el: 30,
                r: 1e6,
                visible: true,
                phaseAngle: 45,
                range: 1e6,
                mv: 12.5
            });
        });

        test('should call satellite update with correct parameters', () => {
            const observatories = [mockObservatory];
            
            getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(mockSatellite.update).toHaveBeenCalledWith(mockViewer.clock.currentTime, mockUniverse);
        });

        test('should transform satellite position to local coordinates', () => {
            const observatories = [mockObservatory];
            
            getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(mockObservatory.site.transformPointFromWorld).toHaveBeenCalledWith(
                mockSatellite.worldPosition,
                expect.any(Cartesian3)
            );
        });

        test('should call southEastZenithToAzEl with local position', () => {
            const observatories = [mockObservatory];
            
            getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(southEastZenithToAzEl).toHaveBeenCalledWith(expect.any(Cartesian3));
        });

        test('should call calculateTargetBrightness with correct parameters', () => {
            const observatories = [mockObservatory];
            
            getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(calculateTargetBrightness).toHaveBeenCalledWith(
                mockObservatory.site,
                mockSatellite,
                mockUniverse.sun
            );
        });

        test('should determine visibility based on field of regard', () => {
            const observatories = [mockObservatory];
            
            // Position within field of regard: az=45°, el=30°
            southEastZenithToAzEl.mockReturnValue([45, 30, 1e6]);
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].visible).toBe(true);
        });

        test('should mark as not visible when outside azimuth range', () => {
            const observatories = [mockObservatory];
            
            // Position outside azimuth range: az=120°, el=30°
            southEastZenithToAzEl.mockReturnValue([120, 30, 1e6]);
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].visible).toBe(false);
        });

        test('should mark as not visible when outside elevation range', () => {
            const observatories = [mockObservatory];
            
            // Position outside elevation range: az=45°, el=5°
            southEastZenithToAzEl.mockReturnValue([45, 5, 1e6]);
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].visible).toBe(false);
        });

        test('should mark as not visible when outside both ranges', () => {
            const observatories = [mockObservatory];
            
            // Position outside both ranges: az=120°, el=5°
            southEastZenithToAzEl.mockReturnValue([120, 5, 1e6]);
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].visible).toBe(false);
        });

        test('should handle multiple field of regard regions', () => {
            const observatories = [{
                ...mockObservatory,
                sensor: {
                    name: 'MultiRegionSensor',
                    field_of_regard: [
                        {
                            clock: [0, 90],     // First region
                            elevation: [10, 40]
                        },
                        {
                            clock: [180, 270],  // Second region
                            elevation: [20, 60]
                        }
                    ]
                }
            }];
            
            // Position in second region: az=225°, el=30°
            southEastZenithToAzEl.mockReturnValue([225, 30, 1e6]);
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].visible).toBe(true);
        });

        test('should handle observatory without field of regard', () => {
            const observatories = [{
                ...mockObservatory,
                sensor: {
                    name: 'NoFieldSensor'
                    // No field_of_regard property
                }
            }];
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].visible).toBe(false);
        });

        test('should handle undefined field of regard', () => {
            const observatories = [{
                ...mockObservatory,
                sensor: {
                    name: 'UndefinedFieldSensor',
                    field_of_regard: undefined
                }
            }];
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].visible).toBe(false);
        });

        test('should handle null field of regard', () => {
            const observatories = [{
                ...mockObservatory,
                sensor: {
                    name: 'NullFieldSensor',
                    field_of_regard: null
                }
            }];
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].visible).toBe(false);
        });

        test('should handle empty field of regard array', () => {
            const observatories = [{
                ...mockObservatory,
                sensor: {
                    name: 'EmptyFieldSensor',
                    field_of_regard: []
                }
            }];
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].visible).toBe(false);
        });

        test('should process multiple observatories', () => {
            const observatory1 = {
                ...mockObservatory,
                sensor: { name: 'Sensor1', field_of_regard: [{ clock: [0, 90], elevation: [10, 80] }] }
            };
            const observatory2 = {
                ...mockObservatory,
                sensor: { name: 'Sensor2', field_of_regard: [{ clock: [180, 270], elevation: [20, 70] }] },
                site: {
                    transformPointFromWorld: jest.fn()
                }
            };
            
            const observatories = [observatory1, observatory2];
            
            // First call within range for observatory1, second call outside range for observatory2
            southEastZenithToAzEl
                .mockReturnValueOnce([45, 30, 1e6])   // Visible to observatory1
                .mockReturnValueOnce([225, 30, 1e6]); // Visible to observatory2
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility).toHaveLength(2);
            expect(visibility[0].sensor).toBe('Sensor1');
            expect(visibility[0].visible).toBe(true);
            expect(visibility[1].sensor).toBe('Sensor2');
            expect(visibility[1].visible).toBe(true);
        });

        test('should handle different azimuth and elevation values for each observatory', () => {
            const observatory1 = {
                ...mockObservatory,
                sensor: { name: 'Sensor1', field_of_regard: [{ clock: [0, 90], elevation: [10, 80] }] },
                site: { transformPointFromWorld: jest.fn() }
            };
            const observatory2 = {
                ...mockObservatory,
                sensor: { name: 'Sensor2', field_of_regard: [{ clock: [0, 90], elevation: [10, 80] }] },
                site: { transformPointFromWorld: jest.fn() }
            };
            
            const observatories = [observatory1, observatory2];
            
            southEastZenithToAzEl
                .mockReturnValueOnce([30, 40, 5e5])
                .mockReturnValueOnce([60, 50, 8e5]);
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].az).toBe(30);
            expect(visibility[0].el).toBe(40);
            expect(visibility[0].r).toBe(5e5);
            expect(visibility[1].az).toBe(60);
            expect(visibility[1].el).toBe(50);
            expect(visibility[1].r).toBe(8e5);
        });

        test('should handle boundary conditions for field of regard', () => {
            const observatories = [mockObservatory];
            
            // Test exact boundary values - note that the code uses > and < (not >= <=)
            // So boundary values themselves are NOT included
            const boundaryTests = [
                [1, 11, true],    // Just inside lower bounds
                [89, 79, true],   // Just inside upper bounds
                [45, 45, true],   // Middle values
                [0, 11, false],   // Exactly at azimuth lower bound (excluded)
                [90, 11, false],  // Exactly at azimuth upper bound (excluded)
                [45, 10, false],  // Exactly at elevation lower bound (excluded)
                [45, 80, false],  // Exactly at elevation upper bound (excluded)
                [-1, 45, false], // Below azimuth range
                [91, 45, false], // Above azimuth range
                [45, 9, false],  // Below elevation range
                [45, 81, false], // Above elevation range
            ];
            
            boundaryTests.forEach(([az, el, expectedVisible], index) => {
                jest.clearAllMocks();
                southEastZenithToAzEl.mockReturnValueOnce([az, el, 1e6]);
                
                const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
                
                expect(visibility[0].visible).toBe(expectedVisible);
            });
        });

        test('should preserve brightness calculation results', () => {
            const observatories = [mockObservatory];
            
            calculateTargetBrightness.mockReturnValue({
                phaseAngle: 67.5,
                range: 1.2e6,
                mv: 14.8
            });
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0]).toEqual(expect.objectContaining({
                phaseAngle: 67.5,
                range: 1.2e6,
                mv: 14.8
            }));
        });

        test('should handle complex field of regard with multiple regions', () => {
            const observatories = [{
                ...mockObservatory,
                sensor: {
                    name: 'ComplexSensor',
                    field_of_regard: [
                        { clock: [0, 45], elevation: [10, 30] },
                        { clock: [45, 90], elevation: [20, 40] },
                        { clock: [270, 360], elevation: [5, 25] }
                    ]
                }
            }];
            
            // Test various positions
            const testCases = [
                [30, 20, true],   // In first region
                [60, 35, true],   // In second region
                [300, 15, true],  // In third region
                [120, 30, false], // Between regions
                [30, 5, false],   // Below elevation in first region
                [60, 45, false],  // Above elevation in second region
            ];
            
            testCases.forEach(([az, el, expectedVisible]) => {
                southEastZenithToAzEl.mockReturnValueOnce([az, el, 1e6]);
                
                const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
                
                expect(visibility[0].visible).toBe(expectedVisible);
                
                // Reset for next iteration
                jest.clearAllMocks();
                southEastZenithToAzEl.mockClear();
                calculateTargetBrightness.mockReturnValue({ phaseAngle: 45, range: 1e6, mv: 12.5 });
            });
        });

        test('should update satellite once for each observatory', () => {
            const observatories = [mockObservatory, { ...mockObservatory, sensor: { name: 'Sensor2' } }];
            
            getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(mockSatellite.update).toHaveBeenCalledTimes(2); // Once per observatory
        });

        test('should handle zero azimuth and elevation', () => {
            const observatories = [{
                ...mockObservatory,
                sensor: {
                    name: 'ZeroTestSensor',
                    field_of_regard: [{ clock: [-10, 10], elevation: [-5, 15] }]
                }
            }];
            
            southEastZenithToAzEl.mockReturnValue([0, 0, 1e6]);
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].az).toBe(0);
            expect(visibility[0].el).toBe(0);
            expect(visibility[0].visible).toBe(true);
        });

        test('should handle negative azimuth and elevation values', () => {
            const observatories = [{
                ...mockObservatory,
                sensor: {
                    name: 'NegativeTestSensor',
                    field_of_regard: [{ clock: [-45, 45], elevation: [-10, 30] }]
                }
            }];
            
            southEastZenithToAzEl.mockReturnValue([-30, -5, 1e6]);
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].az).toBe(-30);
            expect(visibility[0].el).toBe(-5);
            expect(visibility[0].visible).toBe(true);
        });

        test('should handle very large azimuth values', () => {
            const observatories = [{
                ...mockObservatory,
                sensor: {
                    name: 'LargeAzSensor',
                    field_of_regard: [{ clock: [350, 370], elevation: [10, 80] }]
                }
            }];
            
            southEastZenithToAzEl.mockReturnValue([360, 30, 1e6]);
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0].visible).toBe(true);
        });

        test('should return empty array for empty observatories array', () => {
            const observatories = [];
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility).toEqual([]);
        });

        test('should handle real-world scenario with typical values', () => {
            const observatories = [{
                sensor: {
                    name: 'GroundStation1',
                    field_of_regard: [
                        { clock: [0, 360], elevation: [10, 90] } // Full azimuth, minimum 10° elevation
                    ]
                },
                site: {
                    transformPointFromWorld: jest.fn()
                }
            }];
            
            southEastZenithToAzEl.mockReturnValue([125.5, 45.2, 850000]);
            calculateTargetBrightness.mockReturnValue({
                phaseAngle: 23.4,
                range: 850000,
                mv: 8.5
            });
            
            const visibility = getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(visibility[0]).toEqual({
                sensor: 'GroundStation1',
                az: 125.5,
                el: 45.2,
                r: 850000,
                visible: true,
                phaseAngle: 23.4,
                range: 850000,
                mv: 8.5
            });
        });
    });

    describe('Integration with mocked dependencies', () => {
        test('should pass correct parameters to transformPointFromWorld', () => {
            const observatories = [mockObservatory];
            const localPos = new Cartesian3();
            
            mockObservatory.site.transformPointFromWorld.mockImplementation((worldPos, result) => {
                result.x = 1000;
                result.y = 2000;
                result.z = 3000;
                return result;
            });
            
            getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(mockObservatory.site.transformPointFromWorld).toHaveBeenCalledWith(
                mockSatellite.worldPosition,
                expect.any(Cartesian3)
            );
        });

        test('should handle coordinate transformation results', () => {
            const observatories = [mockObservatory];
            
            // Mock the coordinate transformation to return specific local coordinates
            mockObservatory.site.transformPointFromWorld.mockImplementation((worldPos, result) => {
                result.x = 5000;
                result.y = -3000;
                result.z = 1000;
                return result;
            });
            
            getVisibility(mockUniverse, mockViewer, observatories, mockSatellite);
            
            expect(southEastZenithToAzEl).toHaveBeenCalledWith(
                expect.objectContaining({
                    x: 5000,
                    y: -3000,
                    z: 1000
                })
            );
        });
    });
});
