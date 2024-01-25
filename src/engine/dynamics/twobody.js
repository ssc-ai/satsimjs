import {
  stumpff_c2 as c2,
  stumpff_c3 as c3
} from './math.js'
import { Cartesian3 } from 'cesium'

// const _scratch = new Cartesian3()
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

function vallado_fast(k, r0, v0, tof, numiter) {
  const dot_r0v0 = dot(r0, v0)
  const norm_r0 = mag(r0)
  const sqrt_mu = Math.pow(k, 0.5)
  const alpha = -dot(v0, v0) / k + 2 / norm_r0

  let xi_new
  // First guess
  if (alpha > 0) {
    // Elliptic orbit
    xi_new = sqrt_mu * tof * alpha
  } else if (alpha < 0) {
    // Hyperbolic orbit
    xi_new = (
      Math.sign(tof)
      * Math.pow((-1 / alpha), 0.5)
      * Math.log(
        (-2 * k * alpha * tof)
        / (
          dot_r0v0
          + Math.sign(tof)
          * Math.sqrt(-k / alpha)
          * (1 - norm_r0 * alpha)
        )
      )
    )
  } else {
    // Parabolic orbit
    // (Conservative initial guess)
    xi_new = sqrt_mu * tof / norm_r0
  }

  // Newton-Raphson iteration on the Kepler equation
  let xi, psi, c2_psi, c3_psi, norm_r
  let count = 0
  while (count < numiter) {
    xi = xi_new
    psi = xi * xi * alpha
    c2_psi = c2(psi)
    c3_psi = c3(psi)
    norm_r = (
      xi * xi * c2_psi
      + dot_r0v0 / sqrt_mu * xi * (1 - psi * c3_psi)
      + norm_r0 * (1 - psi * c2_psi)
    )
    xi_new = (
      xi
      + (
        sqrt_mu * tof
        - xi * xi * xi * c3_psi
        - dot_r0v0 / sqrt_mu * xi * xi * c2_psi
        - norm_r0 * xi * (1 - psi * c3_psi)
      )
      / norm_r
    )
    if (Math.abs(xi_new - xi) < 1e-7) {
      break
    } else {
      count += 1
    }
  }

  // Compute Lagrange coefficients
  const f = 1 - Math.pow(xi, 2) / norm_r0 * c2_psi
  const g = tof - Math.pow(xi, 3) / sqrt_mu * c3_psi

  const gdot = 1 - Math.pow(xi, 2) / norm_r * c2_psi
  const fdot = sqrt_mu / (norm_r * norm_r0) * xi * (psi * c3_psi - 1)

  return [f, g, fdot, gdot]
}


function vallado(k, r0, v0, tof, numiter) {
  // Compute Lagrange coefficients
  let f, g, fdot, gdot
  [f, g, fdot, gdot] = vallado_fast(k, r0, v0, tof, numiter)

  // Return position and velocity vectors
  return {
    "position": { "x": f * r0.x + g * v0.x, "y": f * r0.y + g * v0.y, "z": f * r0.z + g * v0.z},
    "velocity": { "x": fdot * r0.x + gdot * v0.x, "y": fdot * r0.y + gdot * v0.y, "z": fdot * r0.z + gdot * v0.z}
  }
}

function rv2ecc(k, r, v) {
  const e = mult(sub(mult(r, dot(v, v) - k / mag(r)), mult(v, dot(r, v))), 1/k)
  const ecc = mag(e)
  return ecc
}


function rv2p(k, r, v) {
  const h = cross(r, v)
  const p = dot(h, h) / k
  const ecc = rv2ecc(k, r, v)
  const a = p / (1 - ecc * ecc)
  const mm = Math.sqrt(k / Math.abs(a*a*a))

  return 2 * Math.PI / mm
}


function rv2coe(k, r, v, tol=1e-8) {
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
  }

  nu = (nu + Math.PI) % (2 * Math.PI) - Math.PI

  return [p, ecc, inc, raan, argp, nu]
}

function E_to_nu(E, ecc) {
  const nu = 2 * Math.atan(Math.sqrt((1 + ecc) / (1 - ecc)) * Math.tan(E / 2));
  return nu;
}

function F_to_nu(F, ecc) {
  const nu = 2 * Math.atan(Math.sqrt((ecc + 1) / (ecc - 1)) * Math.tanh(F / 2));
  return nu;
}

export { vallado, rv2p, rv2ecc, rv2coe }