// 排块生成器：uv 平面规则网格 + 确定性抖动 + 走向倾斜 + Lab 色差匹配
// 同参数同种子逐字节一致；输出紧凑 Float32Array，每块 6 float / 24 字节
import type {
  FlowField,
  LayoutParams,
  LayoutPaletteEntry,
  LayoutTiles,
  MatchWarning,
  Material,
  WallSpec,
} from './types'
import { TILE_STRIDE } from './types'
import { Rng } from './rng'
import { uvScale } from './geometry'
import { sampleFlow } from './image'
import { sampleAreaColor, type SourceImage } from './image'
import { deltaE2000, srgbToLab, type Lab, type SRGB } from './color'

export const DEFAULT_PARAMS: LayoutParams = {
  seed: 20261124,
  baseSize: 0.015,
  sizeJitter: 0.18,
  gap: 0.002,
  cutRandom: 0.25,
  tiltRandom: 6,
  followFlow: 0.7,
}

export function estimateTileCount(wall: WallSpec, params: LayoutParams): number {
  const { su, sv } = uvScale(wall)
  const pitch = params.baseSize + params.gap
  const cols = Math.ceil(su / pitch)
  const rows = Math.ceil(sv / pitch)
  return cols * rows
}

interface LabMaterial {
  material: Material
  lab: Lab
}

function nearestMaterial(
  target: SRGB,
  labMaterials: LabMaterial[],
  labCache: Map<string, Lab>,
): { material: Material; distance: number } {
  const key = `${target[0]},${target[1]},${target[2]}`
  let lab = labCache.get(key)
  if (!lab) {
    lab = srgbToLab(target)
    labCache.set(key, lab)
  }
  let best = labMaterials[0]
  let bestD = Infinity
  for (const item of labMaterials) {
    const d = deltaE2000(lab, item.lab)
    if (d < bestD) {
      bestD = d
      best = item
    }
  }
  return { material: best.material, distance: bestD }
}

export interface LayoutResult {
  tiles: LayoutTiles
  warnings: MatchWarning[]
}

export function generateLayout(
  wall: WallSpec,
  params: LayoutParams,
  field: FlowField | null,
  source: SourceImage | null,
  materials: Material[],
  maxColors = 32,
): LayoutResult {
  if (materials.length === 0) {
    return {
      tiles: { count: 0, data: new Float32Array(0), palette: [], params, wallId: '' },
      warnings: [{ type: 'palette', message: '材料库为空，无法排块' }],
    }
  }
  const rng = new Rng(params.seed)
  const { su, sv } = uvScale(wall)
  const pitch = params.baseSize + params.gap
  const cols = Math.max(1, Math.ceil(su / pitch))
  const rows = Math.max(1, Math.ceil(sv / pitch))
  const count = cols * rows

  const data = new Float32Array(count * TILE_STRIDE)
  const palette: LayoutPaletteEntry[] = []
  const paletteIndex = new Map<string, number>()
  const usage = new Map<string, number>()
  const labMaterials = materials.map((m) => ({ material: m, lab: srgbToLab(m.color) }))
  const labCache = new Map<string, Lab>()
  const warnings: MatchWarning[] = []

  const baseU = params.baseSize / su
  const baseV = params.baseSize / sv
  const stepU = pitch / su
  const stepV = pitch / sv

  const resolvePalette = (materialId: string, color: SRGB): number => {
    const key = `${materialId}|${color[0]},${color[1]},${color[2]}`
    const existing = paletteIndex.get(key)
    if (existing !== undefined) return existing
    const idx = palette.length
    palette.push({ materialId, color })
    paletteIndex.set(key, idx)
    return idx
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col
      const o = i * TILE_STRIDE
      // 中心位置 + 位置抖动（保持在格内不越界）
      const jitterU = (rng.next() - 0.5) * stepU * params.sizeJitter
      const jitterV = (rng.next() - 0.5) * stepV * params.sizeJitter
      const cu = (col + 0.5) * stepU + jitterU
      const cv = (row + 0.5) * stepV + jitterV
      // 切割随机：宽高独立缩放
      const cut = 1 + (rng.next() - 0.5) * 2 * params.cutRandom * 0.4
      const sizeJ = 1 + (rng.next() - 0.5) * 2 * params.sizeJitter
      const wu = Math.min(stepU, baseU * sizeJ * cut)
      const hv = Math.min(stepV, baseV * sizeJ * (2 - cut))
      // 倾斜：走向场 * followFlow + 随机倾角
      let tilt = (rng.next() - 0.5) * 2 * params.tiltRandom * (Math.PI / 180)
      if (field) {
        const f = sampleFlow(field, cu, cv)
        // 走向角转 uv 物理坐标角（v 轴方向需要按宽高比修正）
        const flowAngle = Math.atan2(Math.sin(f.angle) * su, Math.cos(f.angle) * sv)
        tilt += flowAngle * f.strength * params.followFlow
      }
      data[o] = cu
      data[o + 1] = cv
      data[o + 2] = wu
      data[o + 3] = hv
      data[o + 4] = tilt

      // 取色匹配
      let target: SRGB = materials[0].color
      if (source) target = sampleAreaColor(source, cu - wu / 2, cv - hv / 2, wu, hv)
      const { material, distance } = nearestMaterial(target, labMaterials, labCache)
      const idx = resolvePalette(material.id, material.color)
      data[o + 5] = idx
      usage.set(material.id, (usage.get(material.id) ?? 0) + 1)
      if (distance > 12) {
        // 色差过大累计提示（同材料只报一次）
        const key = `far|${material.id}`
        if (!warnings.some((w) => w.message === key)) {
          warnings.push({
            type: 'gap',
            materialId: material.id,
            message: `材料「${material.name}」与原稿色差 ΔE=${distance.toFixed(1)}，建议补料`,
          })
        }
      }
    }
  }

  // 库存校验
  for (const m of materials) {
    const used = usage.get(m.id) ?? 0
    if (used > m.stock) {
      warnings.push({
        type: 'stock',
        materialId: m.id,
        message: `材料「${m.name}」需 ${used} 块，库存仅 ${m.stock} 块，缺 ${used - m.stock} 块`,
      })
    }
  }
  if (palette.length > maxColors) {
    warnings.push({
      type: 'palette',
      message: `实际用色 ${palette.length} 种，超过建议上限 ${maxColors} 种，熔制成本会上升`,
    })
  }

  return {
    tiles: { count, data, palette, params, wallId: wall.kind },
    warnings,
  }
}

// 单块读写（手动编辑用）
export function readTile(data: Float32Array, index: number): {
  cu: number
  cv: number
  wu: number
  hv: number
  tilt: number
  paletteIdx: number
} {
  const o = index * TILE_STRIDE
  return {
    cu: data[o],
    cv: data[o + 1],
    wu: data[o + 2],
    hv: data[o + 3],
    tilt: data[o + 4],
    paletteIdx: data[o + 5],
  }
}

export function writeTile(
  data: Float32Array,
  index: number,
  patch: Partial<{ cu: number; cv: number; tilt: number; paletteIdx: number }>,
): void {
  const o = index * TILE_STRIDE
  if (patch.cu !== undefined) data[o] = patch.cu
  if (patch.cv !== undefined) data[o + 1] = patch.cv
  if (patch.tilt !== undefined) data[o + 4] = patch.tilt
  if (patch.paletteIdx !== undefined) data[o + 5] = patch.paletteIdx
}

// 深拷贝排块：Vue 响应式代理无法被 structuredClone 克隆，
// 这里走纯数据通道（Float32Array 切片 + 普通对象），同时解代理
export function cloneTiles(tiles: LayoutTiles): LayoutTiles {
  return {
    count: tiles.count,
    data: new Float32Array(tiles.data),
    palette: tiles.palette.map((entry) => ({
      materialId: entry.materialId,
      color: [entry.color[0], entry.color[1], entry.color[2]] as [number, number, number],
    })),
    params: { ...tiles.params },
    wallId: tiles.wallId,
  }
}
