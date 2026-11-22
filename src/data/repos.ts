// 领域仓储：页面只通过这里读写，不直接碰 IndexedDB
import { dbDelete, dbGet, dbGetAll, dbPut, dbQueryIndex, type TileBufferRecord } from './db'
import type { Material, Project, SourceImage, TileVersion, TilingParams } from '@/core/types'
import { emptyStats } from '@/core/tiling'
import { uid } from '@/core/rng'

export const projectRepo = {
  list: () => dbGetAll('projects'),
  get: (id: string) => dbGet('projects', id),
  save: (p: Project) => dbPut('projects', p),
  remove: async (id: string) => {
    const versions = await dbQueryIndex('versions', 'projectId', id)
    for (const v of versions) await dbDelete('tileBuffers', v.id)
    for (const v of versions) await dbDelete('versions', v.id)
    await dbDelete('projects', id)
  },
  create: (name: string, wall: Project['wall']): Project => ({
    id: uid('prj'),
    name,
    wall,
    sourceImageId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentVersionId: null,
  }),
}

export const materialRepo = {
  list: () => dbGetAll('materials'),
  save: (m: Material) => dbPut('materials', m),
  remove: (id: string) => dbDelete('materials', id),
  create: (partial: Omit<Material, 'id'>): Material => ({ ...partial, id: uid('mat') }),
}

export const imageRepo = {
  list: () => dbGetAll('images'),
  get: (id: string) => dbGet('images', id),
  save: (img: SourceImage) => dbPut('images', img),
  remove: (id: string) => dbDelete('images', id),
}

export const versionRepo = {
  listByProject: (projectId: string) => dbQueryIndex('versions', 'projectId', projectId),
  get: (id: string) => dbGet('versions', id),
  save: (v: TileVersion) => dbPut('versions', v),
  remove: async (id: string) => {
    await dbDelete('tileBuffers', id)
    await dbDelete('versions', id)
  },
  loadBuffer: async (versionId: string): Promise<ArrayBuffer | null> => {
    const rec = await dbGet('tileBuffers', versionId)
    return (rec as TileBufferRecord | undefined)?.buffer ?? null
  },
  saveBuffer: (versionId: string, buffer: ArrayBuffer) =>
    dbPut('tileBuffers', { id: versionId, buffer } satisfies TileBufferRecord),
}

export const defaultParams = (): TilingParams => ({
  tileSize: 0.02,
  grout: 0.003,
  sizeJitter: 0.12,
  cutJitter: 0.1,
  angleJitter: 6,
  flowFollow: 0.7,
  seed: 20261123,
})

export const emptyVersion = (projectId: string): TileVersion => ({
  id: uid('ver'),
  projectId,
  label: '未排块',
  params: defaultParams(),
  materialTable: {},
  stats: emptyStats(),
  createdAt: Date.now(),
  note: '',
})
