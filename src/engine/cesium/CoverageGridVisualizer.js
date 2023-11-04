import { PointPrimitiveCollection, Color } from 'cesium';
import CompoundElementVisualizer from './CompoundElementVisualizer';
import { colorVisibleSatellites } from "./utils.js";

class CoverageGridVisualizer extends CompoundElementVisualizer {
  constructor(viewer, universe, orbit='GEO', alpha=0.3) {
    super()
    this._objects = []
    this._show = false
    this.viewer = viewer
    this.universe = universe
    this._altitude = 384400.0e3
    this.orbit = orbit
    this._alpha = alpha

    this._points = viewer.scene.primitives.add(new PointPrimitiveCollection());
  }

  initOrShowGridOfObjects() {

    if(this._objects.length === 0) {
      for(let lat = -90; lat < 90; lat += 1) {
        for(let lon = -179.5; lon <= 179.5; lon += 1) { // don't start at -180, weird aliasing in 2D
          const g = this.universe.addGroundSite('grid ' + lat + ':' + lon, lat, lon, this._altitude);
          const description = undefined;
          const color = Color.RED.withAlpha(this._alpha);
          this._objects.push(g);
          const e = this._points.add({
            position: g.position,
            pixelSize: 5,
            color: color,
            outlineColor: color,
            show: true
          })
          this._entities.push(e)
          // // console.log(e)
          g.visualizer = {
            point: e
          }
        }
      }
    }
    this._points.show = true
  }

  set alpha(value) {
    if(this._alpha === value)
      return;

    this._alpha = value;
    this._entities.forEach(e => {
      e.color.alpha = this._alpha;
      e.outlineColor.alpha = this._alpha;
    });
  }

  set orbit(value) {
    if(this._orbit === value)
      return;

    this._orbit = value;
    if (this._orbit === 'LEO')
      this._altitude = 600e3;
    else if(this._orbit === 'MEO')
      this._altitude = 42164.0e3 / 2 - 6378.1e3;
    else if(this._orbit === 'GEO')
      this._altitude = 42164.0e3 - 6378.1e3;
    else if(this._orbit === 'LUNAR')
      this._altitude = 384400.0e3;

    this._objects.forEach(obj => {
      obj.altitude = this._altitude;
      obj.visualizer.point.position = obj.position;
    });
  }

  set show(value) {
    if(this._show === value)
      return;

    this._show = value;
    
    const ec = this.viewer.entities
    ec.suspendEvents()
    if(this._show) {
      this.initOrShowGridOfObjects()
    } else {
      this._points.show = false
    }
    ec.resumeEvents()
  }

  update(time) {
    colorVisibleSatellites(this.universe, this.universe._observatories, time, this._objects, this.alpha, false);
  }


}

export default CoverageGridVisualizer