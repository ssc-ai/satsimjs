import { Transforms, JulianDate } from 'cesium';
import { applyIau2006XysDataPatch } from '../src/engine/cesium/Iau2006XysDataLocal.js';

describe('Iau2006XysDataLocal', () => {
  test('computes XYS sample after preloading', async () => {
    applyIau2006XysDataPatch();
    const date = JulianDate.fromDate(new Date('2020-01-01T00:00:00Z'));
    await Transforms.iau2006XysData.preload(
      date.dayNumber,
      date.secondsOfDay,
      date.dayNumber + 1,
      date.secondsOfDay
    );
    const sample = Transforms.iau2006XysData.computeXysRadians(
      date.dayNumber,
      date.secondsOfDay
    );
    expect(sample).toBeDefined();
    expect(typeof sample.x).toBe('number');
    expect(typeof sample.y).toBe('number');
    expect(typeof sample.s).toBe('number');
  });
});
