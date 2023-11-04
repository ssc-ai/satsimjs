import { Color, defaultValue, SampledPositionProperty, JulianDate, Cartesian3, LagrangePolynomialApproximation, defined, ReferenceFrame, Matrix3, Quaternion, CallbackProperty } from 'cesium'
import { CallbackPositionProperty, ElectroOpicalSensor } from '../../index.js'
import { southEastZenithToAzEl } from '../dynamics/gimbal.js'

function toSampledPositionProperty(object, context, start, stop, step) {
  start = JulianDate.addSeconds(start, -step, new JulianDate())
  stop = JulianDate.addSeconds(stop, step, new JulianDate())
  const prop = new SampledPositionProperty()
  let current = JulianDate.clone(start)
  let i = 0
  while(JulianDate.lessThan(current, stop)) {
    object.update(current, context)
    prop.addSample(current.clone(), Cartesian3.clone(object.position))
    JulianDate.addSeconds(current, step, current)
    i = i + 1
  }
  prop.setInterpolationOptions({
    interpolationDegree : 3,
    interpolationAlgorithm : LagrangePolynomialApproximation
  });
  return prop
}


function createObjectPositionProperty(object, universe, viewer) {
  return new CallbackPositionProperty(function(time, result) {
    if(!defined(this.lastReferenceFrameView)) {
      this.lastReferenceFrameView = viewer.referenceFrameView
    } else if(this.lastReferenceFrameView !== viewer.referenceFrameView) {
      this.lastReferenceFrameView = viewer.referenceFrameView
    }

    object.update(time, universe)
    result = Cartesian3.clone(object.position, result)
    if (viewer.referenceFrameView === ReferenceFrame.FIXED && object.referenceFrame === ReferenceFrame.INERTIAL) {
      universe.earth.update(time, universe)
      universe.earth.transformPointFromWorld(result, result)
    } else if (viewer.referenceFrameView === ReferenceFrame.INERTIAL && object.referenceFrame === ReferenceFrame.FIXED) {
      universe.earth.update(time, universe)
      universe.earth.transformPointToWorld(result, result)
    }
    return result
  }, false, () => viewer.referenceFrameView)
}


function getObjectPositionInCesiumFrame(viewer, universe, object, time, result) {
  result = Cartesian3.clone(object.position, result)
  if (object.referenceFrame === ReferenceFrame.INERTIAL) {
    universe.earth.update(time, universe)
    universe.earth.transformPointFromWorld(result, result)
  }
  // TODO - handle other reference frames
  return result
}


function createObjectOrientationProperty(object, universe) {
  return new CallbackProperty(function(time, result) {
    object.update(time, universe)
    let m;
    if (object instanceof ElectroOpicalSensor) {
      universe.earth.update(time, universe)
      let x = object.transformVectorTo(universe.earth, new Cartesian3(0, 0, -1))
      let y = object.transformVectorTo(universe.earth, Cartesian3.UNIT_Y)
      let z = object.transformVectorTo(universe.earth, Cartesian3.UNIT_X)
      m = new Matrix3(x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z)
    } else if (object.referenceFrame === ReferenceFrame.INERTIAL) {
      universe.earth.update(time, universe)
      let x = universe.earth.transformVectorFromWorld(Cartesian3.UNIT_Y)
      let y = universe.earth.transformVectorFromWorld(Cartesian3.UNIT_X)
      let z = universe.earth.transformVectorFromWorld(new Cartesian3(0, 0, -1))
      m = new Matrix3(x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z)
    } else {
      universe.earth.update(time, universe)
      let x = object.transformVectorTo(universe.earth, Cartesian3.UNIT_X)
      let y = object.transformVectorTo(universe.earth, Cartesian3.UNIT_Y)
      let z = object.transformVectorTo(universe.earth, Cartesian3.UNIT_Z)
      m = new Matrix3(x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z)
    }
    Quaternion.fromRotationMatrix(m, result)
    return result
  }, false)
}


function colorVisibleSatellites(universe, observatories, time, objects=undefined, alpha=0.5, showNonVisible=false) {

  function getPoint(o) {
    if(defined(o.visualizer.point)) {
      return o.visualizer.point
    } else if(defined(o.visualizer.point2)) {
      return o.visualizer.point2
    } else {
      return undefined
    }
  }

  const [R, O, Y, G] = [Color.RED.withAlpha(alpha), Color.ORANGE.withAlpha(alpha), Color.YELLOW.withAlpha(alpha), Color.GREEN.withAlpha(alpha)]
  const trackables = defaultValue(objects, universe._trackables)
  trackables.forEach((o) => {
    const point = getPoint(o)
    if(showNonVisible) {
      if(!Color.equals(point.color._value, R)) {
        point.color = R
        point.outlineColor = R
      }
    } else {
      if(defined(point.show)) {
        if(point.show._value !== false) {
          point.show = false;
        }
      } else {
        point.show = false;
      }
    }
  });  

  const counts = {}
  observatories.forEach((o) => {
    applyToVisible(universe, o, time, objects, (sat) => {
      const point = getPoint(sat)
      if(point.show._value !== true)
        point.show = true;

      if(counts[sat.name] === undefined) {
        counts[sat.name] = 0
      }
      counts[sat.name] += 1
      const count = counts[sat.name]
      if(count == 1) {
        point.color = showNonVisible ? O : R
        point.outlineColor = showNonVisible ? O : R
      } else if(count == 2) {
        point.color = Y
        point.outlineColor = Y
      } else if(count > 2) {
        point.color = G
        point.outlineColor = G
      }
    });
  });
}



function applyToVisible(universe, observatory, time, objects, callback) {
  const field_of_regard = observatory.sensor.field_of_regard;
  observatory.site.update(time, universe)
  const localPos = new Cartesian3();
  objects.forEach((sat) => {
    sat.update(time, universe)
    observatory.site.transformPointFromWorld(sat.worldPosition, localPos);
    let [az, el, r] = southEastZenithToAzEl(localPos)
    if(defined(field_of_regard)) {
      for(let i = 0; i < field_of_regard.length; i ++) {
        const f = field_of_regard[i];
        if(az > f.clock[0] && az < f.clock[1] && el > f.elevation[0] && el < f.elevation[1]) {
          callback(sat);
          break;
        }
      }
    }
  });
}

export {
  toSampledPositionProperty,
  createObjectPositionProperty,
  createObjectOrientationProperty,
  colorVisibleSatellites,
  getObjectPositionInCesiumFrame
}