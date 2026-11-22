// 程序化生成测试原稿：人像、几何图案、半穹顶穹顶画
import type { SourceImage } from '@/core/types'
import { uid } from '@/core/rng'

const W = 480
const H = 640

function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  return [canvas, canvas.getContext('2d')!]
}

function toSource(name: string, canvas: HTMLCanvasElement): SourceImage {
  return {
    id: uid('img'),
    name,
    width: W,
    height: H,
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    flowUrl: null,
    createdAt: Date.now(),
  }
}

// 人像：暗背景 + 面部亮椭圆 + 五官暗部 + 弧形衣褶（走向引导用）
function drawPortrait(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas()
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#3a3542')
  bg.addColorStop(1, '#22202a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 肩颈衣袍
  ctx.fillStyle = '#7a6f86'
  ctx.beginPath()
  ctx.moveTo(60, H)
  ctx.quadraticCurveTo(140, 430, 240, 420)
  ctx.quadraticCurveTo(340, 430, 420, H)
  ctx.closePath()
  ctx.fill()
  // 衣褶：多条同心弧线，制造强走向
  ctx.strokeStyle = '#4c4458'
  ctx.lineWidth = 7
  for (let k = 0; k < 7; k++) {
    ctx.beginPath()
    ctx.arc(240, 520 + k * 26, 130 + k * 22, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()
  }
  ctx.strokeStyle = '#a89cb8'
  ctx.lineWidth = 3
  for (let k = 0; k < 7; k++) {
    ctx.beginPath()
    ctx.arc(240, 520 + k * 26, 118 + k * 22, Math.PI * 1.18, Math.PI * 1.82)
    ctx.stroke()
  }

  // 颈部
  ctx.fillStyle = '#d8b394'
  ctx.fillRect(212, 340, 56, 90)
  // 面部
  const face = ctx.createRadialGradient(230, 240, 30, 240, 260, 130)
  face.addColorStop(0, '#f0d2b4')
  face.addColorStop(1, '#c99878')
  ctx.fillStyle = face
  ctx.beginPath()
  ctx.ellipse(240, 250, 96, 118, 0, 0, Math.PI * 2)
  ctx.fill()
  // 头发
  ctx.fillStyle = '#3a2a22'
  ctx.beginPath()
  ctx.ellipse(240, 180, 108, 86, 0, Math.PI, Math.PI * 2)
  ctx.quadraticCurveTo(350, 240, 330, 300)
  ctx.quadraticCurveTo(240, 250, 150, 300)
  ctx.quadraticCurveTo(132, 235, 132, 185)
  ctx.fill()
  // 五官暗部（眼睛、鼻翼、嘴唇）
  ctx.fillStyle = '#5a4034'
  ctx.beginPath()
  ctx.ellipse(206, 252, 14, 7, 0, 0, Math.PI * 2)
  ctx.ellipse(274, 252, 14, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#a97b62'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(240, 262)
  ctx.quadraticCurveTo(232, 292, 240, 300)
  ctx.stroke()
  ctx.fillStyle = '#9c4f4f'
  ctx.beginPath()
  ctx.ellipse(240, 318, 26, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  // 面部明暗交界
  ctx.fillStyle = 'rgba(120, 70, 50, 0.28)'
  ctx.beginPath()
  ctx.ellipse(286, 268, 42, 92, 0.1, 0, Math.PI * 2)
  ctx.fill()
  return canvas
}

// 几何图案：对称八角星 + 回纹边框 + 对角条纹带
function drawGeometric(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas()
  ctx.fillStyle = '#e8e2d4'
  ctx.fillRect(0, 0, W, H)
  // 回纹边框
  ctx.strokeStyle = '#244470'
  ctx.lineWidth = 10
  ctx.strokeRect(24, 24, W - 48, H - 48)
  ctx.lineWidth = 3
  ctx.strokeRect(42, 42, W - 84, H - 84)
  for (let y = 60; y < H - 60; y += 28) {
    ctx.strokeRect(30, y, 16, 16)
    ctx.strokeRect(W - 46, y, 16, 16)
  }
  // 对角条纹带
  ctx.save()
  ctx.strokeStyle = '#a84e38'
  ctx.lineWidth = 12
  for (let i = -H; i < W; i += 44) {
    ctx.beginPath()
    ctx.moveTo(i, 70)
    ctx.lineTo(i + H, H - 70)
    ctx.stroke()
  }
  ctx.restore()
  // 中央八角星（两个旋转正方形）
  const drawSquare = (rot: number, color: string) => {
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(rot)
    ctx.fillStyle = color
    ctx.fillRect(-120, -120, 240, 240)
    ctx.restore()
  }
  drawSquare(Math.PI / 4, '#1c7066')
  drawSquare(0, '#c48430')
  ctx.fillStyle = '#26282e'
  ctx.beginPath()
  ctx.arc(W / 2, H / 2, 46, 0, Math.PI * 2)
  ctx.fill()
  // 上下半圆装饰
  ctx.fillStyle = '#764e8a'
  ctx.beginPath()
  ctx.arc(W / 2, 150, 54, 0, Math.PI)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(W / 2, H - 150, 54, Math.PI, Math.PI * 2)
  ctx.fill()
  return canvas
}

// 半穹顶画：同心环 + 径向放射线 + 中央圣光（贴合穹顶 UV 展开）
function drawDome(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas()
  const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * 0.7)
  bg.addColorStop(0, '#e4d8a8')
  bg.addColorStop(0.5, '#4a6f9c')
  bg.addColorStop(1, '#1f3350')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const cx = W / 2
  const cy = H / 2
  // 同心环带
  const ringColors = ['#d6b252', '#7c4e8a', '#1c7066', '#a84e38', '#e8e2d4']
  ringColors.forEach((color, i) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 16
    ctx.beginPath()
    ctx.arc(cx, cy, 80 + i * 52, 0, Math.PI * 2)
    ctx.stroke()
  })
  // 12 道径向放射线
  ctx.strokeStyle = 'rgba(214,178,82,0.85)'
  ctx.lineWidth = 5
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60)
    ctx.lineTo(cx + Math.cos(a) * 300, cy + Math.sin(a) * 300)
    ctx.stroke()
  }
  // 中央圣光圆
  const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, 70)
  halo.addColorStop(0, '#fff6d8')
  halo.addColorStop(1, 'rgba(255,236,170,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, 70, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f4ead0'
  ctx.beginPath()
  ctx.arc(cx, cy, 30, 0, Math.PI * 2)
  ctx.fill()
  return canvas
}

export function seedImages(): SourceImage[] {
  return [
    toSource('人像原稿（测试）', drawPortrait()),
    toSource('几何图案原稿（测试）', drawGeometric()),
    toSource('半穹顶穹顶画原稿（测试）', drawDome()),
  ]
}
