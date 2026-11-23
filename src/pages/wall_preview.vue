<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/app_icon.vue'
import { MosaicRenderer } from '@/core/renderer'
import { refreshMaterials, selectProject, session } from '@/store/session'
import { wallArea } from '@/core/geometry'
import type { LightMode } from '@/core/types'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id as string
const canvasRef = ref<HTMLCanvasElement | null>(null)
const fps = ref(0)
const error = ref('')

let renderer: MosaicRenderer | null = null
let dragging = false
let lastX = 0
let lastY = 0
let fpsFrames = 0
let fpsLast = 0
let raf = 0

const lights: { mode: LightMode; label: string }[] = [
  { mode: 'daylight', label: '白天自然光' },
  { mode: 'spot', label: '射灯' },
  { mode: 'candle', label: '蜡烛' },
]
const activeLight = ref<LightMode>('daylight')
const showBurn = ref(false)
const intensity = ref(1)

function measureFps() {
  fpsFrames++
  const now = performance.now()
  if (now - fpsLast >= 1000) {
    fps.value = fpsFrames
    fpsFrames = 0
    fpsLast = now
  }
  raf = requestAnimationFrame(measureFps)
}

function bindControls(canvas: HTMLCanvasElement) {
  canvas.addEventListener('mousedown', (e) => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
  })
  window.addEventListener('mouseup', () => (dragging = false))
  window.addEventListener('mousemove', (e) => {
    if (!dragging || !renderer) return
    const cam = renderer.getCamera()
    renderer.setCamera({
      yaw: cam.yaw + (e.clientX - lastX) * 0.006,
      pitch: Math.max(-0.9, Math.min(1.1, cam.pitch - (e.clientY - lastY) * 0.006)),
    })
    lastX = e.clientX
    lastY = e.clientY
  })
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!renderer) return
      e.preventDefault()
      const cam = renderer.getCamera()
      renderer.setCamera({ distance: Math.max(1.5, Math.min(30, cam.distance + e.deltaY * 0.004)) })
    },
    { passive: false },
  )
}

function applyLight() {
  if (!renderer) return
  renderer.lightMode = activeLight.value
  renderer.showBurn = showBurn.value
  renderer.intensity = intensity.value
}

onMounted(async () => {
  await selectProject(projectId)
  await refreshMaterials()
  const project = session.currentProject
  const canvas = canvasRef.value
  if (!project || !canvas) return
  if (!session.currentTiles || session.currentTiles.count === 0) {
    error.value = '当前墙面还没有排块，请先到排块编辑器生成'
    return
  }
  try {
    renderer = new MosaicRenderer(canvas, project.wall)
    const span = Math.max(project.wall.width, project.wall.height)
    renderer.setCamera({ distance: Math.max(4, span * 1.1), yaw: 0, pitch: 0.06 })
    renderer.uploadTiles(session.currentTiles)
    renderer.uploadMaterials(session.currentTiles, session.materials)
    applyLight()
    renderer.start()
    bindControls(canvas)
    fpsLast = performance.now()
    measureFps()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  renderer?.dispose()
  renderer = null
})

const tileCount = () => session.currentTiles?.count ?? 0
const area = () => (session.currentProject ? wallArea(session.currentProject.wall) : 0)
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <button class="btn" @click="router.push(`/projects/${projectId}/layout`)">
          <AppIcon name="back" :size="16" />排块
        </button>
        <div>
          <h1 class="title">墙面预览</h1>
          <p class="subtitle">实例化单 draw call 渲染 · 金箔闪光随视角移动 · 拖拽旋转，滚轮缩放</p>
        </div>
      </div>
      <button class="btn" @click="router.push(`/projects/${projectId}/construction`)">
        施工图<AppIcon name="doc" :size="16" />
      </button>
    </header>

    <div class="stage-wrap">
      <canvas ref="canvasRef" class="stage"></canvas>
      <div v-if="error" class="card empty-state error-box">
        <div class="icon-card"><AppIcon name="warn" :size="32" /></div>
        <div style="color: var(--text)">{{ error }}</div>
        <button class="btn btn-primary" @click="router.push(`/projects/${projectId}/layout`)">去生成排块</button>
      </div>

      <div class="hud">
        <div class="hud-item"><span>块数</span><strong>{{ tileCount().toLocaleString() }}</strong></div>
        <div class="hud-item"><span>面积</span><strong>{{ area().toFixed(1) }} ㎡</strong></div>
        <div class="hud-item"><span>帧率</span><strong :class="{ bad: fps > 0 && fps < 30 }">{{ fps }} FPS</strong></div>
      </div>

      <div class="card control-panel">
        <h2 class="panel-title">光照场景</h2>
        <div class="light-group">
          <button
            v-for="l in lights"
            :key="l.mode"
            class="btn"
            :class="{ active: activeLight === l.mode }"
            @click="activeLight = l.mode; applyLight()"
          >
            {{ l.label }}
          </button>
        </div>
        <label class="label">光强（{{ intensity.toFixed(2) }}）</label>
        <input v-model.number="intensity" type="range" min="0.4" max="2" step="0.05" @input="applyLight" />
        <label class="check-row">
          <input v-model="showBurn" type="checkbox" @change="applyLight" />
          <span>死白区域报警（过曝低饱和标红）</span>
        </label>
        <div class="legend">
          <div><i class="dot gold"></i>金箔块：高光随视角扫动</div>
          <div><i class="dot red"></i>红色覆盖：灯下死白风险</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: var(--sp-6);
  max-width: 1400px;
  margin: 0 auto;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--sp-5);
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.head-left {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}
.title {
  font-size: var(--fs-2xl);
}
.subtitle {
  color: var(--text-muted);
  font-size: var(--fs-sm);
  margin: var(--sp-1) 0 0;
}
.stage-wrap {
  position: relative;
  height: calc(100vh - 180px);
  min-height: 520px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border);
  background: #0d121b;
}
.stage {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
}
.stage:active {
  cursor: grabbing;
}
.error-box {
  position: absolute;
  inset: var(--sp-6);
}
.hud {
  position: absolute;
  top: var(--sp-4);
  left: var(--sp-4);
  display: flex;
  gap: var(--sp-2);
}
.hud-item {
  background: rgba(15, 20, 28, 0.82);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp-2) var(--sp-3);
  font-size: var(--fs-xs);
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  min-width: 76px;
}
.hud-item strong {
  color: var(--text);
  font-size: var(--fs-sm);
}
.hud-item strong.bad {
  color: var(--danger);
}
.control-panel {
  position: absolute;
  top: var(--sp-4);
  right: var(--sp-4);
  width: 264px;
  padding: var(--sp-5);
  background: rgba(22, 29, 40, 0.92);
  backdrop-filter: blur(8px);
}
.panel-title {
  font-size: var(--fs-base);
  margin-bottom: var(--sp-4);
}
.light-group {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-bottom: var(--sp-4);
}
.btn.active {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-weak);
}
.check-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-xs);
  margin-top: var(--sp-4);
  cursor: pointer;
}
.legend {
  margin-top: var(--sp-4);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  font-size: 12px;
  color: var(--text-muted);
}
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: var(--sp-2);
}
.dot.gold {
  background: var(--primary);
}
.dot.red {
  background: var(--danger);
}
</style>
