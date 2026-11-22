// 核心逻辑冒烟测试（Node 环境，不碰 DOM/IDB/WebGL）
import assert from 'node:assert/strict'
import { mulberry32, cellRng, hashParams } from '../src/core/rng'
import { rgbToLab, ciede2000, deltaE76 } from '../src/core/color'
import { generateTiling } from '../src/core/tiling'
import { computeFlowField } from '../src/core/flow'
import { wallPoint, wallNormal, rayIntersect } from '../src/core/wall'
import type { ImagePixels } from '../src/core/image_util'
import type { Material, TilingParams } from '../src/core/types'

let passed = 0
function test(name: string, fn: () => void): void {
  fn()
  passed++
  console.log(`  ok - ${name}`)
}

// 1. 确定性随机
test('mulberry32 同种子序列一致', () => {
  const a = mulberry32(12345)
  const b = mulberry32(12345)
  const sa = Array.from({ length: 100 }, a)
  const sb = Array.from({ length: 100 }, b)
  assert.deepEqual(sa, sb)
  const c = mulberry32(12346)
  assert.notEqual(sa[0], c())
})

test('cellRng 与遍历顺序无关', () => {
  const r1 = cellRng(99, 3, 7, 7)()
  const r2 = cellRng(99, 3, 7, 7)()
  assert.equal(r1, r2)
  assert.notEqual(r1, cellRng(99, 3, 8, 7)())
})

test('hashParams 稳定', () => {
  assert.equal(hashParams([1, 2, 'a']), hashParams([1, 2, 'a']))
  assert.notEqual(hashParams([1, 2, 'a']), hashParams([1, 3, 'a']))
})

// 2. Lab / CIEDE2000
test('sRGB 转 Lab 参考值', () => {
  const white = rgbToLab([255, 255, 255])
  assert.ok(Math.abs(white.l - 100) < 0.5)
  assert.ok(Math.abs(white.a) < 0.5 && Math.abs(white.b) < 0.5)
  const red = rgbToLab([255, 0, 0])
  assert.ok(red.a > 30 && red.b > 20)
})

test('CIEDE2000 同色为 0、异色为正且小于 ΔE76 粗筛', () => {
  const c1 = rgbToLab([120, 80, 60])
  const c2 = rgbToLab([122, 82, 62])
  const c3 = rgbToLab([20, 30, 140])
  assert.equal(ciede2000(c1, c1), 0)
  assert.ok(ciede2000(c1, c2) < 2)
  assert.ok(ciede2000(c1, c3) > ciede2000(c1, c2))
  assert.ok(ciede2000(c1, c3) < deltaE76(c1, c3))
})

// 3. 流场
function syntheticPixels(): ImagePixels {
  const w = 64
  const h = 64
  const rgba = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      // 水平明暗条纹 → 边缘走向应接近水平
      const v = y % 12 < 6 ? 220 : 40
      rgba[i] = v
      rgba[i + 1] = v
      rgba[i + 2] = v
      rgba[i + 3] = 255
    }
  }
  return { width: w, height: h, rgba }
}

test('结构张量流场识别水平条纹走向', () => {
  const field = computeFlowField(syntheticPixels())
  const center = field.angle[32 * field.width + 32]
  const deg = Math.abs((center * 180) / Math.PI) % 180
  assert.ok(deg < 20 || deg > 160, `走向角 ${deg} 应接近水平`)
  assert.ok(field.strength[32 * field.width + 32] > 0.3)
})

// 4. 排块可复现 + 20 万性能
const materials: Material[] = Array.from({ length: 24 }, (_, i) => ({
  id: `m_${i}`,
  code: `G-${100 + i}`,
  name: `测试材料 ${i}`,
  kind: i === 0 ? 'gold' : 'glass',
  rgb: [(i * 37) % 255, (i * 91) % 255, (i * 173) % 255],
  opacity: 0.9,
  roughness: 0.35,
  reflectivity: 0.55,
  stock: 100000,
}))

const params: TilingParams = {
  tileSize: 0.01,
  grout: 0.0015,
  sizeJitter: 0.12,
  cutJitter: 0.1,
  angleJitter: 6,
  flowFollow: 0.7,
  seed: 71001,
}

// 10m × 2m，10mm 块 ≈ 14.8 万；再压一档验证 20 万级
test('同参数同种子排块字节级一致', () => {
  const out1 = generateTiling({ params, wallWidth: 10, wallHeight: 2, pixels: null, flow: null, materials })
  const out2 = generateTiling({ params, wallWidth: 10, wallHeight: 2, pixels: null, flow: null, materials })
  assert.equal(out1.count, out2.count)
  assert.ok(out1.count > 100000)
  assert.deepEqual(new Uint8Array(out1.buffer), new Uint8Array(out2.buffer))
  assert.deepEqual(out1.materialTable, out2.materialTable)
})

test('改种子后结果变化', () => {
  const out1 = generateTiling({ params, wallWidth: 4, wallHeight: 2, pixels: null, flow: null, materials })
  const out2 = generateTiling({
    params: { ...params, seed: 888 },
    wallWidth: 4,
    wallHeight: 2,
    pixels: null,
    flow: null,
    materials,
  })
  assert.notDeepEqual(new Uint8Array(out1.buffer), new Uint8Array(out2.buffer))
})

test('20 万级排块性能与存储紧凑度', () => {
  const bigParams: TilingParams = { ...params, tileSize: 0.008, grout: 0.0012 }
  const t0 = performance.now()
  const out = generateTiling({ params: bigParams, wallWidth: 10, wallHeight: 2, pixels: null, flow: null, materials })
  const ms = performance.now() - t0
  console.log(`    ${out.count.toLocaleString()} 块，耗时 ${ms.toFixed(0)}ms，缓冲 ${(out.buffer.byteLength / 1024 / 1024).toFixed(2)}MB`)
  assert.ok(out.count > 180000, '应达到 20 万量级')
  assert.ok(ms < 3000, '排块应在 3 秒内完成')
  assert.equal(out.buffer.byteLength, out.count * 24)
})

// 5. 墙面几何
test('平面/弧面/穹顶几何与法线', () => {
  const p = wallPoint({ kind: 'plane', width: 6, height: 3, curvature: 0, azimuth: 0 }, 0.5, 0.5)
  assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.y) < 1e-9 && p.z === 0)
  const n = wallNormal({ kind: 'curved', width: 6, height: 3, curvature: 0.9, azimuth: 0 }, 0.5, 0.5)
  assert.ok(Math.abs(n.x) < 1e-9 && Math.abs(n.z - 1) < 1e-9)
  const domeTop = wallPoint({ kind: 'dome', width: 5, height: 2.5, curvature: 2.5, azimuth: 0 }, 0.5, 1)
  assert.ok(domeTop.y > 0)
})

test('射线拾取平面墙往返一致', () => {
  const wall = { kind: 'plane' as const, width: 6, height: 3, curvature: 0, azimuth: 0 }
  const hit = rayIntersect(wall, { x: 1, y: 0.5, z: 5 }, { x: 0, y: 0, z: -1 })
  assert.ok(hit)
  assert.ok(Math.abs(hit!.u - (1 + 3) / 6) < 1e-6)
})

console.log(`\n全部 ${passed} 项测试通过`)
