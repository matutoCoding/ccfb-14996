// 图像工具：像素采样、积分图（SAT）快速取区域平均色

export interface ImagePixels {
  width: number
  height: number
  rgba: Uint8ClampedArray
}

export async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

// 降采样到工作分辨率，20 万级取色时控制成本
export function toPixels(img: HTMLImageElement, maxDim = 512): ImagePixels {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, width, height)
  return { width, height, rgba: ctx.getImageData(0, 0, width, height).data }
}

// 三通道积分图（Float64），支持 O(1) 区域平均
export interface SumAreaTable {
  width: number
  height: number
  r: Float64Array
  g: Float64Array
  b: Float64Array
}

export function buildSAT(p: ImagePixels): SumAreaTable {
  const { width: w, height: h, rgba } = p
  const r = new Float64Array(w * h)
  const g = new Float64Array(w * h)
  const b = new Float64Array(w * h)
  for (let y = 0; y < h; y++) {
    let sr = 0
    let sg = 0
    let sb = 0
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const pi = i * 4
      sr += rgba[pi]
      sg += rgba[pi + 1]
      sb += rgba[pi + 2]
      const up = y > 0 ? i - w : 0
      r[i] = sr + (y > 0 ? r[up] : 0)
      g[i] = sg + (y > 0 ? g[up] : 0)
      b[i] = sb + (y > 0 ? b[up] : 0)
    }
  }
  return { width: w, height: h, r, g, b }
}

function satAt(t: Float64Array, w: number, x: number, y: number): number {
  if (x < 0 || y < 0) return 0
  const xi = Math.min(x, w - 1)
  const yi = Math.min(y, t.length / w - 1)
  return t[yi * w + xi]
}

// 归一化 UV 矩形区域平均 sRGB
export function regionAverage(
  sat: SumAreaTable,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
): [number, number, number] {
  const { width: w, height: h, r, g, b } = sat
  const x0 = Math.max(0, Math.floor(u0 * w))
  const y0 = Math.max(0, Math.floor(v0 * h))
  const x1 = Math.min(w - 1, Math.ceil(u1 * w) - 1)
  const y1 = Math.min(h - 1, Math.ceil(v1 * h) - 1)
  if (x1 < x0 || y1 < y0) return [128, 128, 128]
  const n = (x1 - x0 + 1) * (y1 - y0 + 1)
  const sum = (t: Float64Array) =>
    satAt(t, w, x1, y1) - satAt(t, w, x0 - 1, y1) - satAt(t, w, x1, y0 - 1) + satAt(t, w, x0 - 1, y0 - 1)
  return [sum(r) / n, sum(g) / n, sum(b) / n]
}

export function pixelAt(p: ImagePixels, u: number, v: number): [number, number, number] {
  const x = Math.min(p.width - 1, Math.max(0, Math.floor(u * p.width)))
  const y = Math.min(p.height - 1, Math.max(0, Math.floor(v * p.height)))
  const i = (y * p.width + x) * 4
  return [p.rgba[i], p.rgba[i + 1], p.rgba[i + 2]]
}
