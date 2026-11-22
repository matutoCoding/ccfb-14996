<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/page_header.vue'
import Icon from '@/components/icon.vue'
import EmptyState from '@/components/empty_state.vue'
import { imageRepo, projectRepo } from '@/data/repos'
import { loadImage, toPixels } from '@/core/image_util'
import { computeFlowField, renderFlowVisualization } from '@/core/flow'
import type { Project, SourceImage } from '@/core/types'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id as string

const project = ref<Project | null>(null)
const image = ref<SourceImage | null>(null)
const analyzing = ref(false)
const flowUrl = ref<string | null>(null)
const showFlow = ref(true)
const allImages = ref<SourceImage[]>([])

async function refresh(): Promise<void> {
  project.value = (await projectRepo.get(projectId)) ?? null
  allImages.value = await imageRepo.list()
  image.value = project.value?.sourceImageId ? (await imageRepo.get(project.value.sourceImageId)) ?? null : null
  flowUrl.value = image.value?.flowUrl ?? null
}

async function onUpload(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !project.value) return
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const img = await loadImage(dataUrl)
  const saved: SourceImage = {
    id: `img_${Date.now().toString(36)}`,
    name: file.name,
    width: img.width,
    height: img.height,
    dataUrl,
    flowUrl: null,
    createdAt: Date.now(),
  }
  await imageRepo.save(saved)
  project.value.sourceImageId = saved.id
  project.value.updatedAt = Date.now()
  await projectRepo.save(project.value)
  flowUrl.value = null
  await refresh()
}

async function analyze(): Promise<void> {
  if (!image.value) return
  analyzing.value = true
  try {
    const img = await loadImage(image.value.dataUrl)
    const pixels = toPixels(img, 512)
    // 让进度条有机会渲染
    await new Promise((r) => setTimeout(r, 30))
    const field = computeFlowField(pixels)
    image.value.flowUrl = renderFlowVisualization(pixels, field)
    await imageRepo.save(image.value)
    flowUrl.value = image.value.flowUrl
  } finally {
    analyzing.value = false
  }
}

async function bindExisting(img: SourceImage): Promise<void> {
  if (!project.value) return
  project.value.sourceImageId = img.id
  project.value.updatedAt = Date.now()
  await projectRepo.save(project.value)
  await refresh()
}

onMounted(refresh)
</script>

<template>
  <div>
    <PageHeader :title="project?.name ?? '原稿处理'" subtitle="导入设计稿，按轮廓与主体走向生成排块引导线">
      <button class="btn" @click="router.push(`/projects/${projectId}/tiles`)">去排块编辑 <Icon name="grid" /></button>
    </PageHeader>

    <div class="p-6 grid gap-5" style="grid-template-columns: 1fr 300px">
      <div class="card p-4 min-h-[420px] flex items-center justify-center">
        <EmptyState v-if="!image" icon="image" title="尚未导入原稿" description="上传 PS 设计稿，或从右侧测试原稿中选择一张" />
        <div v-else class="w-full flex flex-col items-center gap-3">
          <div class="relative max-w-full">
            <img
              :src="showFlow && flowUrl ? flowUrl : image.dataUrl"
              class="max-w-full max-h-[62vh] rounded-md border"
              style="border-color: var(--c-border)"
              alt="原稿"
            />
          </div>
          <div class="flex gap-2">
            <button class="btn" :disabled="!flowUrl" :class="showFlow ? 'btn-primary' : ''" @click="showFlow = true">
              引导线视图
            </button>
            <button class="btn" :class="!showFlow ? 'btn-primary' : ''" @click="showFlow = false">原稿视图</button>
            <button class="btn btn-primary" :disabled="analyzing" @click="analyze">
              <Icon name="play" :size="15" /> {{ analyzing ? '分析中…' : flowUrl ? '重新分析走向' : '生成引导线' }}
            </button>
          </div>
          <p class="text-xs muted">
            蓝线为结构张量提取的主体走向；线条越长代表局部连贯度越高，排块时这些位置的玻璃块会顺着走向偏转，
            适合人脸轮廓与衣褶区域
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <div class="card p-4">
          <h3 class="font-semibold mb-3">导入原稿</h3>
          <label class="btn btn-primary w-full cursor-pointer">
            <Icon name="upload" :size="16" /> 选择图片文件
            <input type="file" accept="image/*" class="hidden" @change="onUpload" />
          </label>
          <p class="text-xs muted mt-2">支持 JPG / PNG，内部会降采样到 512px 工作分辨率</p>
        </div>
        <div class="card p-4">
          <h3 class="font-semibold mb-3">测试原稿库</h3>
          <div class="flex flex-col gap-3">
            <button
              v-for="img in allImages"
              :key="img.id"
              class="flex gap-3 items-center text-left p-2 rounded-md border transition-all hover:shadow-sm"
              :style="{ borderColor: project?.sourceImageId === img.id ? 'var(--color-primary)' : 'var(--c-border)' }"
              @click="bindExisting(img)"
            >
              <img :src="img.dataUrl" class="w-12 h-16 object-cover rounded-sm" alt="" />
              <span class="text-sm">{{ img.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
