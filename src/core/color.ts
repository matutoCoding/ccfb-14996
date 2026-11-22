// sRGB / XYZ / Lab 转换与 CIEDE2000 色差（不用 RGB 欧氏距离）

export type Lab = { l: number; a: number; b: number }

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

// D65 白点
const XN = 0.95047
const YN = 1
const ZN = 1.08883

export function rgbToLab(rgb: [number, number, number]): Lab {
  const r = srgbToLinear(rgb[0])
  const g = srgbToLinear(rgb[1])
  const b = srgbToLinear(rgb[2])
  let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.072175
  let z = r * 0.0193339 + g * 0.119192 + b * 0.9503041
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116)
  x = f(x / XN)
  y = f(y / YN)
  z = f(z / ZN)
  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) }
}

const RAD = Math.PI / 180

// CIEDE2000，标准实现（Sharma 2005 修订版）
export function ciede2000(c1: Lab, c2: Lab): number {
  const { l: L1, a: a1, b: b1 } = c1
  const { l: L2, a: a2, b: b2 } = c2
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cbar = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))))
  const ap1 = (1 + G) * a1
  const ap2 = (1 + G) * a2
  const Cp1 = Math.hypot(ap1, b1)
  const Cp2 = Math.hypot(ap2, b2)
  const hp = (x: number, y: number) => {
    if (x === 0 && y === 0) return 0
    const h = (Math.atan2(y, x) / RAD + 360) % 360
    return h
  }
  const hp1 = hp(ap1, b1)
  const hp2 = hp(ap2, b2)
  const dLp = L2 - L1
  const dCp = Cp2 - Cp1
  let dhp = 0
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * RAD) / 2)
  const Lbp = (L1 + L2) / 2
  const Cbp = (Cp1 + Cp2) / 2
  let hbp = hp1 + hp2
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) {
      hbp = hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2
    } else {
      hbp = (hp1 + hp2) / 2
    }
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * RAD) +
    0.24 * Math.cos(2 * hbp * RAD) +
    0.32 * Math.cos((3 * hbp + 6) * RAD) -
    0.2 * Math.cos((4 * hbp - 63) * RAD)
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2))
  const RC = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)))
  const SL = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2))
  const SC = 1 + 0.045 * Cbp
  const SH = 1 + 0.015 * Cbp * T
  const RT = -Math.sin(2 * dTheta * RAD) * RC
  const kL = 1
  const kC = 1
  const kH = 1
  return Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
      Math.pow(dCp / (kC * SC), 2) +
      Math.pow(dHp / (kH * SH), 2) +
      RT * (dCp / (kC * SC)) * (dHp / (kH * SH)),
  )
}

// 快速粗略 ΔE（体素预筛阶段用，省去全量 CIEDE2000）
export function deltaE76(c1: Lab, c2: Lab): number {
  return Math.hypot(c1.l - c2.l, c1.a - c2.a, c1.b - c2.b)
}
