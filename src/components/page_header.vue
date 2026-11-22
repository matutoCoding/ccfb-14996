<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <header class="flex items-end justify-between px-6 py-5 border-b" style="border-color: var(--c-border)">
    <div>
      <h1 class="text-xl font-semibold">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm muted mt-1">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-2"><slot /></div>
  </header>
</template>
