// 光源预设：白天自然光 / 射灯 / 蜡烛
export type LightMode = 'daylight' | 'spot' | 'candle'

export interface LightPreset {
  mode: LightMode
  label: string
  lightDir: [number, number, number] // 指向墙面的入射方向（归一化）
  lightColor: [number, number, number]
  ambient: number
  intensity: number
  // 死白判定阈值（亮度），超过则在预警通道标红
  blowoutThreshold: number
}

export const LIGHT_PRESETS: Record<LightMode, LightPreset> = {
  daylight: {
    mode: 'daylight',
    label: '白天自然光',
    lightDir: [-0.45, 0.55, 0.7],
    lightColor: [1.0, 0.97, 0.9],
    ambient: 0.55,
    intensity: 1.05,
    blowoutThreshold: 0.92,
  },
  spot: {
    mode: 'spot',
    label: '射灯',
    lightDir: [0.15, 0.35, 0.92],
    lightColor: [1.0, 0.94, 0.82],
    ambient: 0.18,
    intensity: 1.7,
    blowoutThreshold: 0.88,
  },
  candle: {
    mode: 'candle',
    label: '烛光',
    lightDir: [-0.1, -0.25, 0.96],
    lightColor: [1.0, 0.66, 0.32],
    ambient: 0.08,
    intensity: 1.25,
    blowoutThreshold: 0.95,
  },
}
