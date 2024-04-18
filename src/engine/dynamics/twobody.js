import { Cartesian3 } from 'cesium'

/**
 * Calculates the c2 and c3 functions for use in the universal variable calculation of z.
 * @param {number} znew - The z variable.
 * @returns {Array} An array containing the values of c2 and c3.
 */
function findc2c3(znew) {
  const small = 0.000001;
  let c2new, c3new;

  if (znew > small) {
    const sqrtz = Math.sqrt(znew);
    c2new = (1.0 - Math.cos(sqrtz)) / znew;
    c3new = (sqrtz - Math.sin(sqrtz)) / Math.pow(sqrtz, 3);
  } else if (znew < -small) {
    const sqrtz = Math.sqrt(-znew);
    c2new = (1.0 - Math.cosh(sqrtz)) / znew;
    c3new = (Math.sinh(sqrtz) - sqrtz) / Math.pow(sqrtz, 3);
  } else {
    c2new = 0.5;
    c3new = 1.0 / 6.0;
  }

  return [c2new, c3new];
}

/**
 * Calculates the position and velocity vectors at a given time using the Vallado algorithm.
 * Solves keplers problem for orbit determination and returns a future geocentric equatorial
 * position and velocity vector. The solution uses universal variables.
 * @param {number} k - The gravitational parameter.
 * @param {Cartesian3} ro - The initial position.
 * @param {Cartesian3} vo - The initial velocity.
 * @param {number} dtseco - The length of time to propagate in seconds.
 * @param {number} numiter - The maximum number of iterations for convergence.
 * @returns {Object} An object containing the position and velocity vectors.
 */
function vallado(k, ro, vo, dtseco, numiter) {
  const twopi = Math.PI * 2;
  const small = 1e-10;          // Assuming a small value for comparisons
  const infinite = 999999.9;    // Representation of infinity
  let smu = Math.sqrt(k);
  let dtsec = dtseco;
  let ktr = 0;
  let xold = 0.0;
  let znew = 0.0;
  let xnew;
  let c2new, c3new;

  let r = new Cartesian3();
  let v = new Cartesian3();

  if (Math.abs(dtseco) > small) {
    const magro = mag(ro);
    const magvo = mag(vo);
    const rdotv = dot(ro, vo);
    let sme = (magvo ** 2) * 0.5 - (k / magro);
    let alpha = -sme * 2.0 / k;
    let a;

    if (Math.abs(sme) > small) {
      a = -k / (2.0 * sme);
    } else {
      a = infinite;
    }

    if (Math.abs(alpha) < small) { // Parabola
      alpha = 0.0;
    }

    // Initial guess for x
    if (alpha >= small) {
      // Ellipse
      const period = twopi * Math.sqrt(Math.abs(a) ** 3 / k);
      if (Math.abs(dtseco) > Math.abs(period)) {
        dtsec = dtseco % period;
      }
      xold = smu * dtsec * alpha;
    } else if (Math.abs(alpha) < small) {
      // Parabola
      const h = cross(ro, vo);
      const magh = mag(h);
      const p = magh ** 2 / k;
      const s = 0.5 * (Math.PI / 2 - Math.atan(3.0 * Math.sqrt(k / (p ** 3)) * dtsec));
      const w = Math.atan(Math.tan(s) ** (1 / 3));
      xold = Math.sqrt(p) * (2.0 * cot(2.0 * w));
      alpha = 0.0;
    } else {
      // Hyperbola
      const temp = -2.0 * k * dtsec / (a * (rdotv + Math.sign(dtsec) * Math.sqrt(-k * a) * (1.0 - magro * alpha)));
      xold = Math.sign(dtsec) * Math.sqrt(-a) * Math.log(temp);
    }

    let dtnew = -10.0;
    let xoldsqrd, rval;

    // Iteration for finding new value for x
    while ((Math.abs(dtnew / smu - dtsec) >= small) && (ktr < numiter)) {
      xoldsqrd = xold * xold;
      znew = xoldsqrd * alpha;
      [c2new, c3new] = findc2c3(znew);

      rval = xoldsqrd * c2new + rdotv / smu * xold * (1.0 - znew * c3new) + magro * (1.0 - znew * c2new);
      dtnew = xoldsqrd * xold * c3new + rdotv / smu * xoldsqrd * c2new + magro * xold * (1.0 - znew * c3new);

      // Calculate new value for x
      const temp1 = (dtsec * smu - dtnew) / rval;
      xnew = xold + temp1;

      if (xnew < 0.0 && dtsec > 0.0) {
        xnew = xold * 0.5;
      }

      ktr++;
      xold = xnew;
    }

    if (ktr >= numiter) {
      console.log('Convergence not reached in ' + numiter + ' iterations');
    } else {
      // Calculate position and velocity vectors at new time
      const xnewsqrd = xnew * xnew;
      const f = 1.0 - (xnewsqrd * c2new / magro);
      const g = dtsec - xnewsqrd * xnew * c3new / Math.sqrt(k);

      r.x = f * ro.x + g * vo.x;
      r.y = f * ro.y + g * vo.y;
      r.z = f * ro.z + g * vo.z;

      const magr = mag(r);
      const gdot = 1.0 - (xnewsqrd * c2new / magr);
      const fdot = (Math.sqrt(k) * xnew / (magro * magr)) * (znew * c3new - 1.0);

      v.x = fdot * ro.x + gdot * vo.x;
      v.y = fdot * ro.y + gdot * vo.y;
      v.z = fdot * ro.z + gdot * vo.z;
    }
  } else {
    r = Cartesian3.clone(ro, r);
    v = Cartesian3.clone(vo, v);
  }

  return {
    "position": r,
    "velocity": v
  }
}

/**
 * Calculates the eccentricity of an orbit given the gravitational parameter, position, and velocity vectors.
 * @param {number} k - The gravitational parameter.
 * @param {Cartesian3} r - The position vector.
 * @param {Cartesian3} v - The velocity vector.
 * @returns {number} The eccentricity of the orbit.
 */
function rv2ecc(k, r, v) {
  const e = mult(sub(mult(r, dot(v, v) - k / mag(r)), mult(v, dot(r, v))), 1/k)
  const ecc = mag(e)
  return ecc
}

/**
 * Calculates the period of an orbit given the gravitational parameter, position, and velocity vectors.
 * @param {number} k - The gravitational parameter.
 * @param {Cartesian3} r - The position vector in meters.
 * @param {Cartesian3} v - The velocity vector in meters.
 * @returns {number} The period of the orbit in seconds.
 */
function rv2period(k, r, v) {
  const h = cross(r, v)
  const p = dot(h, h) / k
  const ecc = rv2ecc(k, r, v)

  if(ecc >= 1) return Infinity

  const a = p / (1 - ecc * ecc)
  const mm = Math.sqrt(k / Math.abs(a*a*a))

  return 2 * Math.PI / mm
}

/**
 * Calculates the classical orbital elements (COE) of an orbit given the gravitational parameter, position, and velocity vectors.
 * @param {number} k - The gravitational parameter.
 * @param {Cartesian3} r - The position vector.
 * @param {Cartesian3} v - The velocity vector.
 * @param {number} [tol=1e-12] - The tolerance for determining circular and equatorial orbits.
 * @returns {Array} An array containing the classical orbital elements: [p, ecc, inc, raan, argp, nu].
 */
function rv2coe(k, r, v, tol=1e-12) {
  const h = cross(r, v)
  const n = cross(Cartesian3.UNIT_Z, h)
  const e = mult(sub(mult(r, dot(v, v) - k / mag(r)), mult(v, dot(r, v))), 1/k)
  const ecc = mag(e)
  const p = dot(h, h) / k
  const inc = Math.acos(h.z / mag(h))

  const circular = ecc < tol
  const equatorial = Math.abs(inc) < tol

  let raan, argp, nu

  if (equatorial && !circular) {
    raan = 0
    argp = Math.atan2(e.y, e.x) % (2 * Math.PI)  // Longitude of periapsis
    nu = Math.atan2(dot(h, cross(e, r)) / mag(h), dot(r, e))
  } else if (!equatorial && circular) {
    raan = Math.atan2(n.y, n.x) % (2 * Math.PI)
    argp = 0
    // Argument of latitude
    nu = Math.atan2(dot(r, cross(h, n)) / mag(h), dot(r, n))
  } else if (equatorial && circular) {
    raan = 0
    argp = 0
    nu = Math.atan2(r.y, r.x) % (2 * Math.PI)  // True longitude
  } else {
    const a = p / (1 - (ecc**2))
    const ka = k * a
    if (a > 0) {
      const e_se = dot(r, v) / Math.sqrt(ka)
      const e_ce = mag(r) * dot(v, v) / k - 1
      nu = E_to_nu(Math.atan2(e_se, e_ce), ecc)
    } else {
      const e_sh = dot(r, v) / Math.sqrt(-ka)
      const e_ch = mag(r) * (mag(v) ** 2) / k - 1
      nu = F_to_nu(Math.log((e_ch + e_sh) / (e_ch - e_sh)) / 2, ecc)
    }

    raan = Math.atan2(n.y, n.x) % (2 * Math.PI)
    const px = dot(r, n)
    const py = dot(r, cross(h, n)) / mag(h)
    argp = (Math.atan2(py, px) - nu) % (2 * Math.PI)
    if(argp < 0) argp += 2 * Math.PI
  }

  nu = (nu + Math.PI) % (2 * Math.PI) - Math.PI

  return [p, ecc, inc, raan, argp, nu]
}


/** Helper functions **/

function cross(a, b) {
  return Cartesian3.cross(a, b, new Cartesian3())
}

function dot(a, b) {
  return Cartesian3.dot(a, b)
}

function mult(a, b) {
  return new Cartesian3(a.x * b, a.y * b, a.z * b)
}

function sub(a, b) {
  return new Cartesian3(a.x - b.x, a.y - b.y, a.z - b.z)
}

function mag(a) {
  return Cartesian3.magnitude(a)
}

function cot(x) {
  return 1 / Math.tan(x);
}

function E_to_nu(E, ecc) {
  const nu = 2 * Math.atan(Math.sqrt((1 + ecc) / (1 - ecc)) * Math.tan(E / 2));
  return nu;
}

function F_to_nu(F, ecc) {
  const nu = 2 * Math.atan(Math.sqrt((ecc + 1) / (ecc - 1)) * Math.tanh(F / 2));
  return nu;
}

export { vallado, rv2period, rv2ecc, rv2coe }