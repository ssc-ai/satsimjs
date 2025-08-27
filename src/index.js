globalThis.SATSIM_VERSION = "0.9.0";

export { default as Universe } from './engine/Universe.js'

export { default as Node } from './engine/graph/Node.js'
export { default as Group } from './engine/graph/Group.js'
export { default as TransformGroup } from './engine/graph/TransformGroup.js'

export { default as AzElGimbal } from './engine/objects/AzElGimbal.js'
export { default as Earth } from './engine/objects/Earth.js'
export { default as EarthGroundStation } from './engine/objects/EarthGroundStation.js'
export { default as ElectroOpicalSensor } from './engine/objects/ElectroOpticalSensor.js'
export { default as EphemerisObject } from './engine/objects/EphemerisObject.js'
export { default as Gimbal } from './engine/objects/Gimbal.js'
export { default as LagrangeInterpolatedObject } from './engine/objects/LagrangeInterpolatedObject.js'
export { default as SGP4Satellite } from './engine/objects/SGP4Satellite.js'
export { default as SimObject } from './engine/objects/SimObject.js'
export { default as TwoBodySatellite } from './engine/objects/TwoBodySatellite.js'
export { default as Observatory } from './engine/objects/Observatory.js'

export { default as CallbackPositionProperty } from './engine/cesium/CallbackPositionProperty.js'
export { default as CompoundElementVisualizer } from './engine/cesium/CompoundElementVisualizer.js'
export { default as CoverageGridVisualizer } from './engine/cesium/CoverageGridVisualizer.js'
export { default as GeoBeltVisualizer } from './engine/cesium/GeoBeltVisualizer.js'
export { default as SensorFieldOfRegardVisualizer } from './engine/cesium/SensorFieldOfRegardVisualizer.js'
export { default as SensorFieldOfVIewVisualizer } from './engine/cesium/SensorFieldOfVIewVisualizer.js'

export { default as InfoBox } from './widgets/InfoBox.js'
export { default as Toolbar } from './widgets/Toolbar.js'
export { createViewer, mixinViewer } from './widgets/Viewer.js'

export { fetchTle, parseTle } from './io/tle.js'
export { southEastZenithToAzEl, spaceBasedToAzEl } from './engine/dynamics/gimbal.js'
export { getVisibility } from './engine/geometry/visibility.js'

export { applyIau2006XysDataPatch } from './engine/cesium/Iau2006XysDataLocal.js'

// Export commonly used Cesium classes for CDN usage
export { 
  Math as CesiumMath,
  JulianDate, 
  ClockStep,
  ClockRange,
  Cartesian3,
  Cartesian2,
  Color,
  Matrix3,
  Matrix4,
  Quaternion,
  HeadingPitchRoll,
  Transforms,
  Ellipsoid,
  EllipsoidGeodesic,
  CesiumTerrainProvider,
  createWorldTerrainAsync,
  Ion
} from 'cesium';