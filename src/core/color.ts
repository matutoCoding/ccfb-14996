// 颜色科学：sRGB -> XYZ -> Lab，色差用 CIEDE2000
// 参考 ISO/CIE 标准公式，全部确定性纯函数

export type SRGB = [number, number, number] // 0-255
export type Lab = [number, number, number]

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

// D65 白点
const REF_X = 95.047
const REF_Y = 100
const REF_Z = 108.883

function pivot(t: number): number {
  const d = 6 / 29
  return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29
}

export function srgbToLab([r, g, b]: SRGB): Lab {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  // sRGB D65 矩阵
  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) * 100
  const y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) * 100
  const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) * 100
  const fx = pivot(x / REF_X)
  const fy = pivot(y / REF_Y)
  const fz = pivot(z / REF_Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180
}

function rad2deg(r: number): number {
  return (r * 180) / Math.PI
}

// CIEDE2000 色差，返回值越小越接近
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2
  const kL = 1
  const kC = 1
  const kH = 1

  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cbar = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const h1p = C1p === 0 ? 0 : ((rad2deg(Math.atan2(b1, a1p)) + 360) % 360)
  const h2p = C2p === 0 ? 0 : ((rad2deg(Math.atan2(b2, a2p)) + 360) % 360)

  const dLp = L2 - L1
  const dCp = C2p - C1p
  let dhp: number
  if (C1p === 0 || C2p === 0) dhp = 0
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p
  else if (h2p > h1p) dhp = h2p - h1p - 360
  else dhp = h2p - h1p + 360
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dhp / 2))

  const Lbarp = (L1 + L2) / 2
  const Cbarp = (C1p + C2p) / 2
  let hbarp: number
  if (C1p === 0 || C2p === 0) hbarp = h1p + h2p
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2
  else hbarp = (h1p + h2p - 360) / 2

  const T =
    1 -
    0.17 * Math.cos(deg2rad(hbarp - 30)) +
    0.24 * Math.cos(deg2rad(2 * hbarp)) +
    0.32 * Math.cos(deg2rad(3 * hbarp + 6)) -
    0.2 * Math.cos(deg2rad(4 * hbarp - 63))
  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2))
  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)))
  const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2))
  const SC = 1 + 0.045 * Cbarp
  const SH = 1 + 0.015 * Cbarp * T
  const RT = -Math.sin(deg2rad(2 * dTheta)) * RC
  const dE = Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
      Math.pow(dCp / (kC * SC), 2) +
      Math.pow(dHp / (kH * SH), 2) +
      RT * (dCp / (kC * SC)) * (dHp / (kH * SH)),
  )
  return dE
}

// 平均多块 sRGB 像素（面积平均在线性空间做更准，这里按像素数加权）
export function averageSRGB(samples: SRGB[]): SRGB {
  if (samples.length === 0) return [128, 128, 128]
  let r = 0
  let g = 0
  let b = 0
  for (const c of samples) {
    r += srgbToLinear(c[0])
    g += srgbToLinear(c[1])
    b += srgbToLinear(c[2])
  }
  const n = samples.length
  const to8 = (v: number) =>
    Math.round(
      (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255,
    )
  return [to8(r / n), to8(g / n), to8(b / n)]
}
