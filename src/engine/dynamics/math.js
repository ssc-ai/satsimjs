import { gamma } from "mathjs"


function hyp2f1b(x) {
  if (x >= 1.0) {
    return Math.inf
  } else {
    let res = 1.0
    let term = 1.0
    let ii = 0
    while (true) {
      term = term * (3 + ii) * (1 + ii) / (5 / 2 + ii) * x / (ii + 1)
      let res_old = res
      res += term
      if (res_old == res) {
        return res
      }
      ii += 1
    }
  }
}


function stumpff_c2(psi) {
  let eps = 1.0
  let res
  if (psi > eps) {
    res = (1 - Math.cos(Math.sqrt(psi))) / psi
  } else if (psi < -eps) {
    res = (Math.cosh(Math.sqrt(-psi)) - 1) / (-psi)
  } else {
    res = 1.0 / 2.0
    let delta = (-psi) / gamma(2 + 2 + 1)
    let k = 1
    while (res + delta != res) {
      res = res + delta
      k += 1
      delta = (-psi) ** k / gamma(2 * k + 2 + 1)
    }
  }
  return res
}


function stumpff_c3(psi) {
  let eps = 1.0
  let res
  if (psi > eps) {
    res = (Math.sqrt(psi) - Math.sin(Math.sqrt(psi))) / (psi * Math.sqrt(psi))
  } else if (psi < -eps) {
    res = (Math.sinh(Math.sqrt(-psi)) - Math.sqrt(-psi)) / (-psi * Math.sqrt(-psi))
  } else {
    res = 1.0 / 6.0
    let delta = (-psi) / gamma(2 + 3 + 1)
    let k = 1
    while (res + delta != res) {
      res = res + delta
      k += 1
      delta = (-psi) ** k / gamma(2 * k + 3 + 1)
    }
  }

  return res
}

export {
  hyp2f1b,
  stumpff_c2,
  stumpff_c3
}