// 首次启动播种：材料库 + 三张原稿 + 三个示例项目（含已排块版本）
import { dbClear, dbGet, dbPut } from './db'
import { seedMaterials } from './seed_materials'
import { seedImages } from './seed_images'
import { projectRepo, versionRepo, defaultParams } from './repos'
import { generateTiling, makeVersion } from '@/core/tiling'
import { loadImage, toPixels } from '@/core/image_util'
import { computeFlowField } from '@/core/flow'
import type { SourceImage, TilingParams, WallConfig } from '@/core/types'

const SEED_KEY = 'seeded_v1'

export interface SeedProgress {
  phase: string
  ratio: number
}

export async function ensureSeedData(onProgress?: (p: SeedProgress) => void): Promise<void> {
  const flag = await dbGet('settings', SEED_KEY)
  if (flag) return

  const materials = seedMaterials()
  for (const m of materials) await dbPut('materials', m)
  onProgress?.({ phase: '材料库就绪', ratio: 0.08 })

  const images = seedImages()
  for (const img of images) await dbPut('images', img)
  onProgress?.({ phase: '测试原稿就绪', ratio: 0.14 })

  const cases: Array<{
    name: string
    wall: WallConfig
    image: SourceImage
    params: TilingParams
    ratio: number
  }> = [
    {
      name: '酒店大堂主墙（人像·20㎡）',
      wall: { kind: 'plane', width: 10, height: 2, curvature: 0, azimuth: 135 },
      image: images[0],
      params: { ...defaultParams(), tileSize: 0.01, grout: 0.0015, seed: 71001 },
      ratio: 0.9,
    },
    {
      name: '礼拜堂弧形墙（几何图案）',
      wall: { kind: 'curved', width: 6, height: 3, curvature: 0.9, azimuth: 90 },
      image: images[1],
      params: { ...defaultParams(), tileSize: 0.025, grout: 0.003, seed: 71002 },
      ratio: 0.28,
    },
    {
      name: '半穹顶（穹顶画）',
      wall: { kind: 'dome', width: 5, height: 2.5, curvature: 2.5, azimuth: 0 },
      image: images[2],
      params: { ...defaultParams(), tileSize: 0.022, grout: 0.003, flowFollow: 0.85, seed: 71003 },
      ratio: 0.32,
    },
  ]

  let base = 0.14
  for (const c of cases) {
    const project = projectRepo.create(c.name, c.wall)
    project.sourceImageId = c.image.id
    await dbPut('projects', project)

    onProgress?.({ phase: `分析引导线：${c.name}`, ratio: base + c.ratio * 0.15 })
    const img = await loadImage(c.image.dataUrl)
    const pixels = toPixels(img, 512)
    const flow = computeFlowField(pixels)
    c.image.flowUrl = null // 引导线可视化在原稿页按需生成
    await dbPut('images', c.image)

    onProgress?.({ phase: `排块生成：${c.name}`, ratio: base + c.ratio * 0.5 })
    const out = generateTiling({
      params: c.params,
      wallWidth: c.wall.width,
      wallHeight: c.wall.height,
      pixels,
      flow,
      materials,
      onProgress: (r) => onProgress?.({ phase: `排块生成：${c.name}`, ratio: base + c.ratio * (0.5 + 0.5 * r) }),
    })
    const version = makeVersion(project.id, c.params, out, '初始自动排块')
    await versionRepo.saveBuffer(version.id, out.buffer)
    await dbPut('versions', version)
    project.currentVersionId = version.id
    project.updatedAt = Date.now()
    await dbPut('projects', project)
    base += c.ratio
  }

  await dbPut('settings', { key: SEED_KEY, value: true })
  onProgress?.({ phase: '完成', ratio: 1 })
}

export async function resetSeedFlag(): Promise<void> {
  for (const s of ['projects', 'versions', 'tileBuffers', 'images', 'materials', 'settings'] as const) {
    await dbClear(s)
  }
}
