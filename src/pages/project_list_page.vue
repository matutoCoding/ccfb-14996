<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/page_header.vue'
import Icon from '@/components/icon.vue'
import EmptyState from '@/components/empty_state.vue'
import WallForm from '@/components/wall_form.vue'
import { projectRepo } from '@/data/repos'
import type { Project, WallConfig } from '@/core/types'

const router = useRouter()
const projects = ref<Project[]>([])
const showCreate = ref(false)
const name = ref('')
const wall = ref<WallConfig>({ kind: 'plane', width: 6, height: 3, curvature: 0, azimuth: 180 })

const kindLabel: Record<string, string> = { plane: '平面墙', curved: '圆柱弧面', dome: '半穹顶' }

async function refresh(): Promise<void> {
  projects.value = (await projectRepo.list()).sort((a, b) => b.updatedAt - a.updatedAt)
}

async function create(): Promise<void> {
  if (!name.value.trim()) return
  const project = projectRepo.create(name.value.trim(), { ...wall.value })
  if (wall.value.kind === 'plane') project.wall.curvature = 0
  await projectRepo.save(project)
  showCreate.value = false
  name.value = ''
  await refresh()
  router.push(`/projects/${project.id}/source`)
}

async function remove(p: Project, event: Event): Promise<void> {
  event.stopPropagation()
  if (!window.confirm(`删除项目「${p.name}」及其全部版本？此操作不可恢复。`)) return
  await projectRepo.remove(p.id)
  await refresh()
}

function fmt(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(refresh)
</script>

<template>
  <div>
    <PageHeader title="项目列表" subtitle="按墙面管理项目，每面墙独立排块与版本">
      <button class="btn btn-primary" @click="showCreate = true"><Icon name="plus" /> 新建墙面项目</button>
    </PageHeader>

    <div class="p-6">
      <EmptyState
        v-if="projects.length === 0"
        icon="project"
        title="还没有项目"
        description="新建一面墙，导入原稿后即可开始排块"
      >
        <button class="btn btn-primary" @click="showCreate = true"><Icon name="plus" /> 新建墙面项目</button>
      </EmptyState>

      <div v-else class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))">
        <article
          v-for="p in projects"
          :key="p.id"
          class="card p-4 cursor-pointer transition-all hover:shadow-md"
          @click="router.push(`/projects/${p.id}/tiles`)"
        >
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-base font-semibold leading-snug">{{ p.name }}</h3>
            <button class="btn btn-danger !h-8 !w-8 !p-0" title="删除项目" @click="remove(p, $event)">
              <Icon name="trash" :size="16" />
            </button>
          </div>
          <dl class="mt-3 flex flex-col gap-1.5 text-sm">
            <div class="flex justify-between"><dt class="muted">形态</dt><dd>{{ kindLabel[p.wall.kind] }}</dd></div>
            <div class="flex justify-between">
              <dt class="muted">尺寸</dt>
              <dd>{{ p.wall.width }} × {{ p.wall.height }} m（{{ (p.wall.width * p.wall.height).toFixed(1) }}㎡）</dd>
            </div>
            <div class="flex justify-between">
              <dt class="muted">朝向 / 曲率</dt>
              <dd>{{ p.wall.azimuth }}° / {{ p.wall.curvature || '—' }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="muted">更新时间</dt><dd>{{ fmt(p.updatedAt) }}</dd>
            </div>
          </dl>
        </article>
      </div>
    </div>

    <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
      <div class="card w-[480px] max-w-[92vw] p-5">
        <h2 class="text-lg font-semibold mb-4">新建墙面项目</h2>
        <label class="label">项目名称</label>
        <input v-model="name" class="input mb-4" placeholder="如：酒店宴会厅主墙" @keyup.enter="create" />
        <WallForm v-model="wall" />
        <div class="flex justify-end gap-2 mt-5">
          <button class="btn" @click="showCreate = false">取消</button>
          <button class="btn btn-primary" :disabled="!name.trim()" @click="create">创建并进入</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgb(15 23 42 / 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
</style>
