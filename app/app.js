import { Universe, applyIau2006XysDataPatch } from "../src/index.js";
import { JulianDate } from "cesium";

applyIau2006XysDataPatch();  // required when running in nodejs

const universe = new Universe();
const start = JulianDate.now();
const end = JulianDate.addSeconds(start, 60*60, new JulianDate());
universe.update(start);
console.log('starting simulation at', start.toString());

// Run the simulation from start to end
for (let t = start.clone(); JulianDate.compare(t, end) < 0; t = JulianDate.addSeconds(t, 60, new JulianDate())) {
    universe.update(t);
    console.log(universe._earth.transform.toString());
}

console.log('simulation complete at', end.toString());
