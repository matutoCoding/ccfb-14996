<script setup lang="ts">
// 统一线性图标：1.6 线宽、圆角端点、24 视框，禁 emoji
const props = defineProps<{ name: string; size?: number }>()

const paths: Record<string, string> = {
  wall: 'M4 4h16v16H4z M4 9h16 M9 9v11 M15 9v11',
  image: 'M4 5h16v14H4z M8 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M5 18l5-5 3 3 3-4 3 3',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  gem: 'M7 3h10l4 5-9 13L3 8z M3 8h18 M9 3l-2 5 5 13 M15 3l2 5-5 13',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  doc: 'M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6',
  plus: 'M12 5v14 M5 12h14',
  trash: 'M5 7h14 M10 11v6 M14 11v6 M7 7l1 13h8l1-13 M9 7V4h6v3',
  download: 'M12 4v10 M8 11l4 4 4-4 M5 19h14',
  refresh: 'M20 11a8 8 0 1 0-2.3 6.3 M20 5v6h-6',
  check: 'M5 12l5 5L20 7',
  warn: 'M12 4l9 16H3z M12 10v4 M12 17.5v.5',
  back: 'M15 5l-7 7 7 7',
  edit: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',
  layers: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5',
  history: 'M4 12a8 8 0 1 1 2.3 5.7 M4 18v-4h4 M12 8v4l3 2',
}
</script>

<template>
  <svg
    :width="props.size ?? 20"
    :height="props.size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[props.name] ?? ''" />
  </svg>
</template>
