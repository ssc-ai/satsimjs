import { Cartesian3 } from 'cesium'

/**
 * Calculates the c2 and c3 functions for use in the universal variable calculation of z.
 * 
 * These functions are fundamental to the universal variable formulation of orbital
 * mechanics, providing the Stumpff functions c2(z) and c3(z) that handle elliptical,
 * parabolic, and hyperbolic orbits in a unified manner.
 * 
 * @param {number} znew - The universal variable z
 * @returns {Array<number>} Array containing [c2, c3] function values
 * @returns {number} returns[0] - c2(z) Stumpff function value
 * @returns {number} returns[1] - c3(z) Stumpff function value
 * 
 * @example
 * // Calculate Stumpff functions for elliptical orbit
 * const [c2, c3] = findc2c3(1.5);
 * console.log(`c2: ${c2}, c3: ${c3}`);
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
 * 
 * This function implements the universal variable method for solving Kepler's equation
 * and propagating orbital state vectors. It handles elliptical, parabolic, and hyperbolic
 * orbits using a unified approach with automatic convergence control.
 * 
 * The algorithm uses universal variables to avoid singularities and provides robust
 * numerical solution for orbital propagation across all orbit types.
 * 
 * @param {number} k - Gravitational parameter (μ = GM) in m³/s²
 * @param {Cartesian3} ro - Initial position vector in meters
 * @param {Cartesian3} vo - Initial velocity vector in m/s
 * @param {number} dtseco - Time step to propagate in seconds
 * @param {number} numiter - Maximum number of iterations for convergence
 * @returns {Object} Object containing the propagated state vectors
 * @returns {Cartesian3} returns.position - Position vector at target time
 * @returns {Cartesian3} returns.velocity - Velocity vector at target time
 * 
 * @example
 * // Propagate orbit by 1 hour
 * const mu = 3.986004418e14; // Earth's gravitational parameter
 * const r0 = new Cartesian3(7000000, 0, 0); // Initial position (7000 km altitude)
 * const v0 = new Cartesian3(0, 7546, 0);    // Initial velocity for circular orbit
 * const dt = 3600; // 1 hour in seconds
 * 
 * const result = vallado(mu, r0, v0, dt, 100);
 * console.log(`New position: ${result.position}`);
 * console.log(`New velocity: ${result.velocity}`);
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
 * 
 * This function computes the orbital eccentricity using the specific orbital energy and
 * angular momentum. The eccentricity is a fundamental orbital element that describes
 * the shape of the orbit (0 = circular, 0 < e < 1 = elliptical, e = 1 = parabolic, e > 1 = hyperbolic).
 * 
 * @param {number} k - Gravitational parameter (μ = GM) in m³/s²
 * @param {Cartesian3} r - Position vector in meters
 * @param {Cartesian3} v - Velocity vector in m/s
 * @returns {number} Orbital eccentricity (dimensionless)
 * 
 * @example
 * // Calculate eccentricity for a satellite orbit
 * const mu = 3.986004418e14;
 * const position = new Cartesian3(7000000, 0, 0);
 * const velocity = new Cartesian3(0, 7546, 0);
 * 
 * const ecc = rv2ecc(mu, position, velocity);
 * console.log(`Orbital eccentricity: ${ecc.toFixed(6)}`);
 * // Output: "Orbital eccentricity: 0.000000" (circular orbit)
 */
function rv2ecc(k, r, v) {
  const e = mult(sub(mult(r, dot(v, v) - k / mag(r)), mult(v, dot(r, v))), 1/k)
  const ecc = mag(e)
  return ecc
}

/**
 * Calculates the orbital period given the gravitational parameter, position, and velocity vectors.
 * 
 * This function computes the orbital period using the semi-major axis derived from the
 * specific orbital energy. For elliptical orbits, it returns the time for one complete
 * revolution. For parabolic and hyperbolic orbits, it returns Infinity.
 * 
 * The calculation uses Kepler's third law: T = 2π√(a³/μ)
 * 
 * @param {number} k - Gravitational parameter (μ = GM) in m³/s²
 * @param {Cartesian3} r - Position vector in meters
 * @param {Cartesian3} v - Velocity vector in m/s
 * @returns {number} Orbital period in seconds (Infinity for non-elliptical orbits)
 * 
 * @example
 * // Calculate period for ISS-like orbit
 * const mu = 3.986004418e14;
 * const position = new Cartesian3(6778000, 0, 0); // ~400km altitude
 * const velocity = new Cartesian3(0, 7669, 0);    // Circular velocity
 * 
 * const period = rv2period(mu, position, velocity);
 * console.log(`Orbital period: ${(period / 60).toFixed(1)} minutes`);
 * // Output: "Orbital period: 92.7 minutes"
 * 
 * @example
 * // Hyperbolic trajectory returns Infinity
 * const escapeVel = new Cartesian3(0, 15000, 0); // Above escape velocity
 * const period = rv2period(mu, position, escapeVel);
 * console.log(`Period: ${period}`); // "Period: Infinity"
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
 * Calculates the classical orbital elements (COE) from position and velocity vectors.
 * 
 * This function converts Cartesian state vectors to classical orbital elements,
 * handling special cases for circular and equatorial orbits. The elements returned
 * follow standard orbital mechanics conventions and can be used for orbit analysis
 * and visualization.
 * 
 * Classical orbital elements returned:
 * - p: Semi-latus rectum (parameter)
 * - ecc: Eccentricity  
 * - inc: Inclination
 * - raan: Right ascension of ascending node
 * - argp: Argument of periapsis
 * - nu: True anomaly
 * 
 * @param {number} k - Gravitational parameter (μ = GM) in m³/s²
 * @param {Cartesian3} r - Position vector in meters
 * @param {Cartesian3} v - Velocity vector in m/s
 * @param {number} [tol=1e-12] - Tolerance for determining circular and equatorial orbits
 * @returns {Array<number>} Array containing [p, ecc, inc, raan, argp, nu] in radians and meters
 * @returns {number} returns[0] - Semi-latus rectum in meters
 * @returns {number} returns[1] - Eccentricity (dimensionless)
 * @returns {number} returns[2] - Inclination in radians
 * @returns {number} returns[3] - Right ascension of ascending node in radians
 * @returns {number} returns[4] - Argument of periapsis in radians
 * @returns {number} returns[5] - True anomaly in radians
 * 
 * @example
 * // Calculate orbital elements for a typical satellite
 * const mu = 3.986004418e14;
 * const r = new Cartesian3(7000000, 0, 0);
 * const v = new Cartesian3(0, 7546, 0);
 * 
 * const [p, ecc, inc, raan, argp, nu] = rv2coe(mu, r, v);
 * console.log(`Inclination: ${(inc * 180/Math.PI).toFixed(2)}°`);
 * console.log(`Eccentricity: ${ecc.toFixed(6)}`);
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

/**
 * Converts classical orbital elements to modified equinoctial elements.
 * 
 * This function transforms from the classical orbital element representation
 * to the modified equinoctial element (MEE) representation, which avoids
 * singularities for small eccentricity and inclination orbits. The MEE
 * representation is particularly useful for numerical orbit propagation.
 * 
 * Modified equinoctial elements returned:
 * - p: Semi-latus rectum (same as in COE)
 * - f: First component of eccentricity vector  
 * - g: Second component of eccentricity vector
 * - h: First component of inclination vector
 * - k: Second component of inclination vector
 * - L: True longitude
 * 
 * @param {number} p - Semi-latus rectum in meters
 * @param {number} ecc - Eccentricity (dimensionless)
 * @param {number} inc - Inclination in radians
 * @param {number} raan - Right ascension of ascending node in radians
 * @param {number} argp - Argument of periapsis in radians
 * @param {number} nu - True anomaly in radians
 * @returns {Array<number>} Array containing [p, f, g, h, k, L] modified equinoctial elements
 * @returns {number} returns[0] - Semi-latus rectum in meters
 * @returns {number} returns[1] - f component (dimensionless)
 * @returns {number} returns[2] - g component (dimensionless)
 * @returns {number} returns[3] - h component (dimensionless)
 * @returns {number} returns[4] - k component (dimensionless)
 * @returns {number} returns[5] - True longitude L in radians
 * 
 * @throws {Error} When inclination is exactly 180 degrees (π radians)
 * 
 * @example
 * // Convert COE to MEE for numerical propagation
 * const [p_coe, ecc, inc, raan, argp, nu] = rv2coe(mu, r, v);
 * const [p, f, g, h, k, L] = coe2mee(p_coe, ecc, inc, raan, argp, nu);
 * 
 * console.log(`MEE elements: p=${p}, f=${f.toFixed(6)}, g=${g.toFixed(6)}`);
 * console.log(`h=${h.toFixed(6)}, k=${k.toFixed(6)}, L=${L.toFixed(6)}`);
 */
function coe2mee(p, ecc, inc, raan, argp, nu) {
  if (inc === Math.PI) {
    throw new Error("Cannot compute modified equinoctial set for 180 degrees orbit inclination due to `h` and `k` singularity.");
  }

  const lonper = raan + argp;
  const f = ecc * Math.cos(lonper);
  const g = ecc * Math.sin(lonper);
  const h = Math.tan(inc / 2) * Math.cos(raan);
  const k = Math.tan(inc / 2) * Math.sin(raan);
  const L = lonper + nu;
  return [p, f, g, h, k, L];
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

export { vallado, rv2period, rv2ecc, rv2coe, coe2mee }