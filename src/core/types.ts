// 领域模型与存储结构

export type WallKind = 'plane' | 'curved' | 'dome'
export type MaterialKind = 'glass' | 'gold' | 'stone'

export interface WallConfig {
  kind: WallKind
  width: number // 墙面宽度（米），半穹顶为弧面展开宽度
  height: number // 墙面高度（米），半穹顶为拱高
  curvature: number // 曲率：平面=0，弧面=弧面高度（米），穹顶=拱起高度（米）
  azimuth: number // 朝向角（度），0=正北，顺时针
}

export interface Material {
  id: string
  code: string // 颜色编号，如 G-102
  name: string
  kind: MaterialKind
  rgb: [number, number, number]
  opacity: number // 0~1
  roughness: number // 表面起伏：0 镜面 ~ 1 粗糙
  reflectivity: number // 反光强度 0~1
  stock: number // 库存数量（块）
}

export interface Project {
  id: string
  name: string
  wall: WallConfig
  sourceImageId: string | null
  createdAt: number
  updatedAt: number
  currentVersionId: string | null
}

export interface TilingParams {
  tileSize: number // 目标块尺寸（米）
  grout: number // 缝宽（米）
  sizeJitter: number // 尺寸随机度 0~0.5
  cutJitter: number // 切割随机度（边长差）0~0.5
  angleJitter: number // 倾斜角随机度（度）
  flowFollow: number // 顺走向强度 0~1
  seed: number // 随机种子，同参数同种子结果一致
}

export interface SourceImage {
  id: string
  name: string
  width: number
  height: number
  dataUrl: string // 位图
  flowUrl: string | null // 引导线可视化图
  createdAt: number
}

export interface TilingStats {
  count: number
  colorCount: number
  warnings: string[]
  stockShortages: { materialId: string; need: number; stock: number }[]
}

export interface TileVersion {
  id: string
  projectId: string
  label: string
  params: TilingParams
  materialTable: Record<string, string> // 局部索引 -> 材料 id
  stats: TilingStats
  createdAt: number
  note: string
}

// 每块 24 字节小端紧凑存储，20 万块约 4.6MB
export const TILE_STRIDE = 24

export interface TileView {
  x: number
  y: number
  w: number
  h: number
  angle: number // 弧度
  materialIndex: number
}

export function readTile(data: DataView, i: number): TileView {
  const o = i * TILE_STRIDE
  return {
    x: data.getFloat32(o, true),
    y: data.getFloat32(o + 4, true),
    w: data.getFloat32(o + 8, true),
    h: data.getFloat32(o + 12, true),
    angle: data.getFloat32(o + 16, true),
    materialIndex: data.getUint32(o + 20, true),
  }
}

export function writeTile(data: DataView, i: number, t: TileView): void {
  const o = i * TILE_STRIDE
  data.setFloat32(o, t.x, true)
  data.setFloat32(o + 4, t.y, true)
  data.setFloat32(o + 8, t.w, true)
  data.setFloat32(o + 12, t.h, true)
  data.setFloat32(o + 16, t.angle, true)
  data.setUint32(o + 20, t.materialIndex, true)
}
