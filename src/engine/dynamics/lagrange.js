import { JulianDate, LagrangePolynomialApproximation, Cartesian3 } from 'cesium'

const _r = []
function lagrange_fast(times, positions, t, result) {

  _r.length = 0
  LagrangePolynomialApproximation.interpolateOrderZero(t, times, positions, 3, _r)
  return Cartesian3.fromArray(_r, 0, result)
}


function lagrange(times, positions, epoch, time, update, result, interval = 180) {

  let delta = JulianDate.secondsDifference(time, epoch)
  let numPoints = 7
  if (times.length < numPoints || delta < times[0] || delta > times[times.length - 1]) {
    initialize(times, positions, epoch, time, update, interval, numPoints)
    delta = JulianDate.secondsDifference(time, epoch)
  }

  return lagrange_fast(times, positions, delta, result)
}


function initialize(times, positions, epoch, time, update, interval, numPoints) {

  times.length = 0
  positions.length = 0

  let t1 = JulianDate.clone(time)
  JulianDate.addSeconds(t1, -(numPoints - 1) / 2 * interval, t1)
  for (let i = 0; i < numPoints; i++) {
    JulianDate.addSeconds(t1, interval, t1)

    if (i === 0)
      JulianDate.clone(t1, epoch)

    const p = update(t1)
    positions.push(p.x)
    positions.push(p.y)
    positions.push(p.z)
    times.push(interval * i)
  }
}

export {
  lagrange_fast,
  lagrange,
  initialize
}