// 材料匹配：Lab 空间 CIEDE2000 色差，体素格预筛，库存约束
import { ciede2000, deltaE76, rgbToLab, type Lab } from './color'
import type { Material } from './types'

export interface MatchWarning {
  tileCount: number
  message: string
}

export interface MaterialIndexEntry {
  material: Material
  lab: Lab
  remaining: number
}

export interface MaterialIndex {
  entries: MaterialIndexEntry[]
  // Lab 体素格：边长 16，预筛用
  voxel: Map<number, number[]>
}

const VOXEL = 16

function voxelKey(l: number, a: number, b: number): number {
  const li = Math.floor(l / VOXEL) + 4
  const ai = Math.floor((a + 128) / VOXEL)
  const bi = Math.floor((b + 128) / VOXEL)
  return ((li & 0x1f) << 20) | ((ai & 0x3ff) << 10) | (bi & 0x3ff)
}

export function buildMaterialIndex(materials: Material[]): MaterialIndex {
  const entries = materials.map((material) => ({
    material,
    lab: rgbToLab(material.rgb),
    remaining: material.stock,
  }))
  const voxel = new Map<number, number[]>()
  entries.forEach((e, i) => {
    const key = voxelKey(e.lab.l, e.lab.a, e.lab.b)
    const list = voxel.get(key)
    if (list) list.push(i)
    else voxel.set(key, [i])
  })
  return { entries, voxel }
}

export interface MatchResult {
  materialId: string
  deltaE: number
  fallback: boolean // 库存耗尽后的降级选择
}

// 挑最接近且有库存的材料；金箔不参与自动取色（靠人工指定）
export function matchMaterial(
  index: MaterialIndex,
  targetRgb: [number, number, number],
  excludeGold = true,
): MatchResult {
  const target = rgbToLab(targetRgb)
  const candidates = new Set<number>()
  // 逐层扩大体素邻域，直到碰到候选
  for (let ring = 0; ring < 16 && candidates.size === 0; ring++) {
    const li = Math.floor(target.l / VOXEL) + 4
    const ai = Math.floor((target.a + 128) / VOXEL)
    const bi = Math.floor((target.b + 128) / VOXEL)
    for (let dl = -ring; dl <= ring; dl++) {
      for (let da = -ring; da <= ring; da++) {
        for (let db = -ring; db <= ring; db++) {
          const key = (((li + dl) & 0x1f) << 20) | (((ai + da) & 0x3ff) << 10) | ((bi + db) & 0x3ff)
          const list = index.voxel.get(key)
          if (!list) continue
          for (const i of list) {
            const e = index.entries[i]
            if (excludeGold && e.material.kind === 'gold') continue
            candidates.add(i)
          }
        }
      }
    }
  }
  let best = -1
  let bestD = Number.POSITIVE_INFINITY
  for (const i of candidates) {
    if (index.entries[i].remaining <= 0) continue
    const d = ciede2000(target, index.entries[i].lab)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  if (best >= 0) {
    const entry = index.entries[best]
    entry.remaining -= 1
    return { materialId: entry.material.id, deltaE: bestD, fallback: false }
  }
  // 全部库存耗尽：用 ΔE76 快速选整体最近（不再扣库存）
  let fb = 0
  let fbD = Number.POSITIVE_INFINITY
  index.entries.forEach((e, i) => {
    if (excludeGold && e.material.kind === 'gold') return
    const d = deltaE76(target, e.lab)
    if (d < fbD) {
      fbD = d
      fb = i
    }
  })
  return { materialId: index.entries[fb].material.id, deltaE: fbD, fallback: true }
}

// 色差告警阈值：CIEDE2000 > 5 肉眼可辨
export const DE_WARN = 5
