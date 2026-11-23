<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import AppIcon from '@/components/app_icon.vue'
import { refreshMaterials, refreshProjects, session } from '@/store/session'
import { seedAll } from '@/core/seed'

const route = useRoute()

const nav = [
  { to: '/projects', icon: 'wall', label: '项目列表' },
  { to: '/materials', icon: 'gem', label: '材料库' },
]

onMounted(async () => {
  if (!session.loaded) {
    await seedAll()
    await Promise.all([refreshProjects(), refreshMaterials()])
    session.loaded = true
  }
})
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">
          <AppIcon name="gem" :size="22" />
        </span>
        <div>
          <div class="brand-name">熔光工坊</div>
          <div class="brand-sub">Mosaic Atelier</div>
        </div>
      </div>

      <nav class="nav">
        <RouterLink v-for="item in nav" :key="item.to" :to="item.to" class="nav-item">
          <AppIcon :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div v-if="session.currentProject" class="context-box">
        <div class="context-title">当前墙面</div>
        <div class="context-name">{{ session.currentProject.name }}</div>
        <div class="context-links">
          <RouterLink :to="`/projects/${session.currentProject.id}/source`">原稿</RouterLink>
          <RouterLink :to="`/projects/${session.currentProject.id}/layout`">排块</RouterLink>
          <RouterLink :to="`/projects/${session.currentProject.id}/preview`">预览</RouterLink>
          <RouterLink :to="`/projects/${session.currentProject.id}/construction`">施工图</RouterLink>
        </div>
      </div>
    </aside>

    <main class="main">
      <RouterView :key="route.fullPath" />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100%;
}
.sidebar {
  width: 232px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: var(--sp-5) var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  background: var(--primary-weak);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-name {
  font-size: var(--fs-base);
  font-weight: var(--fw-semibold);
}
.brand-sub {
  font-size: var(--fs-xs);
  color: var(--text-muted);
  letter-spacing: 0.08em;
}
.nav {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-3);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  text-decoration: none;
  font-size: var(--fs-sm);
  transition: all var(--t-fast);
}
.nav-item:hover {
  background: var(--surface-2);
  color: var(--text);
}
.nav-item.router-link-active {
  background: var(--primary-weak);
  color: var(--primary);
}
.context-box {
  margin-top: auto;
  padding: var(--sp-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
}
.context-title {
  font-size: var(--fs-xs);
  color: var(--text-muted);
  margin-bottom: var(--sp-1);
}
.context-name {
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  margin-bottom: var(--sp-3);
}
.context-links {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-2);
}
.context-links a {
  font-size: var(--fs-xs);
  color: var(--primary);
  text-decoration: none;
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
  transition: all var(--t-fast);
}
.context-links a:hover {
  border-color: var(--primary);
}
.main {
  flex: 1;
  min-width: 0;
  overflow: auto;
}
</style>
