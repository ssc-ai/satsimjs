import { Universe, createViewer } from "../src/index.js";
import { Math as CMath, JulianDate, ClockStep } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "cesium/Build/Cesium/Widgets/InfoBox/InfoBoxDescription.css"
import "./index.css";

CMath.setRandomNumberSeed(42);

const universe = new Universe();
const viewer = createViewer("cesiumContainer", universe, {
  showWeatherLayer: false,
  showNightLayer: false,
});
const start = JulianDate.now();
viewer.clock.startTime = start.clone();
viewer.clock.clockStep = ClockStep.SYSTEM_CLOCK;


viewer.scene.preUpdate.addEventListener((scene, time) => {
  // do something  
});