import { Universe, createViewer, fetchTle, getVisibility, southEastZenithToAzEl } from "../../../src/index.js";
import { Math as CMath, JulianDate, viewerCesiumInspectorMixin, ClockRange, ClockStep, defined, Color, Cartesian3, defaultValue, Viewer, CallbackProperty } from "cesium";

function generateSatelliteVisualizer(universe, viewer, satellite, html, showPath=false, showLabel=false, color=null) {

  const description = new CallbackProperty(() => {

    const visibility = getVisibility(universe, viewer, universe._observatories, satellite);

  const visRows = visibility.map((v) => {
      const brightness = defined(v.mv) ? v.mv.toFixed(1) : '???';
      const phase = defined(v.phaseAngle) ? v.phaseAngle.toFixed(1) : '—';
      const sensor = (v.sensor !== undefined && v.sensor !== null) ? String(v.sensor) : '—';
      const rate = defined(v.angRateArcsecPerSec) ? v.angRateArcsecPerSec.toFixed(1) : '—';
      return `
        <tr>
          <td>${sensor}</td>
          <td>${v.visible ? 'Yes' : '-'}</td>
      <td style="text-align:right">${defined(v.el) ? v.el.toFixed(1) : '—'}°</td>
          <td style="text-align:right">${phase}°</td>
          <td style="text-align:right">${brightness}</td>
          <td style="text-align:right">${rate} "/s</td>
        </tr>`;
    }).join('');

    const visibilityTable = `
      <table style="border-collapse:collapse; width:100%; margin-top:4px">
        <thead>
          <tr>
            <th style="text-align:left; padding-bottom:2px">Sensor</th>
            <th style="text-align:left; padding-bottom:2px">Visible</th>
            <th style="text-align:right; padding-bottom:2px">El</th>
            <th style="text-align:right; padding-bottom:2px">Solar</th>
            <th style="text-align:right; padding-bottom:2px">VMag</th>
            <th style="text-align:right; padding-bottom:2px">Rate</th>
          </tr>
        </thead>
        <tbody>
          ${visRows}
        </tbody>
      </table>`;

    return `<div><b>${satellite.name}</b><br><br>
    ${html}<br>
    Visibility: ${visibility.filter((v) => v.visible).length} / ${universe._observatories.length}<br>
    ${visibilityTable}
    <br></div>
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