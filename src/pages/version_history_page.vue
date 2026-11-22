<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/page_header.vue'
import Icon from '@/components/icon.vue'
import EmptyState from '@/components/empty_state.vue'
import { projectRepo, versionRepo } from '@/data/repos'
import type { Project, TileVersion } from '@/core/types'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id as string

const project = shallowRef<Project | null>(null)
const versions = ref<TileVersion[]>([])

async function refresh(): Promise<void> {
  project.value = (await projectRepo.get(projectId)) ?? null
  versions.value = (await versionRepo.listByProject(projectId)).sort((a, b) => b.createdAt - a.createdAt)
}

async function restore(v: TileVersion): Promise<void> {
  if (!project.value) return
  if (!window.confirm(`回到版本「${v.label}」？当前版本不会被删除，只是切换指针。`)) return
  project.value.currentVersionId = v.id
  project.value.updatedAt = Date.now()
  await projectRepo.save(project.value)
  await refresh()
}

async function remove(v: TileVersion): Promise<void> {
  if (!project.value) return
  if (project.value.currentVersionId === v.id) {
    window.alert('当前正在使用的版本不能删除，请先切换到其他版本')
    return
  }
  if (!window.confirm(`删除版本「${v.label}」及其块数据？`)) return
  await versionRepo.remove(v.id)
  await refresh()
}

function fmt(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN')
}

onMounted(refresh)
</script>

<template>
  <div>
    <PageHeader title="版本历史" subtitle="每次排块生成与手动调整都可留存，随时回到任一版">
      <button class="btn" @click="router.push(`/projects/${projectId}/tiles`)"><Icon name="grid" :size="15" /> 排块编辑</button>
    </PageHeader>

    <div class="p-6">
      <EmptyState v-if="versions.length === 0" icon="history" title="还没有任何版本" description="在排块编辑页生成第一版排块" />
      <div v-else class="flex flex-col gap-3 max-w-3xl">
        <article
          v-for="v in versions"
          :key="v.id"
          class="card p-4 flex items-center gap-4"
          :style="project?.currentVersionId === v.id ? 'border-color: var(--color-primary)' : ''"
        >
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            :style="project?.currentVersionId === v.id
              ? 'background: var(--color-primary); color: #fff'
              : 'background: var(--c-surface-2); color: var(--c-text-3)'"
          >
            <Icon name="history" :size="18" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold">{{ v.label }}</h3>
              <span
                v-if="project?.currentVersionId === v.id"
                class="text-xs px-2 py-0.5 rounded-full font-medium"
                style="background: var(--color-primary-soft); color: var(--color-primary)"
              >当前版本</span>
            </div>
            <p class="text-sm muted mt-1">
              {{ fmt(v.createdAt) }} · {{ v.stats.count.toLocaleString() }} 块 · {{ v.stats.colorCount }} 种材料
              <span v-if="v.note"> · {{ v.note }}</span>
            </p>
            <div class="flex gap-2 mt-2 flex-wrap">
              <span
                v-for="w in v.stats.warnings"
                :key="w"
                class="text-xs px-2 py-0.5 rounded-full"
                style="background: rgb(217 119 6 / 0.12); color: var(--color-warn)"
              >{{ w }}</span>
            </div>
          </div>
          <div class="flex gap-2 shrink-0">
            <button
              class="btn"
              :disabled="project?.currentVersionId === v.id"
              @click="restore(v)"
            >
              <Icon name="reset" :size="15" /> 回到此版
            </button>
            <button class="btn btn-danger" @click="remove(v)"><Icon name="trash" :size="15" /></button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
