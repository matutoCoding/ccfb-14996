// 原稿分析：灰度 -> Sobel 梯度 -> 结构张量 -> 走向场
// 走向定义为与梯度垂直的方向（沿轮廓/衣褶走向），人脸轮廓与褶皱会自然顺向
import type { FlowField, GuideLine } from './types'
import { averageSRGB, type SRGB } from './color'

export interface SourceImage {
  imageData: ImageData // 降采样后的全像素
  width: number
  height: number
}

export async function loadSourceImage(file: File | Blob, maxSize = 512): Promise<SourceImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建 2D 上下文')
  ctx.drawImage(bitmap, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  bitmap.close()
  return { imageData, width, height }
}

function toGray(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    gray[i] = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]
  }
  return gray
}

// 在网格点上聚合结构张量 J = [[gx², gxgy],[gxgy, gy²]] 的局部均值
// 主特征向量是梯度方向，走向取其垂直方向
export function buildFlowField(src: SourceImage, gridCols = 48, gridRows = 48): FlowField {
  const { imageData, width, height } = src
  const gray = toGray(imageData.data, width, height)
  const gx = new Float32Array(width * height)
  const gy = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      gx[i] =
        gray[i - 1] * -1 +
        gray[i + 1] +
        gray[i - width - 1] * -2 +
        gray[i - width + 1] * 2 +
        gray[i + width - 1] * -1 +
        gray[i + width + 1]
      gy[i] =
        gray[i - width - 1] +
        gray[i - width] * 2 +
        gray[i - width + 1] -
        gray[i + width - 1] -
        gray[i + width] * 2 -
        gray[i + width + 1]
    }
  }

  const angle = new Float32Array(gridCols * gridRows)
  const strength = new Float32Array(gridCols * gridRows)
  const cellW = width / gridCols
  const cellH = height / gridRows

  for (let gyi = 0; gyi < gridRows; gyi++) {
    for (let gxi = 0; gxi < gridCols; gxi++) {
      let jxx = 0
      let jxy = 0
      let jyy = 0
      const x0 = Math.max(1, Math.floor(gxi * cellW))
      const x1 = Math.min(width - 1, Math.ceil((gxi + 1) * cellW))
      const y0 = max1(gyi * cellH)
      const y1 = Math.min(height - 1, Math.ceil((gyi + 1) * cellH))
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * width + x
          jxx += gx[i] * gx[i]
          jxy += gx[i] * gy[i]
          jyy += gy[i] * gy[i]
        }
      }
      const n = Math.max(1, (x1 - x0) * (y1 - y0))
      jxx /= n
      jxy /= n
      jyy /= n
      // 特征值差 = 各向异性强度；走向角 = 梯度方向 + 90°
      const diff = jxx - jyy
      const gradAngle = 0.5 * Math.atan2(2 * jxy, diff)
      const idx = gyi * gridCols + gxi
      angle[idx] = gradAngle + Math.PI / 2
      const lambdaDelta = Math.sqrt(diff * diff + 4 * jxy * jxy)
      const lambdaSum = jxx + jyy + 1e-6
      strength[idx] = Math.min(1, lambdaDelta / lambdaSum)
    }
  }
  return { cols: gridCols, rows: gridRows, angle, strength }
}

function max1(v: number): number {
  return Math.max(1, Math.floor(v))
}

// 双线性采样走向角（角度做向量插值，避免 0/2π 跳变）
export function sampleFlow(field: FlowField, u: number, v: number): { angle: number; strength: number } {
  const fx = Math.min(field.cols - 1.001, Math.max(0, u * field.cols))
  const fy = Math.min(field.rows - 1.001, Math.max(0, v * field.rows))
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const at = (x: number, y: number) => field.angle[y * field.cols + x]
  const st = (x: number, y: number) => field.strength[y * field.cols + x]
  const blend = (a: number, b: number, t: number) => {
    let d = b - a
    if (d > Math.PI) d -= 2 * Math.PI
    if (d < -Math.PI) d += 2 * Math.PI
    return a + d * t
  }
  const a = blend(blend(at(x0, y0), at(x0 + 1, y0), tx), blend(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx), ty)
  const s =
    (st(x0, y0) * (1 - tx) + st(x0 + 1, y0) * tx) * (1 - ty) +
    (st(x0, y0 + 1) * (1 - tx) + st(x0 + 1, y0 + 1) * tx) * ty
  return { angle: (a + Math.PI * 2) % Math.PI, strength: s }
}

// 沿走向场积分流线，作为排块引导线
export function buildGuideLines(field: FlowField, count = 36, steps = 80): GuideLine[] {
  const lines: GuideLine[] = []
  const used = new Float32Array(field.cols * field.rows)
  for (let n = 0; n < count * 3 && lines.length < count; n++) {
    // 确定性撒点：低差异风格的网格抖动由调用方决定，这里按黄金分割布点
    const k = n * 0.61803398875
    let u = (k % 1 + 1) % 1
    let v = ((n * 0.754877666) % 1 + 1) % 1
    const gx = Math.floor(u * field.cols)
    const gy = Math.floor(v * field.rows)
    const gi = gy * field.cols + gx
    if (field.strength[gi] < 0.12 || used[gi] > 0.6) continue
    const points: [number, number][] = []
    let acc = 0
    for (let s = 0; s < steps; s++) {
      const f = sampleFlow(field, u, v)
      if (f.strength < 0.08) break
      points.push([u, v])
      acc += f.strength
      const du = (Math.cos(f.angle) * 0.012) / 1
      const dv = Math.sin(f.angle) * 0.012
      u += du
      v += dv
      if (u < 0 || u > 1 || v < 0 || v > 1) break
      const cu = Math.floor(u * field.cols)
      const cv = Math.floor(v * field.rows)
      if (cu >= 0 && cu < field.cols && cv >= 0 && cv < field.rows) used[cv * field.cols + cu] += 1
    }
    if (points.length >= 8) lines.push({ points, strength: acc / points.length })
  }
  return lines.sort((a, b) => b.strength - a.strength).slice(0, count)
}

// 在 uv 矩形区域内做面积平均取色
export function sampleAreaColor(src: SourceImage, u: number, v: number, wu: number, hv: number): SRGB {
  const { imageData, width, height } = src
  const x0 = clampInt(u * width, 0, width - 1)
  const x1 = clampInt((u + wu) * width, x0 + 1, width)
  const y0 = clampInt(v * height, 0, height - 1)
  const y1 = clampInt((v + hv) * height, y0 + 1, height)
  const samples: SRGB[] = []
  const step = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 4))
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const o = (y * width + x) * 4
      samples.push([imageData.data[o], imageData.data[o + 1], imageData.data[o + 2]])
    }
  }
  return averageSRGB(samples)
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)))
}
