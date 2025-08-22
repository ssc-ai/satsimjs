import { jest } from '@jest/globals';
import { fetchTle, parseTle } from '../src/io/tle.js';

// Mock fetch globally
global.fetch = jest.fn();

describe('TLE Module', () => {
  
  describe('parseTle', () => {
    let mockCallback;

    beforeEach(() => {
      mockCallback = jest.fn();
    });

    describe('2-line TLE format', () => {
      test('should parse single satellite correctly', () => {
        const tleText = `1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;

        parseTle(tleText, 2, mockCallback);

        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith(
          '25544U',
          '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990',
          '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891'
        );
      });

      test('should parse multiple satellites correctly', () => {
        const tleText = `1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891
1 20580U 90037B   21001.00000000 -.00000123  00000-0 -24531-5 0  9999
2 20580  28.4682  85.6398 0002453 323.7238  36.3626 15.09649053459444`;

        parseTle(tleText, 2, mockCallback);

        expect(mockCallback).toHaveBeenCalledTimes(2);
        
        expect(mockCallback).toHaveBeenNthCalledWith(1,
          '25544U',
          '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990',
          '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891'
        );
        
        expect(mockCallback).toHaveBeenNthCalledWith(2,
          '20580U',
          '1 20580U 90037B   21001.00000000 -.00000123  00000-0 -24531-5 0  9999',
          '2 20580  28.4682  85.6398 0002453 323.7238  36.3626 15.09649053459444'
        );
      });

      test('should handle empty text', () => {
        parseTle('', 2, mockCallback);
        expect(mockCallback).not.toHaveBeenCalled();
      });

      test('should handle text with only whitespace', () => {
        parseTle('   \n  \n  ', 2, mockCallback);
        // The function will attempt to parse whitespace lines, which may result in a callback
        expect(mockCallback).toHaveBeenCalledWith(' ', '   ', '  ');
      });

      test('should handle incomplete satellite data (odd number of lines)', () => {
        const tleText = `1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990`;
        
        parseTle(tleText, 2, mockCallback);
        expect(mockCallback).not.toHaveBeenCalled();
      });

      test('should extract satellite name from line 1 correctly', () => {
        const tleText = `1 43013U 17073A   21001.00000000  .00001234  00000-0  12345-4 0  9999
2 43013  97.4516 123.4567 0001234 234.5678 125.4321 15.12345678123456`;

        parseTle(tleText, 2, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(
          '43013U',
          expect.stringContaining('43013U'),
          expect.stringContaining('43013')
        );
      });

      test('should handle lines with extra whitespace', () => {
        const tleText = `  1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990  
  2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891  `;

        parseTle(tleText, 2, mockCallback);

        expect(mockCallback).toHaveBeenCalledTimes(1);
        // The function extracts the satellite identifier from columns 2-8 and preserves whitespace
        expect(mockCallback).toHaveBeenCalledWith(
          '1 2554', // slice(2, 8) of "  1 25544U..."
          '  1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990  ',
          '  2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891  '
        );
      });
    });

    describe('3-line TLE format', () => {
      test('should parse single named satellite correctly', () => {
        const tleText = `ISS (ZARYA)
1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;

        parseTle(tleText, 3, mockCallback);

        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith(
          'ISS (ZARYA)',
          '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990',
          '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891'
        );
      });

      test('should parse multiple named satellites correctly', () => {
        const tleText = `ISS (ZARYA)
1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891
HUBBLE SPACE TELESCOPE
1 20580U 90037B   21001.00000000 -.00000123  00000-0 -24531-5 0  9999
2 20580  28.4682  85.6398 0002453 323.7238  36.3626 15.09649053459444`;

        parseTle(tleText, 3, mockCallback);

        expect(mockCallback).toHaveBeenCalledTimes(2);
        
        expect(mockCallback).toHaveBeenNthCalledWith(1,
          'ISS (ZARYA)',
          '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990',
          '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891'
        );
        
        expect(mockCallback).toHaveBeenNthCalledWith(2,
          'HUBBLE SPACE TELESCOPE',
          '1 20580U 90037B   21001.00000000 -.00000123  00000-0 -24531-5 0  9999',
          '2 20580  28.4682  85.6398 0002453 323.7238  36.3626 15.09649053459444'
        );
      });

      test('should handle incomplete satellite data (not divisible by 3)', () => {
        const tleText = `ISS (ZARYA)
1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990`;
        
        parseTle(tleText, 3, mockCallback);
        // The function will still call the callback but with undefined for missing third line
        expect(mockCallback).toHaveBeenCalledWith(
          'ISS (ZARYA)',
          '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990',
          undefined
        );
      });

      test('should handle satellite names with special characters', () => {
        const tleText = `COSMOS 2251 DEB [+2954]
1 43013U 17073A   21001.00000000  .00001234  00000-0  12345-4 0  9999
2 43013  97.4516 123.4567 0001234 234.5678 125.4321 15.12345678123456`;

        parseTle(tleText, 3, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(
          'COSMOS 2251 DEB [+2954]',
          expect.stringContaining('43013U'),
          expect.stringContaining('43013')
        );
      });

      test('should handle empty satellite names', () => {
        const tleText = `
1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;

        parseTle(tleText, 3, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(
          '',
          '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990',
          '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891'
        );
      });
    });

    describe('edge cases and error conditions', () => {
      test('should handle mixed line endings (CRLF and LF)', () => {
        const tleText = "1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990\r\n2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891\n";

        parseTle(tleText, 2, mockCallback);

        expect(mockCallback).toHaveBeenCalledTimes(1);
      });

      test('should handle callback that throws error', () => {
        const errorCallback = jest.fn(() => {
          throw new Error('Callback error');
        });

        const tleText = `1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;

        expect(() => {
          parseTle(tleText, 2, errorCallback);
        }).toThrow('Callback error');
      });

      test('should handle very large TLE files', () => {
        // Generate a large TLE file with 1000 satellites
        let largeTleText = '';
        for (let i = 1; i <= 1000; i++) {
          const satNum = String(i).padStart(5, '0');
          largeTleText += `1 ${satNum}U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990\n`;
          largeTleText += `2 ${satNum}  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891\n`;
        }

        parseTle(largeTleText, 2, mockCallback);

        expect(mockCallback).toHaveBeenCalledTimes(1000);
      });

      test('should handle invalid linesPerSatellite parameter', () => {
        const tleText = `1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;

        // Test with invalid value (not 2 or 3) - the function still attempts to parse
        parseTle(tleText, 4, mockCallback);
        // With linesPerSatellite=4, it will treat line1 as first line and call callback
        expect(mockCallback).toHaveBeenCalledWith(
          '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990',
          '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891',
          undefined
        );

        mockCallback.mockClear();

        parseTle(tleText, 1, mockCallback);
        // With linesPerSatellite=1, i increments by 1 each time, so it will iterate through all lines
        // lines.length is 3 (including empty line), count = 2, so i goes 0, 1
        expect(mockCallback).toHaveBeenCalledTimes(1); // Only one call since count-1=1, i<1 only when i=0

        mockCallback.mockClear();

        // Test with empty text to avoid infinite loops
        parseTle('', 0, mockCallback);
        expect(mockCallback).not.toHaveBeenCalled();
      });
    });
  });

  describe('fetchTle', () => {
    let mockCallback;

    beforeEach(() => {
      mockCallback = jest.fn();
      fetch.mockClear();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    test('should fetch and parse TLE data successfully', async () => {
      const mockTleData = `ISS (ZARYA)
1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;

      const mockResponse = {
        text: jest.fn().mockResolvedValue(mockTleData)
      };

      fetch.mockResolvedValue(mockResponse);

      await fetchTle('https://example.com/tle.txt', 3, mockCallback);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('https://example.com/tle.txt');
      expect(mockResponse.text).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(
        'ISS (ZARYA)',
        '1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990',
        '2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891'
      );
    });

    test('should handle fetch network error', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      await expect(fetchTle('https://example.com/tle.txt', 2, mockCallback))
        .rejects.toThrow('Network error');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    test('should handle response.text() error', async () => {
      const mockResponse = {
        text: jest.fn().mockRejectedValue(new Error('Failed to read response'))
      };

      fetch.mockResolvedValue(mockResponse);

      await expect(fetchTle('https://example.com/tle.txt', 2, mockCallback))
        .rejects.toThrow('Failed to read response');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockResponse.text).toHaveBeenCalledTimes(1);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    test('should handle empty response', async () => {
      const mockResponse = {
        text: jest.fn().mockResolvedValue('')
      };

      fetch.mockResolvedValue(mockResponse);

      await fetchTle('https://example.com/tle.txt', 2, mockCallback);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockResponse.text).toHaveBeenCalledTimes(1);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    test('should work with different URLs', async () => {
      const mockTleData = `1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;

      const mockResponse = {
        text: jest.fn().mockResolvedValue(mockTleData)
      };

      fetch.mockResolvedValue(mockResponse);

      const testUrls = [
        'https://celestrak.com/NORAD/elements/stations.txt',
        'https://www.amsat.org/tle/current/nasabare.txt',
        'http://localhost:3000/tle/data.txt'
      ];

      for (const url of testUrls) {
        await fetchTle(url, 2, mockCallback);
        expect(fetch).toHaveBeenCalledWith(url);
      }

      expect(fetch).toHaveBeenCalledTimes(3);
    });

    test('should work with both 2-line and 3-line formats', async () => {
      // Test 2-line format
      const twoLineTle = `1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;

      const mockResponse2Line = {
        text: jest.fn().mockResolvedValue(twoLineTle)
      };

      fetch.mockResolvedValue(mockResponse2Line);

      await fetchTle('https://example.com/2line.txt', 2, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        '25544U',
        expect.stringContaining('25544U'),
        expect.stringContaining('25544')
      );

      mockCallback.mockClear();

      // Test 3-line format
      const threeLineTle = `ISS (ZARYA)
1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;

      const mockResponse3Line = {
        text: jest.fn().mockResolvedValue(threeLineTle)
      };

      fetch.mockResolvedValue(mockResponse3Line);

      await fetchTle('https://example.com/3line.txt', 3, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        'ISS (ZARYA)',
        expect.stringContaining('25544U'),
        expect.stringContaining('25544')
      );
    });

    test('should handle very large TLE files from network', async () => {
      // Generate a large TLE response
      let largeTleData = '';
      for (let i = 1; i <= 100; i++) {
        const satNum = String(i).padStart(5, '0');
        largeTleData += `SATELLITE ${i}\n`;
        largeTleData += `1 ${satNum}U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990\n`;
        largeTleData += `2 ${satNum}  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891\n`;
      }

      const mockResponse = {
        text: jest.fn().mockResolvedValue(largeTleData)
      };

      fetch.mockResolvedValue(mockResponse);

      await fetchTle('https://example.com/large.txt', 3, mockCallback);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledTimes(100);
    });

    test('should handle callback errors during network fetch', async () => {
      const mockTleData = `1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;

      const mockResponse = {
        text: jest.fn().mockResolvedValue(mockTleData)
      };

      fetch.mockResolvedValue(mockResponse);

      const errorCallback = jest.fn(() => {
        throw new Error('Processing error');
      });

      await expect(fetchTle('https://example.com/tle.txt', 2, errorCallback))
        .rejects.toThrow('Processing error');

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(errorCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration tests', () => {
    test('should work end-to-end with realistic TLE data', async () => {
      const realisticTleData = `NOAA 18
1 28654U 05018A   21001.83990347  .00000033  00000-0  35836-4 0  9996
2 28654  99.1430 157.4851 0013952 122.2574 238.0574 14.12501077804977
NOAA 19
1 33591U 09005A   21001.84124829  .00000072  00000-0  64334-4 0  9991
2 33591  99.1929 194.6424 0013862  99.0804 261.2480 14.12078301611789`;

      const mockResponse = {
        text: jest.fn().mockResolvedValue(realisticTleData)
      };

      fetch.mockResolvedValue(mockResponse);

      const satellites = [];
      const callback = (name, line1, line2) => {
        satellites.push({ name, line1, line2 });
      };

      await fetchTle('https://celestrak.com/NORAD/elements/weather.txt', 3, callback);

      expect(satellites).toHaveLength(2);
      expect(satellites[0].name).toBe('NOAA 18');
      expect(satellites[0].line1).toContain('28654U');
      expect(satellites[1].name).toBe('NOAA 19');
      expect(satellites[1].line1).toContain('33591U');
    });
  });
});
