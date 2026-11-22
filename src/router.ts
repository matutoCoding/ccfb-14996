import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/projects' },
    { path: '/projects', component: () => import('@/pages/project_list_page.vue') },
    { path: '/materials', component: () => import('@/pages/material_library_page.vue') },
    { path: '/projects/:id/source', component: () => import('@/pages/source_image_page.vue') },
    { path: '/projects/:id/tiles', component: () => import('@/pages/tile_editor_page.vue') },
    { path: '/projects/:id/preview', component: () => import('@/pages/wall_preview_page.vue') },
    { path: '/projects/:id/drawing', component: () => import('@/pages/construction_drawing_page.vue') },
    { path: '/projects/:id/versions', component: () => import('@/pages/version_history_page.vue') },
  ],
})
