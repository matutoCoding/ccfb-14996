<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/app_icon.vue'
import { projectRepo, sourceRepo } from '@/core/db'
import { selectProject, session } from '@/store/session'
import { buildFlowField, buildGuideLines, loadSourceImage, type SourceImage } from '@/core/image'
import type { FlowField, GuideLine } from '@/core/types'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id as string

const canvasRef = ref<HTMLCanvasElement | null>(null)
const sourceUrl = ref('')
const source = ref<SourceImage | null>(null)
const field = ref<FlowField | null>(null)
const lines = ref<GuideLine[]>([])
const showFlow = ref(true)
const lineCount = ref(36)
const analyzing = ref(false)
const fileName = ref('')

async function loadExisting() {
  await selectProject(projectId)
  const rec = await sourceRepo.get(projectId)
  if (rec) {
    sourceUrl.value = URL.createObjectURL(rec.blob)
    await analyze(rec.blob)
  }
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileName.value = file.name
  await analyze(file, true)
}

async function analyze(file: Blob, persist = false) {
  analyzing.value = true
  try {
    const img = await loadSourceImage(file, 512)
    source.value = img
    field.value = buildFlowField(img, 48, 48)
    lines.value = buildGuideLines(field.value, lineCount.value)
    draw()
    if (persist && session.currentProject) {
      await sourceRepo.save(projectId, file, img.width, img.height)
      session.currentProject.sourceWidth = img.width
      session.currentProject.sourceHeight = img.height
      session.currentProject.sourceName = fileName.value || 'upload.png'
      session.currentProject.updatedAt = Date.now()
      await projectRepo.save(session.currentProject)
    }
  } finally {
    analyzing.value = false
  }
}

function regenerate() {
  if (!field.value) return
  lines.value = buildGuideLines(field.value, lineCount.value)
  draw()
}

function draw() {
  const canvasEl = canvasRef.value
  const img = source.value
  if (!canvasEl || !img) return
  const size = 520
  canvasEl.width = size
  canvasEl.height = size
  const ctx = canvasEl.getContext('2d')!
  ctx.putImageData(img.imageData, 0, 0, 0, 0, img.width, img.height)
  // 原图可能非正方，按比例拉伸铺满预览
  ctx.drawImage(canvasEl, 0, 0, img.width, img.height, 0, 0, size, size)
  if (!showFlow.value) return
  ctx.lineWidth = 1.4
  for (const line of lines.value) {
    ctx.beginPath()
    line.points.forEach(([u, v], i) => {
      const x = u * size
      const y = v * size
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = `rgba(212,170,72,${0.35 + line.strength * 0.55})`
    ctx.stroke()
  }
}

function toggleFlow() {
  showFlow.value = !showFlow.value
  draw()
}

onMounted(loadExisting)
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <button class="btn" @click="router.push('/projects')">
          <AppIcon name="back" :size="16" />项目
        </button>
        <div>
          <h1 class="title">原稿处理</h1>
          <p class="subtitle">结构张量提取轮廓与衣褶走向，生成的引导线会驱动排块倾斜方向</p>
        </div>
      </div>
      <div class="head-actions">
        <label class="btn">
          <AppIcon name="download" :size="16" />导入原稿
          <input type="file" accept="image/*" hidden @change="onFile" />
        </label>
        <button class="btn btn-primary" :disabled="!source" @click="router.push(`/projects/${projectId}/layout`)">
          去排块<AppIcon name="grid" :size="16" />
        </button>
      </div>
    </header>

    <div class="workspace">
      <div class="card canvas-card">
        <canvas v-if="source" ref="canvasRef" class="source-canvas"></canvas>
        <div v-else class="empty-state">
          <div class="icon-card"><AppIcon name="image" :size="32" /></div>
          <div>
            <div style="color: var(--text); font-size: var(--fs-lg)">导入设计稿开始分析</div>
            <div>支持 PNG / JPG，内部降采样到 512px 做走向提取，原图存 IndexedDB</div>
          </div>
          <label class="btn btn-primary">
            <AppIcon name="plus" :size="16" />选择图片
            <input type="file" accept="image/*" hidden @change="onFile" />
          </label>
        </div>
        <div v-if="analyzing" class="analyzing">分析中…</div>
      </div>

      <aside class="card side-panel">
        <h2 class="panel-title">引导线参数</h2>
        <label class="label">流线数量（{{ lineCount }}）</label>
        <input v-model.number="lineCount" type="range" min="8" max="80" step="2" @change="regenerate" />
        <div class="panel-actions">
          <button class="btn" :disabled="!source" @click="toggleFlow">
            <AppIcon name="eye" :size="16" />{{ showFlow ? '隐藏引导线' : '显示引导线' }}
          </button>
          <button class="btn" :disabled="!source" @click="regenerate">
            <AppIcon name="refresh" :size="16" />重新布点
          </button>
        </div>
        <div class="hint">
          <div class="hint-title">走向原理</div>
          <p>Sobel 梯度经结构张量聚合，主方向的垂直方向即轮廓走向；人脸边缘、衣褶和几何拼花的条纹都会被自动追踪，排块在此基础上沿流线倾斜。</p>
        </div>
        <div v-if="field" class="stats">
          <div class="stat-row"><span>分析网格</span><strong>{{ field.cols }} × {{ field.rows }}</strong></div>
          <div class="stat-row"><span>生成流线</span><strong>{{ lines.length }} 条</strong></div>
          <div class="stat-row"><span>原稿尺寸</span><strong>{{ source?.width }} × {{ source?.height }}</strong></div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: var(--sp-6);
  max-width: 1280px;
  margin: 0 auto;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--sp-6);
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
.head-actions {
  display: flex;
  gap: var(--sp-3);
}
.workspace {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--sp-5);
}
.canvas-card {
  padding: var(--sp-4);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 560px;
  position: relative;
}
.source-canvas {
  width: 100%;
  max-width: 560px;
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
}
.analyzing {
  position: absolute;
  bottom: var(--sp-4);
  background: var(--surface-2);
  border: 1px solid var(--border);
  padding: var(--sp-2) var(--sp-4);
  border-radius: 999px;
  font-size: var(--fs-xs);
}
.side-panel {
  padding: var(--sp-5);
  align-self: start;
}
.panel-title {
  font-size: var(--fs-lg);
  margin-bottom: var(--sp-4);
}
.panel-actions {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin: var(--sp-4) 0;
}
.hint {
  border-top: 1px solid var(--border);
  padding-top: var(--sp-4);
}
.hint-title {
  font-size: var(--fs-xs);
  color: var(--primary);
  margin-bottom: var(--sp-2);
}
.hint p {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--text-muted);
  line-height: 1.7;
}
.stats {
  margin-top: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-xs);
  color: var(--text-muted);
}
.stat-row strong {
  color: var(--text);
  font-weight: var(--fw-medium);
}
</style>
