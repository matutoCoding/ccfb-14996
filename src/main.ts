import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './styles/main.css'
import { ensureSeedData } from './data/seed'
import { seedState } from './data/seed_store'

ensureSeedData((p) => {
  seedState.phase = p.phase
  seedState.ratio = p.ratio
})
  .catch((e) => {
    seedState.error = e instanceof Error ? e.message : String(e)
  })
  .finally(() => {
    seedState.running = false
    createApp(App).use(router).mount('#app')
  })
