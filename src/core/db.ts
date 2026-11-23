// IndexedDB 封装：项目 / 材料 / 版本(含排块二进制) / 原稿图片
// 注意：Vue 响应式代理无法被结构化克隆，写入前必须先转纯对象
import type { LayoutVersion, Material, ProjectMeta } from './types'
import { cloneTiles } from './layout'

const DB_NAME = 'mosaic-studio'
const DB_VERSION = 1

const STORE = {
  projects: 'projects',
  materials: 'materials',
  versions: 'versions',
  sources: 'sources', // { id, blob, width, height }
} as const

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE.projects)) {
        db.createObjectStore(STORE.projects, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE.materials)) {
        db.createObjectStore(STORE.materials, { keyPath: 'id' })
      }
      const versions = db.objectStoreNames.contains(STORE.versions)
        ? req.transaction!.objectStore(STORE.versions)
        : db.createObjectStore(STORE.versions, { keyPath: 'id' })
      if (!versions.indexNames.contains('byProject')) {
        versions.createIndex('byProject', 'projectId')
      }
      if (!db.objectStoreNames.contains(STORE.sources)) {
        db.createObjectStore(STORE.sources, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode)
        const req = fn(t.objectStore(storeName))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function idbPut<T>(storeName: string, value: T): Promise<void> {
  await tx(storeName, 'readwrite', (s) => s.put(value))
}

export async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return tx(storeName, 'readonly', (s) => s.get(key) as IDBRequest<T>)
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  return tx(storeName, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
}

export async function idbDelete(storeName: string, key: string): Promise<void> {
  await tx(storeName, 'readwrite', (s) => s.delete(key))
}

export async function idbQueryIndex<T>(
  storeName: string,
  indexName: string,
  value: string,
): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const t = db.transaction(storeName, 'readonly')
        const req = t.objectStore(storeName).index(indexName).getAll(value)
        req.onsuccess = () => resolve(req.result as T[])
        req.onerror = () => reject(req.error)
      }),
  )
}

// 领域仓储
export const projectRepo = {
  list: () => idbGetAll<ProjectMeta>(STORE.projects),
  get: (id: string) => idbGet<ProjectMeta>(STORE.projects, id),
  save: async (p: ProjectMeta) => {
    // 解 reactive 代理，IDB 结构化克隆不接受 Proxy
    const plain: ProjectMeta = {
      ...p,
      wall: { ...p.wall },
    }
    await idbPut(STORE.projects, plain)
  },
  remove: async (id: string) => {
    const versions = await idbQueryIndex<LayoutVersion>(STORE.versions, 'byProject', id)
    for (const v of versions) await idbDelete(STORE.versions, v.id)
    await idbDelete(STORE.sources, id)
    await idbDelete(STORE.projects, id)
  },
}

export const materialRepo = {
  list: () => idbGetAll<Material>(STORE.materials),
  save: async (m: Material) => {
    const plain: Material = { ...m, color: [m.color[0], m.color[1], m.color[2]] }
    await idbPut(STORE.materials, plain)
  },
  remove: (id: string) => idbDelete(STORE.materials, id),
}

export const versionRepo = {
  listByProject: (projectId: string) =>
    idbQueryIndex<LayoutVersion>(STORE.versions, 'byProject', projectId),
  get: (id: string) => idbGet<LayoutVersion>(STORE.versions, id),
  save: async (v: LayoutVersion) => {
    // 全量解代理：params 是 reactive，tiles 内含 Float32Array
    const plain: LayoutVersion = {
      id: v.id,
      projectId: v.projectId,
      label: v.label,
      createdAt: v.createdAt,
      note: v.note,
      params: { ...v.params },
      tiles: cloneTiles(v.tiles),
    }
    await idbPut(STORE.versions, plain)
  },
  remove: (id: string) => idbDelete(STORE.versions, id),
}

export const sourceRepo = {
  save: (id: string, blob: Blob, width: number, height: number) =>
    idbPut(STORE.sources, { id, blob, width, height }),
  get: (id: string) =>
    idbGet<{ id: string; blob: Blob; width: number; height: number }>(STORE.sources, id),
  remove: (id: string) => idbDelete(STORE.sources, id),
}

export const STORES = STORE
