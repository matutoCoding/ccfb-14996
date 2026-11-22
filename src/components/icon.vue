<script setup lang="ts">
// 统一线性图标：stroke 1.6、圆角端点、currentColor 继承
defineProps<{ name: string; size?: number }>()

const paths: Record<string, string> = {
  project: 'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4',
  image: 'M3 5h18v14H3z M8 10a2 2 0 10.01 0 M21 16l-5-5-8 8',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  material: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z M12 12l8-4.5 M12 12v9 M12 12L4 7.5',
  wall: 'M4 18l8-12 8 12 M7 18h10',
  print: 'M7 9V3h10v6 M7 18H5a2 2 0 01-2-2v-5a2 2 0 012-2h14a2 2 0 012 2v5a2 2 0 01-2 2h-2 M7 14h10v7H7z',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-7 3.3L3 8 M3 4v4h4 M12 8v4l3 2',
  plus: 'M12 5v14 M5 12h14',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  edit: 'M4 20h4l10-10-4-4L4 16v4z M14 6l4 4',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  candle: 'M12 3c1.5 2 2.5 3.2 2.5 4.5a2.5 2.5 0 11-5 0C9.5 6.2 10.5 5 12 3z M10 12h4l1 9H9l1-9z',
  spot: 'M7 4h10l-2 5H9L7 4z M12 9v3 M10 20h4 M11 12l-2 8 M13 12l2 8',
  alert: 'M12 4l9 16H3l9-16z M12 10v4 M12 17.5v.5',
  reset: 'M20 12a8 8 0 11-2.3-5.6 M20 4v4h-4',
  play: 'M7 5l12 7-12 7V5z',
  upload: 'M12 16V4 M8 8l4-4 4 4 M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3',
  check: 'M5 12l5 5L20 7',
}
</script>

<template>
  <svg
    :width="size ?? 18"
    :height="size ?? 18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] ?? paths.grid" />
  </svg>
</template>
