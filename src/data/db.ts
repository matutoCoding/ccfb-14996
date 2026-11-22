// IndexedDB 轻封装：项目 / 材料 / 原稿 / 版本 / 块缓冲 / 设置
import type { Material, Project, SourceImage, TileVersion } from '@/core/types'

const DB_NAME = 'mosaic-studio'
const DB_VERSION = 2

export interface TileBufferRecord {
  id: string // 与版本 id 相同
  buffer: ArrayBuffer
}

interface SchemaMap {
  projects: Project
  materials: Material
  images: SourceImage
  versions: TileVersion
  tileBuffers: TileBufferRecord
  settings: { key: string; value: unknown }
}

export type StoreName = keyof SchemaMap

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('materials')) db.createObjectStore('materials', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('versions')) {
        const store = db.createObjectStore('versions', { keyPath: 'id' })
        store.createIndex('projectId', 'projectId')
      }
      if (!db.objectStoreNames.contains('tileBuffers')) db.createObjectStore('tileBuffers', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function dbPut<S extends StoreName>(store: S, value: SchemaMap[S]): Promise<void> {
  await tx(store, 'readwrite', (s) => s.put(value) as IDBRequest<IDBValidKey>)
}

export async function dbGet<S extends StoreName>(store: S, key: string): Promise<SchemaMap[S] | undefined> {
  return tx(store, 'readonly', (s) => s.get(key) as IDBRequest<SchemaMap[S] | undefined>)
}

export async function dbGetAll<S extends StoreName>(store: S): Promise<SchemaMap[S][]> {
  return tx(store, 'readonly', (s) => s.getAll() as IDBRequest<SchemaMap[S][]>)
}

export async function dbDelete(store: StoreName, key: string): Promise<void> {
  await tx(store, 'readwrite', (s) => s.delete(key) as IDBRequest<undefined>)
}

export async function dbQueryIndex<S extends StoreName>(
  store: S,
  index: string,
  value: string,
): Promise<SchemaMap[S][]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readonly')
    const req = t.objectStore(store).index(index).getAll(value)
    req.onsuccess = () => resolve(req.result as SchemaMap[S][])
    req.onerror = () => reject(req.error)
  })
}

export async function dbClear(store: StoreName): Promise<void> {
  await tx(store, 'readwrite', (s) => s.clear() as IDBRequest<undefined>)
}
