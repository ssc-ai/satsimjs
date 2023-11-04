import { defaultValue, Color, Cartesian3, Math as CMath } from 'cesium';
import CompoundElementVisualizer from './CompoundElementVisualizer';

class GeoBeltVisualizer extends CompoundElementVisualizer {
  constructor(viewer, color) {
    super(defaultValue(color, Color.WHITE), 0.1, 0.2)

    const e = viewer.entities.add({
      name: 'GEO Belt',
      position: Cartesian3.ZERO.clone(),
      ellipsoid: {
        radii: new Cartesian3(42164000.0, 42164000.0, 42164000.0),
        minimumClock: CMath.toRadians(0),
        maximumClock: CMath.toRadians(360),
        minimumCone: CMath.toRadians(90.0-20.0),
        maximumCone: CMath.toRadians(90.0+20.0),
        material: Color.WHITE.withAlpha(0.1),
        outlineColor: Color.WHITE.withAlpha(0.2),
        outline: true,
        slicePartitions: 36,
        stackPartitions: 20
      },
      allowPicking: false
    })

    this._entities.push(e)
  }
}

export default GeoBeltVisualizer