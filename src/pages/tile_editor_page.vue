<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/page_header.vue'
import Icon from '@/components/icon.vue'
import { materialRepo, projectRepo, versionRepo, defaultParams, imageRepo } from '@/data/repos'
import { generateTiling, makeVersion } from '@/core/tiling'
import { loadImage, toPixels } from '@/core/image_util'
import { computeFlowField } from '@/core/flow'
import { readTile } from '@/core/types'
import type { Material, Project, TileVersion, TilingParams } from '@/core/types'
import {
  drawTiles,
  fitViewport,
  pickTile,
  toWorld,
  updateTile,
  type CanvasViewport,
} from '@/render/tile_canvas_util'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id as string

const project = shallowRef<Project | null>(null)
const version = shallowRef<TileVersion | null>(null)
const materials = ref<Material[]>([])
const params = ref<TilingParams>(defaultParams())
const buffer = shallowRef<ArrayBuffer | null>(null)
const count = ref(0)
const selected = ref(-1)
const selectedAngleDeg = ref(0)
const generating = ref(false)
const progressText = ref('')
const dirty = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let vp: CanvasViewport = { scale: 20, offsetX: 0, offsetY: 0 }
let fitted = false
let dragMode: 'none' | 'pan' | 'tile' = 'none'
let lastPointer = { x: 0, y: 0 }

const materialById = computed(() => new Map(materials.value.map((m) => [m.id, m])))
const selectedMaterial = computed(() => {
  if (selected.value < 0 || !version.value || !buffer.value) return null
  const t = readTile(new DataView(buffer.value), selected.value)
  const id = version.value.materialTable[String(t.materialIndex)]
  return materialById.value.get(id) ?? null
})

async function loadCurrent(): Promise<void> {
  project.value = (await projectRepo.get(projectId)) ?? null
  materials.value = await materialRepo.list()
  if (!project.value) return
  if (project.value.currentVersionId) {
    version.value = (await versionRepo.get(project.value.currentVersionId)) ?? null
    if (version.value) {
      params.value = { ...version.value.params }
      buffer.value = await versionRepo.loadBuffer(version.value.id)
      count.value = version.value.stats.count
    }
  }
  await nextFrameRender()
}

function nextFrameRender(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => {
    render()
    resolve()
  }))
}

function render(): void {
  const canvas = canvasRef.value
  if (!canvas || !buffer.value || !version.value) return
  const ctx = canvas.getContext('2d')!
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const rect = canvas.getBoundingClientRect()
  if (canvas.width !== rect.width * dpr) {
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  if (!project.value) return
  const rect0 = canvas.getBoundingClientRect()
  if (!fitted && rect0.width > 0) {
    vp = fitViewport(rect0.width, rect0.height, project.value.wall.width, project.value.wall.height)
    fitted = true
  }
  drawTiles(
    ctx,
    buffer.value,
    count.value,
    version.value.materialTable,
    materials.value,
    project.value.wall.width,
    project.value.wall.height,
    vp,
    selected.value,
  )
}

async function regenerate(): Promise<void> {
  if (!project.value) return
  generating.value = true
  try {
    let pixels = null
    let flow = null
    if (project.value.sourceImageId) {
      const source = await imageRepo.get(project.value.sourceImageId)
      if (source) {
        const img = await loadImage(source.dataUrl)
        pixels = toPixels(img, 512)
        flow = computeFlowField(pixels)
      }
    }
    await new Promise((r) => setTimeout(r, 30))
    const out = generateTiling({
      params: params.value,
      wallWidth: project.value.wall.width,
      wallHeight: project.value.wall.height,
      pixels,
      flow,
      materials: materials.value,
      onProgress: (r) => {
        progressText.value = `排块中 ${Math.round(r * 100)}%`
      },
    })
    const ver = makeVersion(project.value.id, params.value, out, dirty.value ? '手动调整后重排' : '参数重排')
    buffer.value = out.buffer
    count.value = out.count
    version.value = ver
    selected.value = -1
    dirty.value = false
    progressText.value = '保存版本…'
    await versionRepo.saveBuffer(ver.id, out.buffer)
    await versionRepo.save(ver)
    project.value.currentVersionId = ver.id
    project.value.updatedAt = Date.now()
    await projectRepo.save(project.value)
    render()
  } finally {
    generating.value = false
    progressText.value = ''
  }
}

async function saveEdits(): Promise<void> {
  if (!version.value || !buffer.value || !project.value) return
  await versionRepo.saveBuffer(version.value.id, buffer.value)
  project.value.updatedAt = Date.now()
  await projectRepo.save(project.value)
  dirty.value = false
}

function onPointerDown(e: PointerEvent): void {
  if (!buffer.value || !project.value) return
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
  lastPointer = { x: e.clientX, y: e.clientY }
  if (e.button === 1 || e.shiftKey) {
    dragMode = 'pan'
    return
  }
  const world = toWorld(vp, e.clientX - rect.left, e.clientY - rect.top)
  const step = params.value.tileSize + params.value.grout
  const idx = pickTile(buffer.value, count.value, world.x, world.y, step, project.value.wall.width)
  selected.value = idx
  if (idx >= 0) {
    const t = readTile(new DataView(buffer.value), idx)
    selectedAngleDeg.value = (t.angle * 180) / Math.PI
    dragMode = 'tile'
  }
  render()
}

function onPointerMove(e: PointerEvent): void {
  const dx = e.clientX - lastPointer.x
  const dy = e.clientY - lastPointer.y
  lastPointer = { x: e.clientX, y: e.clientY }
  if (dragMode === 'pan') {
    vp.offsetX += dx
    vp.offsetY += dy
    render()
  } else if (dragMode === 'tile' && selected.value >= 0 && buffer.value) {
    updateTile(buffer.value, selected.value, {
      x: readTile(new DataView(buffer.value), selected.value).x + dx / vp.scale,
      y: readTile(new DataView(buffer.value), selected.value).y + dy / vp.scale,
    })
    dirty.value = true
    render()
  }
}

function onPointerUp(): void {
  dragMode = 'none'
}

function onWheel(e: WheelEvent): void {
  e.preventDefault()
  const factor = e.deltaY > 0 ? 0.9 : 1.1
  vp.scale = Math.max(2, Math.min(400, vp.scale * factor))
  render()
}

function changeAngle(deg: number): void {
  if (selected.value < 0 || !buffer.value) return
  selectedAngleDeg.value = deg
  updateTile(buffer.value, selected.value, { angle: (deg * Math.PI) / 180 })
  dirty.value = true
  render()
}

function changeMaterial(matId: string): void {
  if (selected.value < 0 || !buffer.value || !version.value) return
  let localIdx = Object.entries(version.value.materialTable).find(([, id]) => id === matId)?.[0]
  if (localIdx === undefined) {
    localIdx = String(Object.keys(version.value.materialTable).length)
    version.value.materialTable[localIdx] = matId
  }
  updateTile(buffer.value, selected.value, { materialIndex: Number(localIdx) })
  dirty.value = true
  render()
}

const paramFields: { key: keyof TilingParams; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'tileSize', label: '块大小', min: 0.005, max: 0.08, step: 0.001, unit: 'm' },
  { key: 'grout', label: '缝宽', min: 0.001, max: 0.012, step: 0.0005, unit: 'm' },
  { key: 'sizeJitter', label: '尺寸随机度', min: 0, max: 0.5, step: 0.01, unit: '' },
  { key: 'cutJitter', label: '切割随机度', min: 0, max: 0.5, step: 0.01, unit: '' },
  { key: 'angleJitter', label: '倾斜随机度', min: 0, max: 25, step: 0.5, unit: '°' },
  { key: 'flowFollow', label: '顺走向强度', min: 0, max: 1, step: 0.05, unit: '' },
]

function onResize(): void {
  render()
}

onMounted(async () => {
  await loadCurrent()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => window.removeEventListener('resize', onResize))
</script>

<template>
  <div class="h-full flex flex-col">
    <PageHeader :title="project?.name ?? '排块编辑'" :subtitle="version ? `${version.label} · 共 ${count.toLocaleString()} 块` : '尚未排块'">
      <button class="btn" @click="router.push(`/projects/${projectId}/source`)"><Icon name="image" :size="15" /> 原稿</button>
      <button class="btn" @click="router.push(`/projects/${projectId}/preview`)"><Icon name="wall" :size="15" /> 墙面预览</button>
      <button class="btn" :disabled="!dirty" @click="saveEdits"><Icon name="check" :size="15" /> 保存手改</button>
      <button class="btn btn-primary" :disabled="generating" @click="regenerate">
        <Icon name="play" :size="15" /> {{ version ? '按参数重新排块' : '生成排块' }}
      </button>
    </PageHeader>

    <div class="flex-1 min-h-0 flex">
      <aside class="w-72 shrink-0 border-r overflow-auto p-4 flex flex-col gap-4" style="border-color: var(--c-border)">
        <section class="card p-4">
          <h3 class="font-semibold mb-3">排块参数</h3>
          <div class="flex flex-col gap-3">
            <div v-for="f in paramFields" :key="f.key">
              <label class="label flex justify-between">
                <span>{{ f.label }}</span>
                <span class="font-medium" style="color: var(--c-text)">{{ params[f.key] }}{{ f.unit }}</span>
              </label>
              <input v-model.number="params[f.key]" type="range" :min="f.min" :max="f.max" :step="f.step" class="w-full" />
            </div>
            <div>
              <label class="label">随机种子（同参数同种子结果一致）</label>
              <input v-model.number="params.seed" type="number" class="input" />
            </div>
          </div>
          <p v-if="generating" class="text-sm mt-3" style="color: var(--color-primary)">{{ progressText || '排块中…' }}</p>
        </section>

        <section v-if="selected >= 0" class="card p-4">
          <h3 class="font-semibold mb-3">单块编辑 #{{ selected }}</h3>
          <label class="label">倾斜角 {{ selectedAngleDeg.toFixed(1) }}°</label>
          <input :value="selectedAngleDeg" type="range" min="-45" max="45" step="0.5" class="w-full mb-3"
            @input="changeAngle(Number(($event.target as HTMLInputElement).value))" />
          <label class="label">材料 / 颜色</label>
          <select class="input" :value="selectedMaterial?.id ?? ''" @change="changeMaterial(($event.target as HTMLSelectElement).value)">
            <option v-for="m in materials" :key="m.id" :value="m.id">
              {{ m.code }} · {{ m.name }}
            </option>
          </select>
          <p class="text-xs muted mt-2">拖动块可移动位置；Shift+拖动平移画布，滚轮缩放</p>
        </section>

        <section v-if="version && version.stats.warnings.length" class="card p-4" style="border-color: rgb(217 119 6 / 0.4)">
          <h3 class="font-semibold mb-2 flex items-center gap-2"><Icon name="alert" :size="16" style="color: var(--color-warn)" /> 匹配告警</h3>
          <ul class="text-sm flex flex-col gap-1.5">
            <li v-for="(w, i) in version.stats.warnings" :key="i" class="flex gap-2">
              <span style="color: var(--color-warn)">•</span><span>{{ w }}</span>
            </li>
          </ul>
          <ul v-if="version.stats.stockShortages.length" class="text-sm mt-2 flex flex-col gap-1">
            <li v-for="s in version.stats.stockShortages" :key="s.materialId" class="muted">
              缺料 {{ materialById.get(s.materialId)?.code }}：需 {{ s.need }} / 库存 {{ s.stock }}
            </li>
          </ul>
        </section>
      </aside>

      <div class="flex-1 min-w-0 relative" style="background: var(--c-surface-2)">
        <canvas
          ref="canvasRef"
          class="w-full h-full block cursor-crosshair touch-none"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointerleave="onPointerUp"
          @wheel="onWheel"
        />
        <div v-if="!version" class="absolute inset-0 flex items-center justify-center">
          <div class="card p-6 text-center">
            <p class="mb-3">设置左侧参数后生成排块；同参数 + 同种子随时可复现</p>
            <button class="btn btn-primary" :disabled="generating" @click="regenerate"><Icon name="play" :size="15" /> 生成排块</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
