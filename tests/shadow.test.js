const { Cartesian3, JulianDate } = require('cesium');
const { getShadowStatus, ShadowState } = require('../src/engine/geometry/shadow.js');

const AU_METERS = 149597870700;
const EARTH_RADIUS = 6378137;

function createSun() {
  return {
    update: jest.fn(),
    worldPosition: new Cartesian3(AU_METERS, 0, 0),
  };
}

function createObject(position) {
  return {
    update: jest.fn(),
    get worldPosition() {
      return position;
    },
  };
}

describe('shadow geometry', () => {
  const time = JulianDate.now();

  test('classifies sunlit objects on the solar hemisphere', () => {
    const sun = createSun();
    const satellite = createObject(new Cartesian3(7000000, 0, 0));

    const result = getShadowStatus(sun, [satellite], time);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(ShadowState.SUNLIT);
  });

  test('classifies objects in the umbra core', () => {
    const sun = createSun();
    const behindEarth = new Cartesian3(-2 * EARTH_RADIUS, 0, 0);
    const satellite = createObject(behindEarth);

    const [status] = getShadowStatus(sun, [satellite], time);

    expect(status).toBe(ShadowState.UMBRA);
  });

  test('classifies objects in the penumbra region', () => {
    const sun = createSun();
    const geostatAltitude = 42164000;
    const penumbraPosition = new Cartesian3(-geostatAltitude, EARTH_RADIUS, 0);
    const satellite = createObject(penumbraPosition);

    const [status] = getShadowStatus(sun, [satellite], time);

    expect(status).toBe(ShadowState.PENUMBRA);
  });
});
