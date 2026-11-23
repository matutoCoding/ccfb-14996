// 确定性随机数：全项目禁止 Math.random 参与业务逻辑
// mulberry32，同种子同序列，保证排块可复现

export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // [min, max)
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  // 正态近似（三次平均法），均值 0 标准差约 0.5
  normal(): number {
    return (this.next() + this.next() + this.next()) / 1.5 - 1
  }
}

export function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// 对排块二进制做 FNV-1a 哈希，用于可复现性自检
export function hashFloat32(data: Float32Array): number {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  let h = 2166136261
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
