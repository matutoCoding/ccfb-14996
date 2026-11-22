// 排块引擎：抖动网格 + 流场顺向 + 确定性随机，输出紧凑二进制块数据
import { cellRng, hashParams } from './rng'
import { flowAt, type FlowField } from './flow'
import { buildSAT, regionAverage, type ImagePixels, type SumAreaTable } from './image_util'
import { buildMaterialIndex, matchMaterial, DE_WARN, type MaterialIndex } from './matcher'
import type { Material, TileVersion, TilingParams, TilingStats } from './types'
import { TILE_STRIDE, writeTile } from './types'

export interface TilingOutput {
  buffer: ArrayBuffer
  count: number
  materialTable: Record<string, string>
  stats: TilingStats
}

interface TilingInput {
  params: TilingParams
  wallWidth: number
  wallHeight: number
  pixels: ImagePixels | null
  flow: FlowField | null
  materials: Material[]
  onProgress?: (ratio: number) => void
}

export function generateTiling(input: TilingInput): TilingOutput {
  const { params, wallWidth: W, wallHeight: H, pixels, flow, materials } = input
  const step = params.tileSize + params.grout
  const cols = Math.max(1, Math.round(W / step))
  const rows = Math.max(1, Math.round(H / step))
  const count = cols * rows
  const seed = hashParams([
    params.seed,
    params.tileSize,
    params.grout,
    params.sizeJitter,
    params.cutJitter,
    params.angleJitter,
    params.flowFollow,
  ])

  const buffer = new ArrayBuffer(count * TILE_STRIDE)
  const view = new DataView(buffer)
  const sat: SumAreaTable | null = pixels ? buildSAT(pixels) : null
  const matIndex: MaterialIndex = buildMaterialIndex(materials)
  const localTable: string[] = []
  const tableMap = new Map<string, number>()
  const used = new Map<string, number>()
  const warnings: string[] = []
  let fallbackCount = 0
  let highDeltaCount = 0

  const mapMaterial = (id: string): number => {
    const hit = tableMap.get(id)
    if (hit !== undefined) return hit
    const idx = localTable.length
    localTable.push(id)
    tableMap.set(id, idx)
    return idx
  }

  let i = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const rng = cellRng(seed, col, row, 7)
      const cx = (col + 0.5) * step
      const cy = (row + 0.5) * step
      const sizeScale = 1 + (rng() * 2 - 1) * params.sizeJitter
      const cutScale = 1 + (rng() * 2 - 1) * params.cutJitter
      const w = Math.min(step, params.tileSize * sizeScale * cutScale)
      const h = Math.min(step, params.tileSize * sizeScale * (2 - cutScale))
      const jitterAngle = (rng() * 2 - 1) * params.angleJitter * (Math.PI / 180)

      // 流场顺向：低连贯区域退回纯随机倾斜
      const u = cx / W
      const v = cy / H
      let angle = jitterAngle
      if (flow) {
        const f = flowAt(flow, u, v)
        if (f.strength > 0.25) {
          // 图像 y 向下，布局 v 向上，走向取反
          const guided = -f.angle
          angle = guided * params.flowFollow + jitterAngle * (1 - params.flowFollow)
        }
      }

      let rgb: [number, number, number]
      if (sat) {
        rgb = regionAverage(sat, (cx - w / 2) / W, (cy - h / 2) / H, (cx + w / 2) / W, (cy + h / 2) / H)
      } else {
        rgb = [200, 200, 195]
      }
      const match = matchMaterial(matIndex, rgb)
      if (match.fallback) fallbackCount++
      if (match.deltaE > DE_WARN) highDeltaCount++
      used.set(match.materialId, (used.get(match.materialId) ?? 0) + 1)

      writeTile(view, i, {
        x: cx,
        y: cy,
        w,
        h,
        angle,
        materialIndex: mapMaterial(match.materialId),
      })
      i++
    }
    input.onProgress?.((row + 1) / rows)
  }

  const stockShortages = matIndex.entries
    .filter((e) => e.remaining < 0)
    .map((e) => ({ materialId: e.material.id, need: -e.remaining + e.material.stock, stock: e.material.stock }))
  if (fallbackCount > 0) warnings.push(`${fallbackCount} 块因库存耗尽使用了降级替代材料`)
  if (highDeltaCount > 0) warnings.push(`${highDeltaCount} 块色差 ΔE > ${DE_WARN}，原稿颜色超出材料库色域`)
  if (used.size > 24) warnings.push(`用色 ${used.size} 种，超过 24 种施工建议上限`)
  const materialTable: Record<string, string> = {}
  localTable.forEach((id, idx) => (materialTable[String(idx)] = id))
  const stats: TilingStats = {
    count,
    colorCount: used.size,
    warnings,
    stockShortages,
  }
  return { buffer, count, materialTable, stats }
}

export function emptyStats(): TilingStats {
  return { count: 0, colorCount: 0, warnings: [], stockShortages: [] }
}

export function versionLabel(params: TilingParams): string {
  return `${params.tileSize * 1000}mm 块 / ${params.grout * 1000}mm 缝 / 种子 ${params.seed}`
}

export function makeVersion(projectId: string, params: TilingParams, out: TilingOutput, note = ''): TileVersion {
  return {
    id: `ver_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    projectId,
    label: versionLabel(params),
    params,
    materialTable: out.materialTable,
    stats: out.stats,
    createdAt: Date.now(),
    note,
  }
}
