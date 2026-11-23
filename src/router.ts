import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/projects' },
    { path: '/projects', name: 'projects', component: () => import('@/pages/project_list.vue') },
    { path: '/projects/:id/source', name: 'source', component: () => import('@/pages/source_process.vue') },
    { path: '/projects/:id/layout', name: 'layout', component: () => import('@/pages/layout_editor.vue') },
    { path: '/materials', name: 'materials', component: () => import('@/pages/material_library.vue') },
    { path: '/projects/:id/preview', name: 'preview', component: () => import('@/pages/wall_preview.vue') },
    { path: '/projects/:id/construction', name: 'construction', component: () => import('@/pages/construction_docs.vue') },
  ],
})
