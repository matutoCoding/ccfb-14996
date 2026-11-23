<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/app_icon.vue'
import { projectRepo } from '@/core/db'
import { refreshProjects, session } from '@/store/session'
import type { WallKind, WallSpec } from '@/core/types'

const router = useRouter()
const showCreate = ref(false)
const saving = ref(false)

const wallKindLabel: Record<WallKind, string> = {
  flat: '平面墙',
  arc: '圆弧墙',
  dome: '半穹顶',
}

const form = reactive({
  name: '',
  client: '',
  kind: 'flat' as WallKind,
  width: 5,
  height: 4,
  radius: 6,
  arcAngleDeg: 60,
  azimuthDeg: 180,
})

async function createProject() {
  saving.value = true
  try {
    const id = `proj-${Date.now().toString(36)}`
    const wall: WallSpec = {
      kind: form.kind,
      width: form.width,
      height: form.height,
      radius: form.kind === 'flat' ? 0 : form.radius,
      arcAngle: (form.arcAngleDeg * Math.PI) / 180,
      azimuth: (form.azimuthDeg * Math.PI) / 180,
    }
    await projectRepo.save({
      id,
      name: form.name || '未命名墙面',
      client: form.client,
      wall,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sourceWidth: 0,
      sourceHeight: 0,
      sourceName: '',
      currentVersionId: null,
    })
    await refreshProjects()
    showCreate.value = false
    router.push(`/projects/${id}/source`)
  } finally {
    saving.value = false
  }
}

async function remove(id: string, name: string, event: Event) {
  event.stopPropagation()
  if (!window.confirm(`确认删除「${name}」？其版本历史与原稿会一并清除。`)) return
  await projectRepo.remove(id)
  await refreshProjects()
}

function open(id: string) {
  router.push(`/projects/${id}/layout`)
}

onMounted(refreshProjects)
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="title">项目列表</h1>
        <p class="subtitle">按墙面管理工程，每面墙独立保存原稿、排块版本与材料用量</p>
      </div>
      <button class="btn btn-primary" @click="showCreate = true">
        <AppIcon name="plus" :size="16" />新建墙面
      </button>
    </header>

    <div v-if="session.projects.length === 0" class="card empty-state">
      <div class="icon-card"><AppIcon name="wall" :size="32" /></div>
      <div>
        <div style="font-size: var(--fs-lg); color: var(--text); margin-bottom: var(--sp-1)">还没有墙面工程</div>
        <div>新建第一面墙，或从测试数据开始体验完整流程</div>
      </div>
    </div>

    <div v-else class="grid">
      <article v-for="p in session.projects" :key="p.id" class="card project-card" @click="open(p.id)">
        <div class="card-top">
          <h2 class="card-title">{{ p.name }}</h2>
          <button class="icon-btn btn-danger" :title="'删除'" @click="remove(p.id, p.name, $event)">
            <AppIcon name="trash" :size="16" />
          </button>
        </div>
        <div class="client">{{ p.client || '未填写客户' }}</div>
        <div class="meta-row">
          <span class="tag">{{ wallKindLabel[p.wall.kind] }}</span>
          <span class="meta-text">{{ p.wall.width.toFixed(1)}}m × {{ p.wall.height.toFixed(1) }}m</span>
        </div>
        <dl class="specs">
          <div v-if="p.wall.kind !== 'flat'">
            <dt>曲率半径</dt><dd>{{ p.wall.radius.toFixed(2) }} m</dd>
          </div>
          <div v-if="p.wall.kind !== 'flat'">
            <dt>弧度</dt><dd>{{ ((p.wall.arcAngle * 180) / Math.PI).toFixed(0) }}°</dd>
          </div>
          <div>
            <dt>朝向</dt><dd>{{ ((p.wall.azimuth * 180) / Math.PI).toFixed(0) }}°</dd>
          </div>
          <div>
            <dt>原稿</dt><dd>{{ p.sourceName || '未导入' }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="card modal">
        <h2 class="modal-title">新建墙面工程</h2>
        <div class="form-grid">
          <div>
            <label class="label">工程名称</label>
            <input v-model="form.name" class="input" placeholder="例如：主祭坛半圆穹顶" />
          </div>
          <div>
            <label class="label">客户 / 场地</label>
            <input v-model="form.client" class="input" placeholder="例如：圣马可小礼拜堂" />
          </div>
          <div>
            <label class="label">墙面类型</label>
            <select v-model="form.kind" class="input">
              <option value="flat">平面墙</option>
              <option value="arc">圆弧墙</option>
              <option value="dome">半穹顶</option>
            </select>
          </div>
          <div>
            <label class="label">朝向（方位角 °）</label>
            <input v-model.number="form.azimuthDeg" type="number" min="0" max="360" class="input" />
          </div>
          <div>
            <label class="label">宽度 / 弧展宽（m）</label>
            <input v-model.number="form.width" type="number" min="0.5" step="0.1" class="input" />
          </div>
          <div>
            <label class="label">高度（m）</label>
            <input v-model.number="form.height" type="number" min="0.5" step="0.1" class="input" />
          </div>
          <template v-if="form.kind !== 'flat'">
            <div>
              <label class="label">曲率半径（m）</label>
              <input v-model.number="form.radius" type="number" min="0.5" step="0.1" class="input" />
            </div>
            <div>
              <label class="label">{{ form.kind === 'dome' ? '穹顶张角（°）' : '弧心角（°）' }}</label>
              <input v-model.number="form.arcAngleDeg" type="number" min="10" max="360" class="input" />
            </div>
          </template>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showCreate = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="createProject">
            <AppIcon name="check" :size="16" />创建
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: var(--sp-6);
  max-width: 1200px;
  margin: 0 auto;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--sp-6);
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
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--sp-4);
}
.project-card {
  padding: var(--sp-5);
  cursor: pointer;
  transition:
    transform var(--t-fast),
    border-color var(--t-fast),
    box-shadow var(--t-fast);
}
.project-card:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
  box-shadow: var(--shadow);
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--sp-3);
}
.card-title {
  font-size: var(--fs-lg);
}
.icon-btn {
  padding: var(--sp-1);
  background: transparent;
  border: none;
  color: var(--text-muted);
}
.icon-btn:hover {
  color: var(--danger);
}
.client {
  color: var(--text-muted);
  font-size: var(--fs-xs);
  margin: var(--sp-1) 0 var(--sp-3);
}
.meta-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}
.meta-text {
  font-size: var(--fs-xs);
  color: var(--text-muted);
}
.specs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-2);
  margin: 0;
}
.specs div {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-xs);
  padding: var(--sp-1) 0;
  border-top: 1px solid var(--border);
}
.specs dt {
  color: var(--text-muted);
}
.specs dd {
  margin: 0;
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(4, 8, 16, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: var(--sp-5);
}
.modal {
  width: min(640px, 100%);
  padding: var(--sp-6);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.modal-title {
  font-size: var(--fs-xl);
  margin-bottom: var(--sp-5);
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
  margin-top: var(--sp-6);
}
</style>
