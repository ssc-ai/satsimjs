import { Cartesian3, Math as CMath } from 'cesium';

function southEastZenithToAzEl(cartesian3) {
  let az, el;
  if (cartesian3.x === 0.0 && cartesian3.y === 0.0) {
    az = 0.0;
  } else {
    az = Math.atan2(cartesian3.y, -cartesian3.x);
    if (az < 0.0) {
      az += CMath.TWO_PI;
    }
  }

  const mag = Cartesian3.magnitude(cartesian3);
  if (mag < 1e-9) {
    el = 0.0;
  } else {
    el = Math.asin(cartesian3.z / mag);
  }

  return [az * CMath.DEGREES_PER_RADIAN, el * CMath.DEGREES_PER_RADIAN, mag];
}

function spaceBasedToAzEl(cartesian3) {
  let az, el;
  if (cartesian3.x === 0 && cartesian3.y === 0) {
    az = 0.0;
  } else {
    az = Math.atan2(cartesian3.y, -cartesian3.x);
    if (az < 0.0) {
      az += CMath.TWO_PI;
    }
  }

  const mag = Cartesian3.magnitude(cartesian3);
  const r = Math.sqrt(cartesian3.x * cartesian3.x + cartesian3.y * cartesian3.y);
  if (Math.abs(r) < 1e-9 && Math.abs(cartesian3.z) < 1e-9) {
    el = 0.0;
  } else {
    el = Math.atan2(r, -cartesian3.z);
  }

  return [az * CMath.DEGREES_PER_RADIAN, el * CMath.DEGREES_PER_RADIAN, mag];
}

export {
  southEastZenithToAzEl,
  spaceBasedToAzEl
}