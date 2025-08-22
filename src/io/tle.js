/**
 * Fetches Two-Line Element (TLE) data from a URL and parses it.
 * 
 * TLE format is a standard way to convey orbital elements for Earth-orbiting objects.
 * This function downloads TLE data from a remote source and delegates parsing to parseTle.
 * 
 * @async
 * @function fetchTle
 * @param {string} url - The URL to fetch TLE data from
 * @param {number} linesPerSatellite - Number of lines per satellite entry (2 for standard TLE format, 3 for named TLE format)
 * @param {function} callback - Callback function called for each satellite with (name, line1, line2) parameters
 * @throws {Error} Network errors, fetch failures, or invalid response
 * @returns {Promise<void>} Promise that resolves when all TLE data has been fetched and parsed
 * 
 * @example
 * // Fetch standard 2-line TLE data
 * await fetchTle('https://example.com/tle.txt', 2, (name, line1, line2) => {
 *   console.log(`Satellite: ${name}`);
 *   console.log(`Line 1: ${line1}`);
 *   console.log(`Line 2: ${line2}`);
 * });
 * 
 * @example
 * // Fetch 3-line TLE data with satellite names
 * await fetchTle('https://example.com/named_tle.txt', 3, (name, line1, line2) => {
 *   // Process named TLE data
 * });
 */
async function fetchTle(url, linesPerSatellite, callback) {
  const response = await fetch(url);
  const text = await response.text();

  parseTle(text, linesPerSatellite, callback);
}

/**
 * Parses Two-Line Element (TLE) text data and extracts satellite orbital elements.
 * 
 * TLE format stores orbital elements in a standardized format:
 * - 2-line format: Each satellite has 2 lines of orbital data
 * - 3-line format: Each satellite has a name line followed by 2 lines of orbital data
 * 
 * The function processes the text line by line, extracting satellite identifiers
 * and their corresponding orbital element lines according to the specified format.
 * 
 * @function parseTle
 * @param {string} text - The TLE text data to parse
 * @param {number} linesPerSatellite - Number of lines per satellite (2 or 3)
 *   - 2: Standard TLE format (line1, line2) - satellite name extracted from line 1
 *   - 3: Named TLE format (name, line1, line2) - explicit satellite name
 * @param {function} callback - Function called for each satellite with parameters:
 *   - name {string}: Satellite name/identifier
 *   - line1 {string}: First line of orbital elements
 *   - line2 {string}: Second line of orbital elements
 * 
 * @example
 * // Parse standard 2-line TLE format
 * const tleText = `1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
 * 2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;
 * 
 * parseTle(tleText, 2, (name, line1, line2) => {
 *   console.log(`Satellite: ${name}`); // "25544U"
 * });
 * 
 * @example
 * // Parse 3-line TLE format with names
 * const namedTleText = `ISS (ZARYA)
 * 1 25544U 98067A   21001.00000000  .00002182  00000-0  40768-4 0  9990
 * 2 25544  51.6461 339.2971 0002297  68.6102 207.9034 15.48919103456891`;
 * 
 * parseTle(namedTleText, 3, (name, line1, line2) => {
 *   console.log(`Satellite: ${name}`); // "ISS (ZARYA)"
 * });
 */
function parseTle(text, linesPerSatellite, callback) {
  const lines = text.split('\n');
  const count = lines.length - 1;

  for (let i = 0; i < count; i += linesPerSatellite) {
    let line1, line2, line3 = '';
    if (linesPerSatellite === 2) {
      line1 = lines[i].slice(2, 8);
      line2 = lines[i];
      line3 = lines[i+1];
    } else {
      line1 = lines[i].trim();
      line2 = lines[i+1];
      line3 = lines[i+2];
    }

    callback(line1, line2, line3)
  }
}

export {
  fetchTle,
  parseTle
}
