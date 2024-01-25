import { defined, Cartesian3 } from 'cesium';
import { southEastZenithToAzEl } from '../dynamics/gimbal.js'
import { calculateTargetBrightness } from './photometry.js';

function getVisibility(universe, viewer, observatories, sat) {
  let visibility = []
  for (let observatory of observatories) {
    const localPos = new Cartesian3();
    const field_of_regard = observatory.sensor.field_of_regard;
    sat.update(viewer.clock.currentTime, universe)
    observatory.site.transformPointFromWorld(sat.worldPosition, localPos);
    let [az, el, r] = southEastZenithToAzEl(localPos)
    let visible = false
    if(defined(field_of_regard)) {
      for(let i = 0; i < field_of_regard.length; i ++) {
        const f = field_of_regard[i];
        if(az > f.clock[0] && az < f.clock[1] && el > f.elevation[0] && el < f.elevation[1]) {
          visible = true
        }
      }
    }
    visibility.push({...{
      sensor: observatory.sensor.name,
      az,
      el,
      r,
      visible
    }, ...calculateTargetBrightness(observatory.site, sat, universe.sun) } )
  }
  return visibility
}

export { getVisibility }