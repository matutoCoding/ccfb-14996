// 确定性随机：FNV-1a 哈希 + mulberry32，保证同参数同种子逐块可复现

export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function hashParams(parts: (number | string)[]): number {
  return hashString(parts.join('|'))
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 以格子坐标派生独立随机数，保证遍历顺序变化不影响结果
export function cellRng(seed: number, col: number, row: number, salt: number): () => number {
  let h = seed >>> 0
  h = Math.imul(h ^ (col + 0x9e3779b9), 0x85ebca6b)
  h = Math.imul(h ^ (row + 0xc2b2ae35), 0xc2b2ae35)
  h = Math.imul(h ^ (salt + 0x27d4eb2f), 0x165667b1)
  return mulberry32(h >>> 0)
}

export function uid(prefix: string): string {
  const a = Math.floor(Math.random() * 0xffffffff).toString(36)
  const b = Date.now().toString(36)
  return `${prefix}_${b}${a}`
}
