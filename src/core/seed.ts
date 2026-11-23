// 确定性生成测试数据：三套原稿（人像 / 几何 / 穹顶）+ 三类材料库
// 全部用 Canvas 2D 程序化绘制，无外部资源，结果固定
import { materialRepo, projectRepo, sourceRepo } from './db'
import type { Material, ProjectMeta, WallSpec } from './types'
import { Rng } from './rng'

const MATERIAL_SEED: Omit<Material, 'id'>[] = [
  // 玻璃块：威尼斯珐琅色系
  { name: '穆拉诺白', category: 'glass', color: [238, 232, 220], opacity: 0.92, roughness: 0.22, reflectivity: 0.7, stock: 60000 },
  { name: '苍穹蓝', category: 'glass', color: [38, 78, 142], opacity: 0.88, roughness: 0.18, reflectivity: 0.8, stock: 42000 },
  { name: '深海青', category: 'glass', color: [26, 108, 112], opacity: 0.9, roughness: 0.2, reflectivity: 0.75, stock: 30000 },
  { name: '祭袍红', category: 'glass', color: [150, 32, 42], opacity: 0.9, roughness: 0.24, reflectivity: 0.65, stock: 26000 },
  { name: '琥珀金茶', category: 'glass', color: [196, 132, 48], opacity: 0.85, roughness: 0.2, reflectivity: 0.85, stock: 24000 },
  { name: '橄榄绿', category: 'glass', color: [96, 112, 58], opacity: 0.9, roughness: 0.26, reflectivity: 0.6, stock: 22000 },
  { name: '紫罗兰夜', category: 'glass', color: [86, 58, 122], opacity: 0.88, roughness: 0.22, reflectivity: 0.72, stock: 18000 },
  { name: '肉粉暖调', category: 'glass', color: [224, 178, 150], opacity: 0.94, roughness: 0.3, reflectivity: 0.5, stock: 34000 },
  { name: '石灰冷调', category: 'glass', color: [206, 196, 184], opacity: 0.95, roughness: 0.32, reflectivity: 0.45, stock: 28000 },
  { name: '鸦青', category: 'glass', color: [34, 42, 54], opacity: 0.92, roughness: 0.28, reflectivity: 0.55, stock: 20000 },
  // 金箔块
  { name: '足金箔', category: 'gold', color: [212, 170, 72], opacity: 1, roughness: 0.08, reflectivity: 1, stock: 9000 },
  { name: '白金箔', category: 'gold', color: [226, 220, 200], opacity: 1, roughness: 0.1, reflectivity: 0.95, stock: 5000 },
  { name: '赤金箔', category: 'gold', color: [196, 128, 46], opacity: 1, roughness: 0.12, reflectivity: 0.95, stock: 4200 },
  // 石头
  { name: '卡拉拉白', category: 'stone', color: [228, 226, 220], opacity: 1, roughness: 0.55, reflectivity: 0.25, stock: 16000 },
  { name: '维罗纳砂岩', category: 'stone', color: [178, 152, 118], opacity: 1, roughness: 0.62, reflectivity: 0.2, stock: 14000 },
  { name: '板岩灰', category: 'stone', color: [88, 92, 98], opacity: 1, roughness: 0.58, reflectivity: 0.22, stock: 12000 },
]

export async function seedMaterials(): Promise<Material[]> {
  const existing = await materialRepo.list()
  if (existing.length > 0) return existing
  const list: Material[] = MATERIAL_SEED.map((m, i) => ({ ...m, id: `mat-${String(i + 1).padStart(2, '0')}` }))
  for (const m of list) await materialRepo.save(m)
  return list
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  return [c, ctx]
}

// 人像：金色光环 + 面部明暗 + 衣褶（走向明显，供引导场追踪）
function paintPortrait(): HTMLCanvasElement {
  const [c, ctx] = canvas(480)
  const rng = new Rng(7711)
  const grad = ctx.createLinearGradient(0, 0, 0, 480)
  grad.addColorStop(0, '#264e8e')
  grad.addColorStop(1, '#1a2540')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 480, 480)
  // 光环
  ctx.beginPath()
  ctx.arc(240, 188, 108, 0, Math.PI * 2)
  ctx.fillStyle = '#d4aa48'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(240, 188, 96, 0, Math.PI * 2)
  ctx.fillStyle = '#c48430'
  ctx.fill()
  // 肩颈袍服
  ctx.beginPath()
  ctx.moveTo(96, 480)
  ctx.quadraticCurveTo(240, 286, 384, 480)
  ctx.closePath()
  ctx.fillStyle = '#96202a'
  ctx.fill()
  // 衣褶：弧形明暗条纹
  for (let i = 0; i < 14; i++) {
    const x = 120 + i * 18
    ctx.beginPath()
    ctx.moveTo(x, 480)
    ctx.quadraticCurveTo(240 + rng.range(-30, 30), 360, x + rng.range(-14, 14), 300)
    ctx.lineWidth = 5 + rng.next() * 5
    ctx.strokeStyle = i % 2 ? '#7a1822' : '#b0303c'
    ctx.stroke()
  }
  // 脸
  ctx.beginPath()
  ctx.ellipse(240, 196, 62, 78, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#e0b296'
  ctx.fill()
  // 面部阴影侧
  ctx.beginPath()
  ctx.ellipse(262, 202, 34, 70, 0, -0.4, Math.PI * 0.9)
  ctx.fillStyle = '#c89072'
  ctx.fill()
  // 发
  ctx.beginPath()
  ctx.arc(240, 158, 64, Math.PI, Math.PI * 2)
  ctx.fillStyle = '#222a36'
  ctx.fill()
  // 眼鼻嘴
  ctx.fillStyle = '#3a2a24'
  ctx.beginPath(); ctx.ellipse(218, 192, 7, 4, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(262, 192, 7, 4, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#a87058'; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(240, 196); ctx.lineTo(236, 222); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(222, 238); ctx.quadraticCurveTo(240, 248, 260, 236); ctx.stroke()
  // 马赛克颗粒感噪点
  const img = ctx.getImageData(0, 0, 480, 480)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng.next() - 0.5) * 18
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// 几何图案：交错菱形与放射星，硬边缘丰富
function paintGeometry(): HTMLCanvasElement {
  const [c, ctx] = canvas(480)
  const rng = new Rng(3329)
  ctx.fillStyle = '#ece8dc'
  ctx.fillRect(0, 0, 480, 480)
  const palette = ['#264e8e', '#96202a', '#c48430', '#60703a', '#1a6c70', '#563a7a']
  const cell = 48
  for (let y = 0; y < 480; y += cell) {
    for (let x = 0; x < 480; x += cell) {
      const pick = palette[rng.int(palette.length)]
      ctx.save()
      ctx.translate(x + cell / 2, y + cell / 2)
      ctx.rotate((rng.int(4) * Math.PI) / 2)
      ctx.beginPath()
      ctx.moveTo(0, -cell / 2 + 4)
      ctx.lineTo(cell / 2 - 4, 0)
      ctx.lineTo(0, cell / 2 - 4)
      ctx.lineTo(-cell / 2 + 4, 0)
      ctx.closePath()
      ctx.fillStyle = pick
      ctx.fill()
      ctx.restore()
    }
  }
  // 中央八芒星
  ctx.save()
  ctx.translate(240, 240)
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(-14, -86)
    ctx.lineTo(14, -86)
    ctx.closePath()
    ctx.fillStyle = i % 2 ? '#d4aa48' : '#e2dcc8'
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, 0, 34, 0, Math.PI * 2)
  ctx.fillStyle = '#96202a'
  ctx.fill()
  ctx.restore()
  return c
}

// 半穹顶稿：环带 + 径向光芒，贴合穹顶 uv
function paintDome(): HTMLCanvasElement {
  const [c, ctx] = canvas(512)
  const grad = ctx.createRadialGradient(256, 120, 30, 256, 256, 360)
  grad.addColorStop(0, '#d4aa48')
  grad.addColorStop(0.45, '#264e8e')
  grad.addColorStop(1, '#222a36')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 512, 512)
  // 径向光芒
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(256, 140)
    ctx.lineTo(256 + Math.cos(a) * 420, 140 + Math.sin(a) * 420)
    ctx.lineWidth = i % 2 ? 10 : 4
    ctx.strokeStyle = i % 2 ? 'rgba(212,170,72,0.85)' : 'rgba(238,232,220,0.5)'
    ctx.stroke()
  }
  // 环带圣像剪影
  for (let ring = 0; ring < 3; ring++) {
    const r = 90 + ring * 70
    const n = 8 + ring * 4
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.2
      const x = 256 + Math.cos(a) * r
      const y = 256 + Math.sin(a) * r * 0.6
      ctx.beginPath()
      ctx.arc(x, y, 16 + ring * 2, 0, Math.PI * 2)
      ctx.fillStyle = ring === 1 ? '#96202a' : '#e0b296'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y - 4, 9, 0, Math.PI * 2)
      ctx.fillStyle = '#d4aa48'
      ctx.fill()
    }
  }
  return c
}

interface SeedProject {
  meta: Omit<ProjectMeta, 'createdAt' | 'updatedAt' | 'currentVersionId'>
  painter: () => HTMLCanvasElement
}

const PROJECTS: SeedProject[] = [
  {
    meta: {
      id: 'proj-portrait',
      name: '圣像人像墙 · 酒店大堂',
      client: '威尼斯人酒店',
      wall: { kind: 'flat', width: 5, height: 4, radius: 0, arcAngle: 0, azimuth: Math.PI } satisfies WallSpec,
      sourceWidth: 480,
      sourceHeight: 480,
      sourceName: 'portrait.png',
    },
    painter: paintPortrait,
  },
  {
    meta: {
      id: 'proj-geometry',
      name: '几何拼花走廊 · 弧墙',
      client: '教区迎宾厅',
      wall: { kind: 'arc', width: 6, height: 3.2, radius: 6, arcAngle: Math.PI / 3, azimuth: 0 } satisfies WallSpec,
      sourceWidth: 480,
      sourceHeight: 480,
      sourceName: 'geometry.png',
    },
    painter: paintGeometry,
  },
  {
    meta: {
      id: 'proj-dome',
      name: '半穹顶荣光图 · 礼拜堂',
      client: '圣马可小礼拜堂',
      wall: { kind: 'dome', width: 8, height: 6, radius: 4, arcAngle: Math.PI, azimuth: 0 } satisfies WallSpec,
      sourceWidth: 512,
      sourceHeight: 512,
      sourceName: 'dome.png',
    },
    painter: paintDome,
  },
]

export async function seedProjects(): Promise<void> {
  const existing = await projectRepo.list()
  if (existing.length > 0) return
  const now = Date.now()
  for (const [i, sp] of PROJECTS.entries()) {
    const canvasEl = sp.painter()
    const blob = await new Promise<Blob>((resolve) => canvasEl.toBlob((b) => resolve(b!), 'image/png'))
    await sourceRepo.save(sp.meta.id, blob, sp.meta.sourceWidth, sp.meta.sourceHeight)
    await projectRepo.save({
      ...sp.meta,
      createdAt: now - (PROJECTS.length - i) * 86400000,
      updatedAt: now - (PROJECTS.length - i) * 86400000,
      currentVersionId: null,
    })
  }
}

export async function seedAll(): Promise<void> {
  await seedMaterials()
  await seedProjects()
}
