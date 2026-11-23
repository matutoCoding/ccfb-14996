// 施工图：按 1 平方米分格渲染 2D 图纸，块标颜色编号；材料清单按颜色汇总
import type { LayoutTiles, Material, WallSpec } from './types'
import { readTile } from './layout'
import { uvScale, wallArea } from './geometry'

export interface MaterialBill {
  materialId: string
  name: string
  category: Material['category']
  color: [number, number, number]
  count: number
  area: number // 平方米
  stock: number
  shortage: number
}

export function buildBill(tiles: LayoutTiles, materials: Material[], wall: WallSpec): MaterialBill[] {
  const counts = new Map<string, number>()
  for (let i = 0; i < tiles.count; i++) {
    const t = readTile(tiles.data, i)
    const entry = tiles.palette[t.paletteIdx]
    if (!entry) continue
    counts.set(entry.materialId, (counts.get(entry.materialId) ?? 0) + 1)
  }
  const area = wallArea(wall)
  return materials
    .filter((m) => counts.has(m.id))
    .map((m) => {
      const count = counts.get(m.id) ?? 0
      return {
        materialId: m.id,
        name: m.name,
        category: m.category,
        color: m.color,
        count,
        area: (count / Math.max(1, tiles.count)) * area,
        stock: m.stock,
        shortage: Math.max(0, count - m.stock),
      }
    })
    .sort((a, b) => b.count - a.count)
}

// 物理米坐标 -> 图纸像素
export interface SheetCell {
  col: number
  row: number
  canvas: HTMLCanvasElement
}

// 每平方米一张分格图，返回画布数组（打印时逐页输出）
export function renderSheets(
  wall: WallSpec,
  tiles: LayoutTiles,
  pxPerMeter = 220,
  labelEvery = 1,
): SheetCell[] {
  const { su, sv } = uvScale(wall)
  const colsM = Math.ceil(su)
  const rowsM = Math.ceil(sv)
  const sheets: SheetCell[] = []
  const cellPx = pxPerMeter

  for (let row = 0; row < rowsM; row++) {
    for (let col = 0; col < colsM; col++) {
      const canvasEl = document.createElement('canvas')
      canvasEl.width = cellPx + 48
      canvasEl.height = cellPx + 64
      const ctx = canvasEl.getContext('2d')!
      ctx.fillStyle = '#f7f6f2'
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height)
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 2
      ctx.strokeRect(24, 24, cellPx, cellPx)
      ctx.fillStyle = '#111827'
      ctx.font = '600 15px system-ui, sans-serif'
      ctx.fillText(`分格 ${String.fromCharCode(65 + row)}-${col + 1}  (1m × 1m)`, 24, 16)

      const u0 = col / su
      const u1 = (col + 1) / su
      const v0 = row / sv
      const v1 = (row + 1) / sv
      let drawn = 0
      for (let i = 0; i < tiles.count; i++) {
        const t = readTile(tiles.data, i)
        if (t.cu < u0 || t.cu > u1 || t.cv < v0 || t.cv > v1) continue
        const entry = tiles.palette[t.paletteIdx]
        if (!entry) continue
        const px = 24 + ((t.cu - u0) / (u1 - u0)) * cellPx
        const py = 24 + ((t.cv - v0) / (v1 - v0)) * cellPx
        const wpx = (t.wu / (u1 - u0)) * cellPx
        const hpx = (t.hv / (v1 - v0)) * cellPx
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(-t.tilt)
        ctx.fillStyle = rgb(entry.color)
        ctx.fillRect(-wpx / 2, -hpx / 2, wpx, hpx)
        ctx.strokeStyle = 'rgba(17,24,39,0.55)'
        ctx.lineWidth = 0.6
        ctx.strokeRect(-wpx / 2, -hpx / 2, wpx, hpx)
        if (labelEvery > 0 && drawn % labelEvery === 0 && wpx > 7) {
          ctx.rotate(t.tilt)
          ctx.fillStyle = luminance(entry.color) > 150 ? '#111827' : '#f9fafb'
          ctx.font = '500 9px system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(codeOf(entry.materialId), 0, 0)
        }
        ctx.restore()
        drawn++
      }
      sheets.push({ col, row, canvas: canvasEl })
    }
  }
  return sheets
}

// 颜色编号：材料 id 序号 + 十六进制简码
export function codeOf(materialId: string): string {
  const n = materialId.replace(/\D/g, '')
  return `C${n || '?'}`
}

function rgb(c: [number, number, number]): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

function luminance(c: [number, number, number]): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

// 触发浏览器打印：把分格画布挂到隐藏打印区
export function printSheets(sheets: SheetCell[], title: string): void {
  const win = window.open('', '_blank')
  if (!win) return
  const body = sheets
    .map(
      (s) =>
        `<section style="page-break-after:always;text-align:center">
<h3 style="font-family:sans-serif">${title} — 分格 ${String.fromCharCode(65 + s.row)}-${s.col + 1}</h3>
<img src="${s.canvas.toDataURL('image/png')}" style="max-width:100%">
</section>`,
    )
    .join('')
  win.document.write(`<title>${title} 施工图</title><body style="margin:24px">${body}</body>`)
  win.document.close()
  win.onload = () => win.print()
}
