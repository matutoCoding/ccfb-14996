<script setup lang="ts">
import Icon from '@/components/icon.vue'

defineProps<{ title: string; description: string; icon: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <div
      class="flex items-center justify-center w-16 h-16 rounded-lg mb-4"
      style="background: var(--c-surface-2); color: var(--c-text-3)"
    >
      <Icon :name="icon" :size="30" />
    </div>
    <h3 class="text-base font-semibold mb-1">{{ title }}</h3>
    <p class="muted text-sm">{{ description }}</p>
    <div class="mt-4"><slot /></div>
  </div>
</template>
