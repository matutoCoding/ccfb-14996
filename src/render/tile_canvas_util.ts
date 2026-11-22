// 2D 排块画布工具：视口裁剪渲染、屏幕坐标定位单块
import { readTile, writeTile, type Material, type TileView } from '@/core/types'

export interface CanvasViewport {
  scale: number // 像素/米
  offsetX: number
  offsetY: number
}

export function fitViewport(canvasW: number, canvasH: number, wallW: number, wallH: number): CanvasViewport {
  const scale = Math.min((canvasW - 48) / wallW, (canvasH - 48) / wallH)
  return {
    scale,
    offsetX: (canvasW - wallW * scale) / 2,
    offsetY: (canvasH - wallH * scale) / 2,
  }
}

export function toWorld(vp: CanvasViewport, px: number, py: number): { x: number; y: number } {
  return { x: (px - vp.offsetX) / vp.scale, y: (py - vp.offsetY) / vp.scale }
}

// 只画视口内的块，20 万块下保持流畅
export function drawTiles(
  ctx: CanvasRenderingContext2D,
  buffer: ArrayBuffer,
  count: number,
  materialTable: Record<string, string>,
  materials: Material[],
  wallW: number,
  wallH: number,
  vp: CanvasViewport,
  selectedIndex: number,
): void {
  const matById = new Map(materials.map((m) => [m.id, m]))
  const view = new DataView(buffer)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  // 缝底（深灰勾缝）
  ctx.fillStyle = '#3c3f45'
  ctx.fillRect(vp.offsetX, vp.offsetY, wallW * vp.scale, wallH * vp.scale)

  const viewLeft = -vp.offsetX / vp.scale - 0.05
  const viewTop = -vp.offsetY / vp.scale - 0.05
  const viewRight = (ctx.canvas.width - vp.offsetX) / vp.scale + 0.05
  const viewBottom = (ctx.canvas.height - vp.offsetY) / vp.scale + 0.05

  for (let i = 0; i < count; i++) {
    const t = readTile(view, i)
    if (t.x < viewLeft || t.x > viewRight || t.y < viewTop || t.y > viewBottom) continue
    const mat = matById.get(materialTable[String(t.materialIndex)])
    const rgb = mat?.rgb ?? [200, 200, 200]
    const px = vp.offsetX + t.x * vp.scale
    const py = vp.offsetY + t.y * vp.scale
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(t.angle)
    const w = Math.max(1, t.w * vp.scale)
    const h = Math.max(1, t.h * vp.scale)
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    ctx.fillRect(-w / 2, -h / 2, w, h)
    if (i === selectedIndex) {
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 2
      ctx.strokeRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2)
    }
    ctx.restore()
  }
}

// 定位包含世界坐标的块：按网格粗筛 + 矩形旋转点包含测试
export function pickTile(
  buffer: ArrayBuffer,
  count: number,
  worldX: number,
  worldY: number,
  nominalStep: number,
  wallWidth: number,
): number {
  const view = new DataView(buffer)
  const cols = Math.max(1, Math.round(wallWidth / nominalStep))
  const guessCol = Math.floor(worldX / nominalStep)
  const guessRow = Math.floor(worldY / nominalStep)
  for (let radius = 0; radius <= 2; radius++) {
    for (let r = guessRow - radius; r <= guessRow + radius; r++) {
      for (let c = guessCol - radius; c <= guessCol + radius; c++) {
        const i = r * cols + c
        if (i < 0 || i >= count) continue
        if (insideTile(readTile(view, i), worldX, worldY)) return i
      }
    }
  }
  // 兜底：全量扫描（手动拖动过的块可能脱离原网格）
  for (let i = 0; i < count; i++) {
    if (insideTile(readTile(view, i), worldX, worldY)) return i
  }
  return -1
}

function insideTile(t: TileView, x: number, y: number): boolean {
  const dx = x - t.x
  const dy = y - t.y
  const c = Math.cos(-t.angle)
  const s = Math.sin(-t.angle)
  const lx = dx * c - dy * s
  const ly = dx * s + dy * c
  return Math.abs(lx) <= t.w / 2 && Math.abs(ly) <= t.h / 2
}

export function updateTile(buffer: ArrayBuffer, index: number, patch: Partial<TileView>): void {
  const view = new DataView(buffer)
  const current = readTile(view, index)
  writeTile(view, index, { ...current, ...patch })
}
