<script setup lang="ts">
// 打印用单张分格组件：挂载时把对应 1㎡ 分格画到自带 canvas
import { onMounted, ref } from 'vue'
import { drawSheet } from '@/render/drawing'
import type { Material, TileVersion, WallConfig } from '@/core/types'

const props = defineProps<{
  buffer: ArrayBuffer
  count: number
  version: TileVersion
  materials: Material[]
  wall: WallConfig
  cell: { col: number; row: number }
  projectName: string
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = 600
  canvas.height = 600
  const ctx = canvas.getContext('2d')!
  drawSheet(ctx, props.buffer, props.count, props.version, props.materials, props.wall, props.cell, 600, true)
})
</script>

<template>
  <div class="print-sheet">
    <h2>{{ projectName }} — 分格 X{{ cell.col + 1 }}/Y{{ cell.row + 1 }}</h2>
    <canvas ref="canvasRef" class="print-canvas" />
  </div>
</template>

<style scoped>
.print-sheet {
  page-break-after: always;
  padding: 24px;
  background: #fff;
  color: #1e293b;
}
.print-canvas {
  width: 600px;
  height: 600px;
  border: 1px solid #334155;
}
h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}
</style>
