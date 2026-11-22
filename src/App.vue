<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '@/components/icon.vue'
import { seedState } from '@/data/seed_store'

const route = useRoute()
const projectId = computed(() => (route.params.id as string) ?? '')

const mainNav = [
  { to: '/projects', label: '项目列表', icon: 'project' },
  { to: '/materials', label: '材料库', icon: 'material' },
]

const projectNav = computed(() => {
  if (!projectId.value) return []
  const id = projectId.value
  return [
    { to: `/projects/${id}/source`, label: '原稿处理', icon: 'image' },
    { to: `/projects/${id}/tiles`, label: '排块编辑', icon: 'grid' },
    { to: `/projects/${id}/preview`, label: '墙面预览', icon: 'wall' },
    { to: `/projects/${id}/drawing`, label: '施工图', icon: 'print' },
    { to: `/projects/${id}/versions`, label: '版本历史', icon: 'history' },
  ]
})
</script>

<template>
  <div v-if="seedState.running" class="h-full flex flex-col items-center justify-center gap-4">
    <div class="text-lg font-semibold">马赛克壁画工作台</div>
    <div class="w-72 h-2 rounded-full overflow-hidden" style="background: var(--c-surface-2)">
      <div
        class="h-full transition-all"
        style="background: var(--color-primary)"
        :style="{ width: `${Math.round(seedState.ratio * 100)}%` }"
      />
    </div>
    <p class="muted text-sm">{{ seedState.phase }}（首次启动生成测试数据，约数秒）</p>
    <p v-if="seedState.error" class="text-sm" style="color: var(--color-danger)">{{ seedState.error }}</p>
  </div>
  <div v-else class="h-full flex">
    <aside
      class="w-56 shrink-0 flex flex-col border-r py-4"
      style="background: var(--c-surface); border-color: var(--c-border)"
    >
      <div class="px-4 pb-4">
        <div class="text-lg font-semibold">马赛克工作台</div>
        <div class="text-sm" style="color: var(--c-text-3)">Mosaic Studio</div>
      </div>
      <nav class="flex flex-col gap-1 px-2">
        <RouterLink
          v-for="item in mainNav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium"
          :class="route.path === item.to ? 'nav-active' : 'nav-link'"
        >
          <Icon :name="item.icon" /> {{ item.label }}
        </RouterLink>
      </nav>
      <template v-if="projectNav.length">
        <div class="px-4 pt-5 pb-2 text-sm font-medium" style="color: var(--c-text-3)">当前墙面</div>
        <nav class="flex flex-col gap-1 px-2">
          <RouterLink
            v-for="item in projectNav"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 h-10 rounded-md text-sm font-medium"
            :class="route.path === item.to ? 'nav-active' : 'nav-link'"
          >
            <Icon :name="item.icon" /> {{ item.label }}
          </RouterLink>
        </nav>
      </template>
    </aside>
    <main class="flex-1 min-w-0 overflow-auto">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.nav-link {
  color: var(--c-text-2);
  transition: background var(--t-fast), color var(--t-fast);
}
.nav-link:hover {
  background: var(--c-surface-2);
  color: var(--c-text);
}
.nav-active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}
</style>
