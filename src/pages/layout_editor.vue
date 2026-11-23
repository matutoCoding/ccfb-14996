<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/app_icon.vue'
import { projectRepo, sourceRepo, versionRepo } from '@/core/db'
import { refreshMaterials, selectProject, session } from '@/store/session'
import { cloneTiles, DEFAULT_PARAMS, estimateTileCount, generateLayout, readTile, writeTile } from '@/core/layout'
import { buildFlowField, loadSourceImage } from '@/core/image'
import { hashFloat32 } from '@/core/rng'
import { wallArea } from '@/core/geometry'
import type { LayoutParams, LayoutVersion, MatchWarning } from '@/core/types'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id as string
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

const params = reactive<LayoutParams>({ ...DEFAULT_PARAMS })
const warnings = ref<MatchWarning[]>([])
const selected = ref(-1)
const generating = ref(false)
const hashValue = ref(0)
const versionLabel = ref('')
const perfMs = ref(0)

let raf = 0
let drag: { index: number; startX: number; startY: number; cu: number; cv: number } | null = null
// 离屏缓存：上万块只在数据变化时全量绘制一次，拖拽帧只做 blit
const offscreen = document.createElement('canvas')
const OFF_SIZE = 1200
let offDirty = true

async function init() {
  await selectProject(projectId)
  await refreshMaterials()
  if (session.currentTiles) Object.assign(params, session.currentTiles.params)
  requestDraw()
}

async function runGenerate() {
  if (!session.currentProject) return
  generating.value = true
  const t0 = performance.now()
  try {
    const rec = await sourceRepo.get(projectId)
    let field = null
    let source = null
    if (rec) {
      source = await loadSourceImage(rec.blob, 512)
      field = buildFlowField(source, 48, 48)
    }
    const result = generateLayout(session.currentProject.wall, { ...params }, field, source, session.materials)
    session.currentTiles = result.tiles
    session.currentWarnings = result.warnings
    warnings.value = result.warnings
    hashValue.value = hashFloat32(result.tiles.data)
    perfMs.value = Math.round(performance.now() - t0)
    selected.value = -1
    offDirty = true
    requestDraw()
  } finally {
    generating.value = false
  }
}

async function saveVersion() {
  if (!session.currentProject || !session.currentTiles) return
  const id = `ver-${Date.now().toString(36)}`
  const version: LayoutVersion = {
    id,
    projectId,
    label: versionLabel.value || `版本 ${session.versions.length + 1}`,
    createdAt: Date.now(),
    params: { ...params },
    tiles: cloneTiles(session.currentTiles),
  }
  await versionRepo.save(version)
  session.currentProject.currentVersionId = id
  session.currentProject.updatedAt = Date.now()
  await projectRepo.save(session.currentProject)
  session.versions = await versionRepo.listByProject(projectId)
  session.versions.sort((a, b) => b.createdAt - a.createdAt)
  versionLabel.value = ''
}

async function restoreVersion(version: LayoutVersion) {
  if (!session.currentProject) return
  session.currentTiles = cloneTiles(version.tiles)
  Object.assign(params, version.params)
  session.currentProject.currentVersionId = version.id
  await projectRepo.save(session.currentProject)
  hashValue.value = hashFloat32(session.currentTiles.data)
  selected.value = -1
  offDirty = true
  requestDraw()
}

async function removeVersion(version: LayoutVersion, event: Event) {
  event.stopPropagation()
  if (!window.confirm(`删除版本「${version.label}」？`)) return
  await versionRepo.remove(version.id)
  session.versions = await versionRepo.listByProject(projectId)
}

// 复现性自检：用当前参数独立重跑两次，比对逐字节哈希
const reproResult = ref('')
async function checkReproducibility() {
  if (!session.currentProject) return
  reproResult.value = '自检中…'
  const rec = await sourceRepo.get(projectId)
  let field = null
  let source = null
  if (rec) {
    source = await loadSourceImage(rec.blob, 512)
    field = buildFlowField(source, 48, 48)
  }
  const a = generateLayout(session.currentProject.wall, { ...params }, field, source, session.materials)
  const b = generateLayout(session.currentProject.wall, { ...params }, field, source, session.materials)
  const ha = hashFloat32(a.tiles.data)
  const hb = hashFloat32(b.tiles.data)
  reproResult.value =
    ha === hb
      ? `通过：两次生成哈希一致（${ha.toString(16)}），同参数可逐字节复现`
      : '失败：两次生成结果不同，排块链路存在非确定性来源'
}

function renderOffscreen() {
  const tiles = session.currentTiles
  if (offscreen.width !== OFF_SIZE) {
    offscreen.width = OFF_SIZE
    offscreen.height = OFF_SIZE
  }
  const octx = offscreen.getContext('2d')!
  octx.fillStyle = '#101722'
  octx.fillRect(0, 0, OFF_SIZE, OFF_SIZE)
  if (!tiles || tiles.count === 0) {
    offDirty = false
    return
  }
  for (let i = 0; i < tiles.count; i++) {
    const t = readTile(tiles.data, i)
    const entry = tiles.palette[t.paletteIdx]
    if (!entry) continue
    const x = t.cu * OFF_SIZE
    const y = t.cv * OFF_SIZE
    const w = t.wu * OFF_SIZE
    const h = t.hv * OFF_SIZE
    octx.save()
    octx.translate(x, y)
    octx.rotate(t.tilt)
    octx.fillStyle = `rgb(${entry.color[0]},${entry.color[1]},${entry.color[2]})`
    octx.fillRect(-w / 2, -h / 2, w, h)
    octx.restore()
  }
  offDirty = false
}

function draw() {
  const canvasEl = canvasRef.value
  const tiles = session.currentTiles
  if (!canvasEl || !ctx) return
  const size = canvasEl.clientWidth
  canvasEl.width = size
  canvasEl.height = size
  if (offDirty) renderOffscreen()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(offscreen, 0, 0, size, size)
  // 选中块（含拖拽中的最新位置）在 blit 之上单独重绘
  if (tiles && selected.value >= 0) {
    const t = readTile(tiles.data, selected.value)
    const entry = tiles.palette[t.paletteIdx]
    if (entry) {
      const x = t.cu * size
      const y = t.cv * size
      const w = t.wu * size
      const h = t.hv * size
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(t.tilt)
      ctx.fillStyle = `rgb(${entry.color[0]},${entry.color[1]},${entry.color[2]})`
      ctx.fillRect(-w / 2, -h / 2, w, h)
      ctx.strokeStyle = '#d4aa48'
      ctx.lineWidth = 2
      ctx.strokeRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2)
      ctx.restore()
    }
  }
}

function requestDraw() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(draw)
}

function eventUv(event: MouseEvent): [number, number] {
  const rect = canvasRef.value!.getBoundingClientRect()
  return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height]
}

// 线性扫描拾取（2D 编辑器块数远小于预览规模，足够快）
function pickAt(u: number, v: number): number {
  const tiles = session.currentTiles
  if (!tiles) return -1
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < tiles.count; i++) {
    const t = readTile(tiles.data, i)
    const d = (t.cu - u) ** 2 + (t.cv - v) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  const t = best >= 0 ? readTile(tiles.data, best) : null
  if (!t || bestD > (t.wu * t.wu + t.hv * t.hv) * 1.5) return -1
  return best
}

function onDown(event: MouseEvent) {
  const [u, v] = eventUv(event)
  const idx = pickAt(u, v)
  selected.value = idx
  if (idx >= 0 && session.currentTiles) {
    const t = readTile(session.currentTiles.data, idx)
    drag = { index: idx, startX: event.clientX, startY: event.clientY, cu: t.cu, cv: t.cv }
  }
  requestDraw()
}

function onMove(event: MouseEvent) {
  if (!drag || !session.currentTiles) return
  const rect = canvasRef.value!.getBoundingClientRect()
  const du = (event.clientX - drag.startX) / rect.width
  const dv = (event.clientY - drag.startY) / rect.height
  writeTile(session.currentTiles.data, drag.index, {
    cu: Math.min(1, Math.max(0, drag.cu + du)),
    cv: Math.min(1, Math.max(0, drag.cv + dv)),
  })
  requestDraw()
}

function onUp() {
  if (drag && session.currentTiles) {
    hashValue.value = hashFloat32(session.currentTiles.data)
    // 拖拽结束把新位置烘焙进离屏缓存
    offDirty = true
    requestDraw()
  }
  drag = null
}

function setSelectedPalette(materialId: string) {
  const tiles = session.currentTiles
  if (selected.value < 0 || !tiles) return
  let idx = tiles.palette.findIndex((p) => p.materialId === materialId)
  if (idx < 0) {
    const m = session.materials.find((x) => x.id === materialId)
    if (!m) return
    idx = tiles.palette.push({ materialId, color: m.color }) - 1
  }
  writeTile(tiles.data, selected.value, { paletteIdx: idx })
  hashValue.value = hashFloat32(tiles.data)
  offDirty = true
  requestDraw()
}

function nudgeTilt(deltaDeg: number) {
  const tiles = session.currentTiles
  if (selected.value < 0 || !tiles) return
  const t = readTile(tiles.data, selected.value)
  writeTile(tiles.data, selected.value, { tilt: t.tilt + (deltaDeg * Math.PI) / 180 })
  hashValue.value = hashFloat32(tiles.data)
  offDirty = true
  requestDraw()
}

const selectedMaterial = ref('')
watch(selected, (i) => {
  const tiles = session.currentTiles
  if (i < 0 || !tiles) {
    selectedMaterial.value = ''
    return
  }
  selectedMaterial.value = tiles.palette[readTile(tiles.data, i).paletteIdx]?.materialId ?? ''
})

onMounted(() => {
  ctx = canvasRef.value?.getContext('2d') ?? null
  init()
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onUp)
})

const estimate = () =>
  session.currentProject ? estimateTileCount(session.currentProject.wall, params) : 0
const area = () => (session.currentProject ? wallArea(session.currentProject.wall) : 0)
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <button class="btn" @click="router.push('/projects')">
          <AppIcon name="back" :size="16" />项目
        </button>
        <div>
          <h1 class="title">排块编辑</h1>
          <p class="subtitle">同参数同种子结果逐字节一致；拖动单块、改色、改倾角都会即时写入</p>
        </div>
      </div>
      <div class="head-actions">
        <button class="btn" @click="router.push(`/projects/${projectId}/preview`)" :disabled="!session.currentTiles">
          <AppIcon name="eye" :size="16" />墙面预览
        </button>
      </div>
    </header>

    <div class="workspace">
      <div class="card canvas-card">
        <canvas
          ref="canvasRef"
          class="tile-canvas"
          @mousedown="onDown"
        ></canvas>
        <div v-if="!session.currentTiles" class="empty-state overlay-empty">
          <div class="icon-card"><AppIcon name="grid" :size="32" /></div>
          <div style="color: var(--text)">调整右侧参数后生成第一版排块</div>
        </div>
      </div>

      <aside class="side">
        <section class="card panel">
          <h2 class="panel-title">排块参数</h2>
          <label class="label">随机种子（确定性）</label>
          <input v-model.number="params.seed" type="number" class="input" />
          <label class="label">基准块边长（{{ params.baseSize.toFixed(3) }} m）</label>
          <input v-model.number="params.baseSize" type="range" min="0.008" max="0.04" step="0.001" />
          <label class="label">缝宽（{{ params.gap.toFixed(3) }} m）</label>
          <input v-model.number="params.gap" type="range" min="0.001" max="0.008" step="0.0005" />
          <label class="label">尺寸随机度（{{ params.sizeJitter.toFixed(2) }}）</label>
          <input v-model.number="params.sizeJitter" type="range" min="0" max="0.5" step="0.01" />
          <label class="label">切割随机度（{{ params.cutRandom.toFixed(2) }}）</label>
          <input v-model.number="params.cutRandom" type="range" min="0" max="1" step="0.01" />
          <label class="label">倾斜随机（{{ params.tiltRandom.toFixed(1) }}°）</label>
          <input v-model.number="params.tiltRandom" type="range" min="0" max="20" step="0.5" />
          <label class="label">引导场跟随（{{ params.followFlow.toFixed(2) }}）</label>
          <input v-model.number="params.followFlow" type="range" min="0" max="1" step="0.05" />
          <div class="estimate">
            预计 <strong>{{ estimate().toLocaleString() }}</strong> 块 / 墙面 {{ area().toFixed(1) }} ㎡
          </div>
          <button class="btn btn-primary generate-btn" :disabled="generating" @click="runGenerate">
            <AppIcon name="refresh" :size="16" />{{ generating ? '生成中…' : '生成排块' }}
          </button>
          <div v-if="perfMs > 0" class="perf">生成耗时 {{ perfMs }} ms · 哈希 {{ hashValue.toString(16) }}</div>
          <button class="btn repro-btn" @click="checkReproducibility">
            <AppIcon name="check" :size="15" />复现性自检
          </button>
          <div v-if="reproResult" class="repro-result" :class="{ ok: reproResult.startsWith('通过') }">
            {{ reproResult }}
          </div>
        </section>

        <section v-if="selected >= 0" class="card panel">
          <h2 class="panel-title">单块编辑 #{{ selected }}</h2>
          <label class="label">材料 / 颜色</label>
          <select v-model="selectedMaterial" class="input" @change="setSelectedPalette(selectedMaterial)">
            <option v-for="m in session.materials" :key="m.id" :value="m.id">
              {{ m.name }}（{{ m.category === 'gold' ? '金箔' : m.category === 'stone' ? '石头' : '玻璃' }}）
            </option>
          </select>
          <div class="tilt-row">
            <button class="btn" @click="nudgeTilt(-5)">-5°</button>
            <button class="btn" @click="nudgeTilt(5)">+5°</button>
          </div>
          <div class="hint">按住块体可直接拖动位置</div>
        </section>

        <section v-if="warnings.length" class="card panel warning-panel">
          <h2 class="panel-title"><AppIcon name="warn" :size="16" />匹配提示</h2>
          <ul>
            <li v-for="(w, i) in warnings" :key="i" :class="w.type">{{ w.message }}</li>
          </ul>
        </section>

        <section class="card panel">
          <h2 class="panel-title"><AppIcon name="history" :size="16" />版本历史</h2>
          <div class="version-form">
            <input v-model="versionLabel" class="input" placeholder="版本备注（可选）" />
            <button class="btn btn-primary" :disabled="!session.currentTiles" @click="saveVersion">
              <AppIcon name="plus" :size="16" />存档
            </button>
          </div>
          <div v-if="session.versions.length === 0" class="hint">还没有存档，生成后排块只存在当前会话</div>
          <ul class="version-list">
            <li
              v-for="v in session.versions"
              :key="v.id"
              :class="{ active: v.id === session.currentProject?.currentVersionId }"
              @click="restoreVersion(v)"
            >
              <div>
                <div class="v-label">{{ v.label }}</div>
                <div class="v-time">{{ new Date(v.createdAt).toLocaleString('zh-CN') }} · {{ v.tiles.count.toLocaleString() }} 块</div>
              </div>
              <button class="icon-btn" @click="removeVersion(v, $event)">
                <AppIcon name="trash" :size="14" />
              </button>
            </li>
          </ul>
        </section>
      </aside>
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
.workspace {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--sp-5);
  align-items: start;
}
.canvas-card {
  padding: var(--sp-3);
  position: relative;
  min-height: 600px;
  display: flex;
}
.tile-canvas {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  cursor: grab;
}
.tile-canvas:active {
  cursor: grabbing;
}
.overlay-empty {
  position: absolute;
  inset: var(--sp-3);
  display: flex;
}
.side {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.panel {
  padding: var(--sp-5);
}
.panel-title {
  font-size: var(--fs-base);
  margin-bottom: var(--sp-4);
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.label {
  margin-top: var(--sp-3);
}
.estimate {
  margin-top: var(--sp-4);
  padding: var(--sp-3);
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  font-size: var(--fs-xs);
  color: var(--text-muted);
}
.estimate strong {
  color: var(--primary);
  font-size: var(--fs-base);
}
.generate-btn {
  width: 100%;
  justify-content: center;
  margin-top: var(--sp-3);
}
.perf {
  margin-top: var(--sp-2);
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
}
.repro-btn {
  width: 100%;
  justify-content: center;
  margin-top: var(--sp-3);
}
.repro-result {
  margin-top: var(--sp-2);
  font-size: 12px;
  color: var(--danger);
  line-height: 1.6;
}
.repro-result.ok {
  color: var(--success);
}
.tilt-row {
  display: flex;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}
.hint {
  font-size: var(--fs-xs);
  color: var(--text-muted);
  margin-top: var(--sp-3);
}
.warning-panel ul {
  margin: 0;
  padding-left: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  font-size: var(--fs-xs);
}
.warning-panel li.stock {
  color: var(--danger);
}
.warning-panel li.gap {
  color: #e0a44e;
}
.version-form {
  display: flex;
  gap: var(--sp-2);
}
.version-list {
  list-style: none;
  margin: var(--sp-3) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.version-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color var(--t-fast);
}
.version-list li:hover,
.version-list li.active {
  border-color: var(--primary);
}
.v-label {
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
}
.v-time {
  font-size: 12px;
  color: var(--text-muted);
}
.icon-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: var(--sp-1);
}
.icon-btn:hover {
  color: var(--danger);
}
</style>
