// 引导线流场：Sobel 梯度 + 结构张量，求每处主体走向（边缘方向）与连贯度
import type { ImagePixels } from './image_util'

export interface FlowField {
  width: number
  height: number
  angle: Float32Array // 走向角（弧度，0~π）
  strength: Float32Array // 连贯度 0~1，低连贯区域不引导排块
}

export function computeFlowField(p: ImagePixels, smoothRadius = 6): FlowField {
  const { width: w, height: h, rgba } = p
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const j = i * 4
    gray[i] = 0.2126 * rgba[j] + 0.7152 * rgba[j + 1] + 0.0722 * rgba[j + 2]
  }
  const gx = new Float32Array(w * h)
  const gy = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      gx[i] =
        gray[i - w - 1] * -1 + gray[i - w + 1] + gray[i - 1] * -2 + gray[i + 1] * 2 +
        gray[i + w - 1] * -1 + gray[i + w + 1]
      gy[i] =
        gray[i - w - 1] - gray[i + w - 1] + (gray[i - w] - gray[i + w]) * 2 +
        gray[i - w + 1] - gray[i + w + 1]
    }
  }
  // 结构张量盒式平滑
  const jxx = new Float32Array(w * h)
  const jxy = new Float32Array(w * h)
  const jyy = new Float32Array(w * h)
  const r = smoothRadius
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sxx = 0
      let sxy = 0
      let syy = 0
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w - 1, x + r)
      const y0 = Math.max(0, y - r)
      const y1 = Math.min(h - 1, y + r)
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const i = yy * w + xx
          sxx += gx[i] * gx[i]
          sxy += gx[i] * gy[i]
          syy += gy[i] * gy[i]
        }
      }
      const i = y * w + x
      jxx[i] = sxx
      jxy[i] = sxy
      jyy[i] = syy
    }
  }
  const angle = new Float32Array(w * h)
  const strength = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    // 结构张量最小特征值方向为边缘走向：公式给出的是梯度方向，旋转 90° 得走向
    angle[i] = 0.5 * Math.atan2(2 * jxy[i], jxx[i] - jyy[i]) + Math.PI / 2
    const trace = jxx[i] + jyy[i]
    const diff = Math.hypot(jxx[i] - jyy[i], 2 * jxy[i])
    const lambda1 = (trace + diff) / 2
    const lambda2 = (trace - diff) / 2
    strength[i] = lambda1 + lambda2 > 1e-6 ? (lambda1 - lambda2) / (lambda1 + lambda2) : 0
  }
  return { width: w, height: h, angle, strength }
}

export function flowAt(field: FlowField, u: number, v: number): { angle: number; strength: number } {
  const x = Math.min(field.width - 1, Math.max(0, Math.round(u * field.width)))
  const y = Math.min(field.height - 1, Math.max(0, Math.round(v * field.height)))
  const i = y * field.width + x
  return { angle: field.angle[i], strength: field.strength[i] }
}

// 引导线可视化：在浅底上按网格画走向短线
export function renderFlowVisualization(p: ImagePixels, field: FlowField): string {
  const canvas = document.createElement('canvas')
  canvas.width = p.width
  canvas.height = p.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(new ImageData(p.rgba, p.width, p.height), 0, 0)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillRect(0, 0, p.width, p.height)
  const step = Math.max(8, Math.round(p.width / 48))
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 1.4
  for (let y = step / 2; y < p.height; y += step) {
    for (let x = step / 2; x < p.width; x += step) {
      const i = Math.round(y) * field.width + Math.round(x)
      if (field.strength[i] < 0.25) continue
      const a = field.angle[i]
      const len = (step / 2) * (0.5 + field.strength[i])
      ctx.beginPath()
      ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len)
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
      ctx.stroke()
    }
  }
  return canvas.toDataURL('image/png')
}
