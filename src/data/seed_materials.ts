// 预置材料库：意大利手工熔制玻璃、金箔、天然石材
import type { Material } from '@/core/types'

export function seedMaterials(): Material[] {
  const defs: Array<Omit<Material, 'id'>> = [
    // 手工熔制玻璃 G 系列（高反光、半透明、起伏明显）
    { code: 'G-101', name: '雪花白玻璃', kind: 'glass', rgb: [238, 235, 226], opacity: 0.92, roughness: 0.32, reflectivity: 0.55, stock: 42000 },
    { code: 'G-102', name: '雾蓝玻璃', kind: 'glass', rgb: [122, 156, 188], opacity: 0.88, roughness: 0.38, reflectivity: 0.6, stock: 18000 },
    { code: 'G-103', name: '深海蓝玻璃', kind: 'glass', rgb: [36, 68, 112], opacity: 0.94, roughness: 0.3, reflectivity: 0.62, stock: 16000 },
    { code: 'G-104', name: '孔雀绿玻璃', kind: 'glass', rgb: [28, 112, 102], opacity: 0.9, roughness: 0.34, reflectivity: 0.58, stock: 14000 },
    { code: 'G-105', name: '橄榄绿玻璃', kind: 'glass', rgb: [96, 118, 62], opacity: 0.9, roughness: 0.4, reflectivity: 0.5, stock: 12000 },
    { code: 'G-106', name: '琥珀玻璃', kind: 'glass', rgb: [196, 132, 48], opacity: 0.86, roughness: 0.33, reflectivity: 0.6, stock: 13000 },
    { code: 'G-107', name: '赤陶玻璃', kind: 'glass', rgb: [168, 78, 56], opacity: 0.92, roughness: 0.36, reflectivity: 0.55, stock: 11000 },
    { code: 'G-108', name: '酒红玻璃', kind: 'glass', rgb: [118, 38, 52], opacity: 0.93, roughness: 0.32, reflectivity: 0.58, stock: 10000 },
    { code: 'G-109', name: '紫罗兰玻璃', kind: 'glass', rgb: [104, 78, 138], opacity: 0.9, roughness: 0.35, reflectivity: 0.56, stock: 9000 },
    { code: 'G-110', name: '天青玻璃', kind: 'glass', rgb: [148, 196, 214], opacity: 0.85, roughness: 0.3, reflectivity: 0.62, stock: 15000 },
    { code: 'G-111', name: '暖灰玻璃', kind: 'glass', rgb: [152, 146, 138], opacity: 0.92, roughness: 0.4, reflectivity: 0.5, stock: 20000 },
    { code: 'G-112', name: '炭黑玻璃', kind: 'glass', rgb: [38, 40, 46], opacity: 0.96, roughness: 0.28, reflectivity: 0.64, stock: 12000 },
    { code: 'G-113', name: '胭脂粉玻璃', kind: 'glass', rgb: [214, 158, 158], opacity: 0.88, roughness: 0.36, reflectivity: 0.55, stock: 8000 },
    { code: 'G-114', name: '鹅黄玻璃', kind: 'glass', rgb: [228, 206, 128], opacity: 0.86, roughness: 0.34, reflectivity: 0.58, stock: 9000 },
    { code: 'G-115', name: '松石蓝玻璃', kind: 'glass', rgb: [64, 158, 168], opacity: 0.89, roughness: 0.32, reflectivity: 0.6, stock: 10000 },
    // 金箔块 Au 系列（镜面强反光、闪烁）
    { code: 'Au-201', name: '24K 金箔', kind: 'gold', rgb: [214, 178, 82], opacity: 1, roughness: 0.08, reflectivity: 0.95, stock: 6000 },
    { code: 'Au-202', name: '香槟金箔', kind: 'gold', rgb: [222, 196, 142], opacity: 1, roughness: 0.1, reflectivity: 0.92, stock: 4000 },
    { code: 'Au-203', name: '玫瑰金箔', kind: 'gold', rgb: [206, 148, 120], opacity: 1, roughness: 0.1, reflectivity: 0.9, stock: 3000 },
    // 天然石材 S 系列（低反光、粗糙哑光）
    { code: 'S-301', name: '卡拉拉白大理石', kind: 'stone', rgb: [226, 224, 218], opacity: 1, roughness: 0.72, reflectivity: 0.18, stock: 22000 },
    { code: 'S-302', name: '米黄洞石', kind: 'stone', rgb: [206, 188, 152], opacity: 1, roughness: 0.78, reflectivity: 0.15, stock: 18000 },
    { code: 'S-303', name: '浅灰砂岩', kind: 'stone', rgb: [168, 164, 156], opacity: 1, roughness: 0.8, reflectivity: 0.14, stock: 17000 },
    { code: 'S-304', name: '深灰板岩', kind: 'stone', rgb: [86, 90, 96], opacity: 1, roughness: 0.7, reflectivity: 0.2, stock: 14000 },
    { code: 'S-305', name: '黑金沙花岗岩', kind: 'stone', rgb: [52, 50, 52], opacity: 1, roughness: 0.66, reflectivity: 0.24, stock: 10000 },
    { code: 'S-306', name: '珊瑚红石材', kind: 'stone', rgb: [176, 96, 78], opacity: 1, roughness: 0.74, reflectivity: 0.16, stock: 8000 },
  ]
  return defs.map((d, i) => ({ ...d, id: `seed_mat_${String(i + 1).padStart(2, '0')}` }))
}
