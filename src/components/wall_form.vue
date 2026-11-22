<script setup lang="ts">
import { reactive } from 'vue'
import type { WallConfig, WallKind } from '@/core/types'

const props = defineProps<{ modelValue: WallConfig }>()
const emit = defineEmits<{ 'update:modelValue': [WallConfig] }>()

const form = reactive({ ...props.modelValue })

const kindOptions: { value: WallKind; label: string; hint: string }[] = [
  { value: 'plane', label: '平面墙', hint: '酒店大堂等直墙' },
  { value: 'curved', label: '圆柱弧面', hint: '弧形墙，曲率填弧面高度' },
  { value: 'dome', label: '半穹顶', hint: '教堂后殿，曲率填拱起高度' },
]

function sync(): void {
  emit('update:modelValue', { ...form })
}
</script>

<template>
  <div class="flex flex-col gap-3" @change="sync">
    <div>
      <span class="label">墙面形态</span>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="opt in kindOptions"
          :key="opt.value"
          type="button"
          class="btn flex-col h-auto py-3 gap-1"
          :class="form.kind === opt.value ? 'btn-primary' : ''"
          @click="form.kind = opt.value; sync()"
        >
          <span class="text-sm">{{ opt.label }}</span>
          <span class="text-xs" :style="{ color: form.kind === opt.value ? '#dbeafe' : 'var(--c-text-3)' }">
            {{ opt.hint }}
          </span>
        </button>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <span class="label">宽度（米）</span>
        <input v-model.number="form.width" type="number" min="0.1" step="0.1" class="input" @input="sync" />
      </div>
      <div>
        <span class="label">高度（米）</span>
        <input v-model.number="form.height" type="number" min="0.1" step="0.1" class="input" @input="sync" />
      </div>
      <div>
        <span class="label">{{ form.kind === 'plane' ? '曲率（平面固定 0）' : '曲率/拱高（米）' }}</span>
        <input
          v-model.number="form.curvature"
          type="number"
          min="0"
          step="0.1"
          class="input"
          :disabled="form.kind === 'plane'"
          @input="sync"
        />
      </div>
      <div>
        <span class="label">朝向角（度，正北=0）</span>
        <input v-model.number="form.azimuth" type="number" min="0" max="360" step="5" class="input" @input="sync" />
      </div>
    </div>
    <p class="text-xs muted">面积约 {{ (form.width * form.height).toFixed(1) }} ㎡</p>
  </div>
</template>
