// 墙面几何：平面 / 圆柱弧面 / 半穹顶，统一用布局坐标 (u,v)∈[0,1]² 参数化
import type { WallConfig } from './types'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface LayoutDims {
  width: number
  height: number
}

export function layoutDims(wall: WallConfig): LayoutDims {
  return { width: wall.width, height: wall.height }
}

// 圆弧半径：弦宽 W、拱高 c
function arcRadius(width: number, rise: number): number {
  if (rise <= 1e-6) return Number.POSITIVE_INFINITY
  return (width * width) / (8 * rise) + rise / 2
}

function arcAngle(width: number, r: number): number {
  return Number.isFinite(r) ? width / r : 0
}

export function wallPoint(wall: WallConfig, u: number, v: number): Vec3 {
  const { width: W, height: H, curvature: c } = wall
  const y = v * H - H / 2
  if (wall.kind === 'plane') {
    return { x: u * W - W / 2, y, z: 0 }
  }
  const R = arcRadius(W, c)
  const theta = arcAngle(W, R)
  const phi = theta * (u - 0.5)
  if (wall.kind === 'curved') {
    return {
      x: R * Math.sin(phi),
      y,
      z: R * Math.cos(phi) - R * Math.cos(theta / 2),
    }
  }
  // 半穹顶：水平圆弧随高度收拢到穹顶
  const alpha = v * (Math.PI / 2)
  const rho = R * Math.cos(alpha)
  return {
    x: rho * Math.sin(phi),
    y: R * Math.sin(alpha) - R / 2,
    z: rho * Math.cos(phi) - R * Math.cos(theta / 2),
  }
}

export function wallNormal(wall: WallConfig, u: number, v: number): Vec3 {
  if (wall.kind === 'plane') return { x: 0, y: 0, z: 1 }
  const R = arcRadius(wall.width, wall.curvature)
  const theta = arcAngle(wall.width, R)
  const phi = theta * (u - 0.5)
  if (wall.kind === 'curved') {
    return { x: Math.sin(phi), y: 0, z: Math.cos(phi) }
  }
  const alpha = v * (Math.PI / 2)
  return {
    x: Math.sin(phi) * Math.cos(alpha),
    y: Math.sin(alpha),
    z: Math.cos(phi) * Math.cos(alpha),
  }
}

// 沿宽度方向的切向量（块的默认朝向基准）
export function wallTangent(wall: WallConfig, u: number, v: number): Vec3 {
  const eps = 1e-4
  const p0 = wallPoint(wall, Math.max(0, u - eps), v)
  const p1 = wallPoint(wall, Math.min(1, u + eps), v)
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z) || 1
  return { x: (p1.x - p0.x) / len, y: (p1.y - p0.y) / len, z: (p1.z - p0.z) / len }
}

// 射线求交，返回布局 UV；拾取单块用
export function rayIntersect(
  wall: WallConfig,
  origin: Vec3,
  dir: Vec3,
): { u: number; v: number } | null {
  if (wall.kind === 'plane') {
    if (Math.abs(dir.z) < 1e-8) return null
    const t = -origin.z / dir.z
    if (t < 0) return null
    const px = origin.x + dir.x * t
    const py = origin.y + dir.y * t
    const u = (px + wall.width / 2) / wall.width
    const v = (py + wall.height / 2) / wall.height
    return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { u, v } : null
  }
  const R = arcRadius(wall.width, wall.curvature)
  const theta = arcAngle(wall.width, R)
  if (wall.kind === 'curved') {
    // 轴心在 y 轴、半径 R 的无限圆柱
    const a = dir.x * dir.x + dir.z * dir.z
    const b = 2 * (origin.x * dir.x + origin.z * dir.z)
    const cc = origin.x * origin.x + origin.z * origin.z - R * R
    const disc = b * b - 4 * a * cc
    if (disc < 0) return null
    const t = (-b - Math.sqrt(disc)) / (2 * a)
    if (t < 0) return null
    const px = origin.x + dir.x * t
    const pz = origin.z + dir.z * t
    const py = origin.y + dir.y * t
    const phi = Math.atan2(px, pz)
    if (Math.abs(phi) > theta / 2 + 1e-4) return null
    const v = (py + wall.height / 2) / wall.height
    if (v < 0 || v > 1) return null
    return { u: phi / theta + 0.5, v }
  }
  // 半穹顶：球心 C、半径 R
  const cz = -R * Math.cos(theta / 2)
  const cy = -R / 2
  const ox = origin.x
  const oy = origin.y - cy
  const oz = origin.z - cz
  const a = dir.x * dir.x + dir.y * dir.y + dir.z * dir.z
  const b = 2 * (ox * dir.x + oy * dir.y + oz * dir.z)
  const cc = ox * ox + oy * oy + oz * oz - R * R
  const disc = b * b - 4 * a * cc
  if (disc < 0) return null
  const t = (-b - Math.sqrt(disc)) / (2 * a)
  if (t < 0) return null
  const sx = ox + dir.x * t
  const sy = oy + dir.y * t
  const sz = oz + dir.z * t
  const alpha = Math.asin(Math.max(-1, Math.min(1, sy / R)))
  if (alpha < -1e-4 || alpha > Math.PI / 2 + 1e-4) return null
  const phi = Math.atan2(sx, sz)
  if (Math.abs(phi) > theta / 2 + 1e-4) return null
  const v = alpha / (Math.PI / 2)
  return { u: phi / theta + 0.5, v: Math.max(0, Math.min(1, v)) }
}
