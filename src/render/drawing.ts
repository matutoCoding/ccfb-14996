// 施工图：每平方米分格渲染、块颜色编号、材料清单汇总
import { readTile, type Material, type TileVersion, type WallConfig } from '@/core/types'

export interface BomRow {
  material: Material
  count: number
  area: number // ㎡
  stockDelta: number // 负=缺料
}

export function buildBom(
  buffer: ArrayBuffer,
  count: number,
  version: TileVersion,
  materials: Material[],
): BomRow[] {
  const view = new DataView(buffer)
  const counter = new Map<string, number>()
  for (let i = 0; i < count; i++) {
    const t = readTile(view, i)
    const id = version.materialTable[String(t.materialIndex)]
    counter.set(id, (counter.get(id) ?? 0) + 1)
  }
  const matById = new Map(materials.map((m) => [m.id, m]))
  return [...counter.entries()]
    .map(([id, n]) => {
      const material = matById.get(id)
      if (!material) return null
      const sample = version.params.tileSize
      return {
        material,
        count: n,
        area: n * sample * sample,
        stockDelta: material.stock - n,
      }
    })
    .filter((r): r is BomRow => r !== null)
    .sort((a, b) => a.material.code.localeCompare(b.material.code))
}

export interface SheetCell {
  col: number
  row: number
}

// 每平方米一张分格
export function sheetCells(wall: WallConfig): SheetCell[] {
  const cols = Math.ceil(wall.width)
  const rows = Math.ceil(wall.height)
  const cells: SheetCell[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) cells.push({ col, row })
  }
  return cells
}

// 绘制单张 1㎡ 分格图，pxPerM 控制出图精度
export function drawSheet(
  ctx: CanvasRenderingContext2D,
  buffer: ArrayBuffer,
  count: number,
  version: TileVersion,
  materials: Material[],
  _wall: WallConfig,
  cell: SheetCell,
  pxPerM: number,
  showCode: boolean,
): void {
  const matById = new Map(materials.map((m) => [m.id, m]))
  const view = new DataView(buffer)
  const size = pxPerM
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#3c3f45'
  ctx.fillRect(0, 0, size, size)
  const x0 = cell.col
  const y0 = cell.row
  for (let i = 0; i < count; i++) {
    const t = readTile(view, i)
    if (t.x < x0 - 0.05 || t.x > x0 + 1.05 || t.y < y0 - 0.05 || t.y > y0 + 1.05) continue
    const mat = matById.get(version.materialTable[String(t.materialIndex)])
    const rgb = mat?.rgb ?? [200, 200, 200]
    const px = (t.x - x0) * pxPerM
    const py = (t.y - y0) * pxPerM
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(t.angle)
    const w = Math.max(1, t.w * pxPerM)
    const h = Math.max(1, t.h * pxPerM)
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    ctx.fillRect(-w / 2, -h / 2, w, h)
    // 深色块用白字、浅色块用黑字
    if (showCode && mat && w > 14) {
      const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
      ctx.fillStyle = luminance > 140 ? '#1e293b' : '#f8fafc'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(mat.code, 0, 0)
    }
    ctx.restore()
  }
  // 分格边框与坐标
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, size - 2, size - 2)
  ctx.fillStyle = '#1e293b'
  ctx.font = '600 13px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`分格 X${cell.col + 1} / Y${cell.row + 1}（1㎡）`, 8, 18)
}
