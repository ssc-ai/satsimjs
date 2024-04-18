import { PointPrimitiveCollection, Color, Viewer } from 'cesium';
import CompoundElementVisualizer from './CompoundElementVisualizer.js';
import EarthGroundStation from '../objects/EarthGroundStation.js';
import { colorVisibleSatellites } from "./utils.js";
import Universe from '../Universe.js';

/**
 * A visualizer for a grid of ground sites that can be used to visualize satellite coverage.
 * @extends CompoundElementVisualizer
 */
class CoverageGridVisualizer extends CompoundElementVisualizer {
  /**
   * Creates a new CoverageGridVisualizer.
   * @param {Viewer} viewer - The Cesium viewer.
   * @param {Universe} universe - The universe containing the ground sites.
   * @param {string} [orbit='GEO'] - The orbit type to use for the ground sites.
   * @param {number} [alpha=0.3] - The alpha value to use for the ground site colors.
   */
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

  /**
   * Initializes or shows the grid of ground sites.
   */
  initOrShowGridOfObjects() {

    if(this._objects.length === 0) {
      for(let lat = -90; lat < 90; lat += 1) {
        for(let lon = -179.5; lon <= 179.5; lon += 1) { // don't start at -180, weird aliasing in 2D
          const site = new EarthGroundStation(lat, lon, this._altitude, 'grid ' + lat + ':' + lon)
          site.attach(this.universe.earth)
          this._objects.push(site);

          //          this.universe.addGroundSite('grid ' + lat + ':' + lon, lat, lon, this._altitude, false);
          const description = undefined;
          const color = Color.RED.withAlpha(this._alpha);
          const e = this._points.add({
            position: site.position,
            pixelSize: 5,
            color: color,
            outlineColor: color,
            show: true
          })
          this._entities.push(e)
          // // console.log(e)
          site.visualizer = {
            point: e
          }
        }
      }
    }
    this._points.show = true
  }

  /**
   * Sets the alpha value for the ground site colors.
   * @param {number} value - The new alpha value.
   */
  set alpha(value) {
    if(this._alpha === value)
      return;

    this._alpha = value;
    this._entities.forEach(e => {
      e.color.alpha = this._alpha;
      e.outlineColor.alpha = this._alpha;
    });
  }

  /**
   * Sets the orbit type for the ground sites.
   * @param {string} value - The new orbit type.
   */
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

  /**
   * Sets whether or not to show the ground site grid.
   * @param {boolean} value - Whether or not to show the ground site grid.
   */
  set show(value) {
    if(this._show === value)
      return;

    this._show = value;    
    if(this._show) {
      this.initOrShowGridOfObjects()
    } else {
      this._points.show = false
    }
  }

  /**
   * Updates the ground site colors based on the visible satellites.
   * @param {JulianDate} time - The current time.
   */
  update(time) {
    colorVisibleSatellites(this.universe, this.universe._observatories, time, this._objects, this._alpha, false);
  }


}

export default CoverageGridVisualizer