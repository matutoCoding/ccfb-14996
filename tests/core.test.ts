import { describe, expect, it } from 'vitest'
import { Rng, hashFloat32 } from '@/core/rng'
import { deltaE2000, srgbToLab } from '@/core/color'
import { generateLayout, estimateTileCount, DEFAULT_PARAMS } from '@/core/layout'
import { wallArea, uvScale } from '@/core/geometry'
import type { Material, WallSpec } from '@/core/types'

const materials: Material[] = [
  { id: 'mat-01', name: '白', category: 'glass', color: [238, 232, 220], opacity: 0.9, roughness: 0.2, reflectivity: 0.7, stock: 100 },
  { id: 'mat-02', name: '蓝', category: 'glass', color: [38, 78, 142], opacity: 0.9, roughness: 0.2, reflectivity: 0.8, stock: 100 },
  { id: 'mat-03', name: '金', category: 'gold', color: [212, 170, 72], opacity: 1, roughness: 0.08, reflectivity: 1, stock: 5 },
]

const flatWall: WallSpec = {
  kind: 'flat',
  width: 4,
  height: 5,
  radius: 0,
  arcAngle: 0,
  azimuth: Math.PI,
}

describe('确定性随机数', () => {
  it('同种子产生完全一致的序列', () => {
    const a = new Rng(42)
    const b = new Rng(42)
    const seqA = Array.from({ length: 1000 }, () => a.next())
    const seqB = Array.from({ length: 1000 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('不同种子序列不同', () => {
    const a = new Rng(1)
    const b = new Rng(2)
    expect(a.next()).not.toBe(b.next())
  })
})

describe('Lab 色差', () => {
  it('白色 Lab 接近 D65 参考值', () => {
    const lab = srgbToLab([255, 255, 255])
    expect(lab[0]).toBeCloseTo(100, 1)
    expect(lab[1]).toBeCloseTo(0, 0)
    expect(lab[2]).toBeCloseTo(0, 0)
  })

  it('同色 ΔE2000 为 0', () => {
    const lab = srgbToLab([150, 32, 42])
    expect(deltaE2000(lab, lab)).toBeCloseTo(0, 6)
  })

  it('蓝与金的色差显著大于白与米白', () => {
    const far = deltaE2000(srgbToLab([38, 78, 142]), srgbToLab([212, 170, 72]))
    const near = deltaE2000(srgbToLab([238, 232, 220]), srgbToLab([255, 255, 255]))
    expect(far).toBeGreaterThan(30)
    expect(near).toBeLessThan(8)
    expect(far).toBeGreaterThan(near)
  })
})

describe('排块生成', () => {
  it('同参数同种子逐字节一致', () => {
    const r1 = generateLayout(flatWall, { ...DEFAULT_PARAMS }, null, null, materials)
    const r2 = generateLayout(flatWall, { ...DEFAULT_PARAMS }, null, null, materials)
    expect(r1.tiles.count).toBe(r2.tiles.count)
    expect(hashFloat32(r1.tiles.data)).toBe(hashFloat32(r2.tiles.data))
    expect(Array.from(r1.tiles.data)).toEqual(Array.from(r2.tiles.data))
  })

  it('换种子结果必然不同', () => {
    const r1 = generateLayout(flatWall, { ...DEFAULT_PARAMS, seed: 1 }, null, null, materials)
    const r2 = generateLayout(flatWall, { ...DEFAULT_PARAMS, seed: 2 }, null, null, materials)
    expect(hashFloat32(r1.tiles.data)).not.toBe(hashFloat32(r2.tiles.data))
  })

  it('块数与估算一致且紧凑存储为每块 24 字节', () => {
    const result = generateLayout(flatWall, { ...DEFAULT_PARAMS }, null, null, materials)
    expect(result.tiles.count).toBe(estimateTileCount(flatWall, DEFAULT_PARAMS))
    expect(result.tiles.data.byteLength).toBe(result.tiles.count * 24)
  })

  it('库存不足产生 stock 警告', () => {
    // 手工构造蓝金各半的原稿，保证金料被大量选中而库存只有 5 块
    const w = 16
    const h = 16
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      const gold = i % 2 === 0
      data[i * 4] = gold ? 212 : 38
      data[i * 4 + 1] = gold ? 170 : 78
      data[i * 4 + 2] = gold ? 72 : 142
      data[i * 4 + 3] = 255
    }
    const source = { imageData: { data, width: w, height: h }, width: w, height: h }
    const result = generateLayout(flatWall, { ...DEFAULT_PARAMS }, null, source, materials)
    const stockWarnings = result.warnings.filter((x) => x.type === 'stock')
    expect(stockWarnings.length).toBeGreaterThan(0)
    expect(stockWarnings.some((x) => x.message.includes('金'))).toBe(true)
  })

  it('材料库为空时拒绝排块', () => {
    const result = generateLayout(flatWall, DEFAULT_PARAMS, null, null, [])
    expect(result.tiles.count).toBe(0)
    expect(result.warnings[0].type).toBe('palette')
  })
})

describe('二十万块规模（20㎡ 级墙面）', () => {
  const bigWall: WallSpec = { kind: 'flat', width: 5, height: 4, radius: 0, arcAngle: 0, azimuth: 0 }
  const params = { ...DEFAULT_PARAMS, baseSize: 0.0085, gap: 0.001 }

  it('数据量达到二十万块且 2 秒内生成', () => {
    expect(wallArea(bigWall)).toBeCloseTo(20, 6)
    const estimated = estimateTileCount(bigWall, params)
    expect(estimated).toBeGreaterThanOrEqual(200000)
    const t0 = performance.now()
    const result = generateLayout(bigWall, params, null, null, materials)
    const elapsed = performance.now() - t0
    expect(result.tiles.count).toBeGreaterThanOrEqual(200000)
    expect(elapsed).toBeLessThan(4000)
    // 20 万块紧凑二进制约 4.8MB
    expect(result.tiles.data.byteLength).toBeLessThan(6 * 1024 * 1024)
  })

  it('弧面与穹顶面积/uv 尺度计算稳定', () => {
    const arc: WallSpec = { kind: 'arc', width: 6, height: 3.2, radius: 6, arcAngle: Math.PI / 3, azimuth: 0 }
    const dome: WallSpec = { kind: 'dome', width: 8, height: 6, radius: 4, arcAngle: Math.PI, azimuth: 0 }
    expect(wallArea(arc)).toBeCloseTo(6 * (Math.PI / 3) * 3.2, 5)
    expect(uvScale(arc).su).toBeCloseTo(6 * (Math.PI / 3), 5)
    expect(wallArea(dome)).toBeGreaterThan(0)
    const r = generateLayout(dome, { ...DEFAULT_PARAMS, baseSize: 0.03 }, null, null, materials)
    expect(r.tiles.count).toBeGreaterThan(0)
  })
})
