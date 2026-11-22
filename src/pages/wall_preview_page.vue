<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/page_header.vue'
import Icon from '@/components/icon.vue'
import { materialRepo, projectRepo, versionRepo } from '@/data/repos'
import { MosaicRenderer, type RenderData } from '@/render/renderer'
import { createOrbitCamera, type OrbitCamera } from '@/render/orbit_camera'
import { LIGHT_PRESETS, type LightMode } from '@/render/light'
import type { Project, TileVersion } from '@/core/types'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id as string
const canvasRef = ref<HTMLCanvasElement | null>(null)

const project = shallowRef<Project | null>(null)
const version = shallowRef<TileVersion | null>(null)
const lightMode = ref<LightMode>('spot')
const showBlowout = ref(false)
const autoRotate = ref(false)
const fps = ref(0)
const tileCount = ref(0)
const errorMsg = ref('')

let renderer: MosaicRenderer | null = null
let camera: OrbitCamera | null = null
let raf = 0
let lastTs = 0
let frames = 0
let fpsTimer = 0
let pointerDown = false
let lastPointer = { x: 0, y: 0 }

async function init(): Promise<void> {
  project.value = (await projectRepo.get(projectId)) ?? null
  if (!project.value || !canvasRef.value) return
  const materials = await materialRepo.list()
  if (project.value.currentVersionId) {
    version.value = (await versionRepo.get(project.value.currentVersionId)) ?? null
  }
  try {
    renderer = new MosaicRenderer(canvasRef.value, project.value.wall)
    const dist = Math.max(project.value.wall.width, project.value.wall.height) * 1.6
    camera = createOrbitCamera(dist)
    renderer.showBlowout = showBlowout.value
    if (version.value) {
      const buffer = await versionRepo.loadBuffer(version.value.id)
      if (buffer) {
        const data: RenderData = {
          buffer,
          count: version.value.stats.count,
          materials,
          materialTable: version.value.materialTable,
        }
        renderer.setData(data)
        tileCount.value = version.value.stats.count
      }
    }
    bindControls()
    lastTs = performance.now()
    loop(lastTs)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  }
}

function loop(ts: number): void {
  const dt = Math.min(0.05, (ts - lastTs) / 1000)
  lastTs = ts
  if (camera && renderer) {
    if (autoRotate.value && !pointerDown) {
      camera.state.yaw += dt * 0.25
      camera.update()
    }
    renderer.render(camera, LIGHT_PRESETS[lightMode.value], dt)
  }
  frames++
  fpsTimer += dt
  if (fpsTimer >= 1) {
    fps.value = Math.round(frames / fpsTimer)
    frames = 0
    fpsTimer = 0
  }
  raf = requestAnimationFrame(loop)
}

function bindControls(): void {
  const canvas = canvasRef.value!
  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = true
    lastPointer = { x: e.clientX, y: e.clientY }
    canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!pointerDown || !camera) return
    camera.rotate(e.clientX - lastPointer.x, e.clientY - lastPointer.y)
    lastPointer = { x: e.clientX, y: e.clientY }
  })
  canvas.addEventListener('pointerup', () => (pointerDown = false))
  canvas.addEventListener('pointercancel', () => (pointerDown = false))
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    camera?.zoom(e.deltaY)
  }, { passive: false })
}

function toggleBlowout(): void {
  showBlowout.value = !showBlowout.value
  if (renderer) renderer.showBlowout = showBlowout.value
}

function resetView(): void {
  if (!camera || !project.value) return
  const dist = Math.max(project.value.wall.width, project.value.wall.height) * 1.6
  camera.state.yaw = 0
  camera.state.pitch = 0.12
  camera.state.distance = dist
  camera.update()
}

onMounted(init)
onUnmounted(() => {
  cancelAnimationFrame(raf)
  renderer?.dispose()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <PageHeader :title="project?.name ?? '墙面预览'" subtitle="真实光照渲染：块倾角反射、金箔闪烁随视角流动">
      <span class="text-sm muted mr-2">{{ tileCount.toLocaleString() }} 块 · {{ fps }} FPS</span>
      <button class="btn" @click="router.push(`/projects/${projectId}/tiles`)"><Icon name="grid" :size="15" /> 排块编辑</button>
      <button class="btn" @click="router.push(`/projects/${projectId}/drawing`)"><Icon name="print" :size="15" /> 施工图</button>
    </PageHeader>

    <div class="flex-1 min-h-0 flex">
      <aside class="w-64 shrink-0 border-r p-4 flex flex-col gap-4 overflow-auto" style="border-color: var(--c-border)">
        <section class="card p-4">
          <h3 class="font-semibold mb-3">光源环境</h3>
          <div class="flex flex-col gap-2">
            <button
              v-for="preset in Object.values(LIGHT_PRESETS)"
              :key="preset.mode"
              class="btn justify-start"
              :class="lightMode === preset.mode ? 'btn-primary' : ''"
              @click="lightMode = preset.mode"
            >
              <Icon :name="preset.mode === 'daylight' ? 'sun' : preset.mode === 'candle' ? 'candle' : 'spot'" :size="16" />
              {{ preset.label }}
            </button>
          </div>
        </section>
        <section class="card p-4 flex flex-col gap-2">
          <h3 class="font-semibold mb-1">检视工具</h3>
          <button class="btn justify-start" :class="showBlowout ? 'btn-primary' : ''" @click="toggleBlowout">
            <Icon name="alert" :size="16" /> 死白区域预警
          </button>
          <button class="btn justify-start" :class="autoRotate ? 'btn-primary' : ''" @click="autoRotate = !autoRotate">
            <Icon name="play" :size="16" /> 自动旋转（模拟人走过）
          </button>
          <button class="btn justify-start" @click="resetView"><Icon name="reset" :size="16" /> 重置视角</button>
          <p class="text-xs muted mt-1">红色覆盖区域为当前光源下亮度超过阈值的连片死白，需调整块倾角或更换低反光材料</p>
        </section>
      </aside>

      <div class="flex-1 min-w-0 relative" style="background: #12141a">
        <canvas ref="canvasRef" class="w-full h-full block touch-none" />
        <div v-if="!version" class="absolute inset-0 flex items-center justify-center">
          <div class="card p-6 text-center">
            <p class="mb-3">当前墙面还没有排块版本</p>
            <button class="btn btn-primary" @click="router.push(`/projects/${projectId}/tiles`)">去生成排块</button>
          </div>
        </div>
        <div v-if="errorMsg" class="absolute inset-0 flex items-center justify-center">
          <p style="color: #f87171">{{ errorMsg }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
