import { Universe, createViewer, fetchTle, getVisibility, southEastZenithToAzEl } from "../../../src/index.js";
import { Math as CMath, JulianDate, viewerCesiumInspectorMixin, ClockRange, ClockStep, defined, Color, Cartesian3, defaultValue, Viewer, CallbackProperty } from "cesium";

function generateSatelliteVisualizer(universe, viewer, satellite, html, showPath=false, showLabel=false, color=null) {

  const description = new CallbackProperty(() => {

    const visibility = getVisibility(universe, viewer, universe._observatories, satellite);
    const visibilityText = visibility.map((v) => {
      const brightness = defined(v.mv) ? v.mv.toFixed(1) : '???'
      return `• ${v.sensor}: ${v.visible ? 'Visible' : 'Not visible'}, Solar: ${v.phaseAngle.toFixed(1)}°, Brightness: ${brightness} mv`
    }).join('<br>');

    return `<div><b>${satellite.name}</b><br><br>
    ${html}<br>
    Visibility: ${visibility.filter((v) => v.visible).length} / ${universe._observatories.length}<br>${visibilityText}<br><br></div>
    Orbit:<br>
    • Period: ${(satellite.period / 60).toFixed(2)} min<br>
    • Eccentricity: ${(satellite.eccentricity).toFixed(9)}<br>`
  }, false)

  if(!defined(color))
    color = new Color.fromRandom({alpha: 1.0});

  viewer.addObjectVisualizer(satellite, description, {
    path: {
      show: showPath,
      leadTime: satellite.period / 2,
      trailTime: satellite.period / 2,
      resolution: satellite.period / (500 / (1 - satellite.eccentricity)), // make elliptical orbits look better
      material: color,
      width: 1      
    },
    point: { 
      pixelSize: Math.random() * 3 + 2,
      color: color,
      outlineColor: color,
      show: true
    },
    label: showLabel ? {
      text: satellite.name,
      show: showLabel,
      font: '12px sans-serif',
      fillColor: color,
    } : undefined
  });
}

function generateGroundObservatoryVisualizer(universe, viewer, o) {
  const description = `<div><b>${o.site.name}</b><br><br>Latitude: ${o.site.latitude} deg<br>Longitude: ${o.site.longitude} deg<br>Altitude: ${o.site.altitude} m<br><br></div>`;
  viewer.addObservatoryVisualizer(o, description);
}

export {
  generateSatelliteVisualizer,
  generateGroundObservatoryVisualizer
}