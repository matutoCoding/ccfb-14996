// 首次播种进度（main.ts 写入，App.vue 读取）
import { reactive } from 'vue'

export const seedState = reactive({
  running: true,
  phase: '初始化',
  ratio: 0,
  error: '' as string,
})
