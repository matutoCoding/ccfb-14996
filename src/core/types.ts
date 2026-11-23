// 领域类型定义

// 墙面几何类型：平面 / 圆弧墙 / 半穹顶
export type WallKind = 'flat' | 'arc' | 'dome'

export interface WallSpec {
  kind: WallKind
  width: number // 墙宽，米
  height: number // 墙高，米（穹顶为穹顶所在圆柱段高/直径参考）
  radius: number // arc: 弧面半径米；dome: 穹顶半径米
  arcAngle: number // arc: 弧心角弧度；dome: 半穹顶角范围
  azimuth: number // 朝向，弧度（相对正南）
}

export type MaterialCategory = 'glass' | 'gold' | 'stone'

export interface Material {
  id: string
  name: string
  category: MaterialCategory
  // sRGB 0-255
  color: [number, number, number]
  opacity: number // 0-1，玻璃透明度（1=不透）
  roughness: number // 表面起伏 0-1
  reflectivity: number // 反光强度 0-1
  stock: number // 库存块数
}

// 排块参数
export interface LayoutParams {
  seed: number
  baseSize: number // 基准块边长，米
  sizeJitter: number // 尺寸随机度 0-0.5
  gap: number // 缝宽，米
  cutRandom: number // 切割随机度（切角幅度）0-1
  tiltRandom: number // 倾斜角随机度 0-1（度）
  followFlow: number // 跟随引导场强度 0-1
}

export interface ProjectMeta {
  id: string
  name: string
  client: string
  wall: WallSpec
  createdAt: number
  updatedAt: number
  // 原稿缩略与全图存 IndexedDB，这里只放尺寸
  sourceWidth: number
  sourceHeight: number
  sourceName: string
  currentVersionId: string | null
}

export interface Project extends ProjectMeta {}

export interface FlowField {
  cols: number
  rows: number
  // 每个网格点的走向角（弧度）与边缘强度
  angle: Float32Array
  strength: Float32Array
}

export interface GuideLine {
  points: [number, number][] // uv 坐标 0-1
  strength: number
}

export interface LayoutPaletteEntry {
  materialId: string
  color: [number, number, number] // 实际取色结果 sRGB
}

// 紧凑排块：每块 24 字节 = 6 个 float
// [cx, cy(uv), w, h(米), tilt(弧度), flags]
// flags 整数位编码：palette index（低20位）| gold 位等由 palette 决定
export const TILE_STRIDE = 6

export interface LayoutTiles {
  count: number
  data: Float32Array
  palette: LayoutPaletteEntry[]
  params: LayoutParams
  wallId: string
}

export interface LayoutVersion {
  id: string
  projectId: string
  label: string
  createdAt: number
  params: LayoutParams
  tiles: LayoutTiles
  note?: string
}

export interface MatchWarning {
  type: 'stock' | 'palette' | 'gap'
  materialId?: string
  message: string
}

export type LightMode = 'daylight' | 'spot' | 'candle'

export interface LightConfig {
  mode: LightMode
  intensity: number
}
