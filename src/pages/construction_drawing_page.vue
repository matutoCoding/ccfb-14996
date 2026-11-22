<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/page_header.vue'
import Icon from '@/components/icon.vue'
import EmptyState from '@/components/empty_state.vue'
import PrintSheet from '@/components/print_sheet.vue'
import { materialRepo, projectRepo, versionRepo } from '@/data/repos'
import { buildBom, drawSheet, sheetCells, type BomRow } from '@/render/drawing'
import type { Material, Project, TileVersion } from '@/core/types'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id as string

const project = shallowRef<Project | null>(null)
const version = shallowRef<TileVersion | null>(null)
const materials = ref<Material[]>([])
const buffer = shallowRef<ArrayBuffer | null>(null)
const bom = ref<BomRow[]>([])
const showCode = ref(true)
const pxPerM = ref(420)
const activeCell = ref(0)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const cells = computed(() => (project.value ? sheetCells(project.value.wall) : []))
const kindLabel: Record<string, string> = { glass: '玻璃', gold: '金箔', stone: '石材' }

async function load(): Promise<void> {
  project.value = (await projectRepo.get(projectId)) ?? null
  materials.value = await materialRepo.list()
  if (project.value?.currentVersionId) {
    version.value = (await versionRepo.get(project.value.currentVersionId)) ?? null
    if (version.value) {
      buffer.value = await versionRepo.loadBuffer(version.value.id)
      if (buffer.value) {
        bom.value = buildBom(buffer.value, version.value.stats.count, version.value, materials.value)
      }
    }
  }
  await renderSheet()
}

async function renderSheet(): Promise<void> {
  await new Promise((r) => setTimeout(r, 20))
  const canvas = canvasRef.value
  if (!canvas || !buffer.value || !version.value || !project.value || !cells.value[activeCell.value]) return
  canvas.width = pxPerM.value
  canvas.height = pxPerM.value
  const ctx = canvas.getContext('2d')!
  drawSheet(
    ctx,
    buffer.value,
    version.value.stats.count,
    version.value,
    materials.value,
    project.value.wall,
    cells.value[activeCell.value],
    pxPerM.value,
    showCode.value,
  )
}

function printAll(): void {
  window.print()
}

watch([activeCell, showCode, pxPerM], renderSheet)
onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="施工图与材料清单" subtitle="按每平方米分格出图，每块标注颜色编号，可直接打印交付施工">
      <button class="btn no-print" @click="router.push(`/projects/${projectId}/preview`)">
        <Icon name="wall" :size="15" /> 墙面预览
      </button>
      <button v-if="version" class="btn btn-primary no-print" @click="printAll"><Icon name="print" :size="15" /> 打印全部</button>
    </PageHeader>

    <div v-if="!version" class="p-6">
      <EmptyState icon="print" title="还没有排块版本" description="先到排块编辑生成一版，施工图会自动出图" />
    </div>

    <div v-else class="p-6 grid gap-5" style="grid-template-columns: 1fr 360px">
      <div class="flex flex-col gap-4 no-print">
        <div class="card p-4 flex items-center gap-4 flex-wrap">
          <label class="flex items-center gap-2 text-sm">
            分格
            <select v-model.number="activeCell" class="input !w-32">
              <option v-for="(c, i) in cells" :key="i" :value="i">X{{ c.col + 1 }} / Y{{ c.row + 1 }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="showCode" type="checkbox" /> 显示颜色编号
          </label>
          <label class="flex items-center gap-2 text-sm">
            出图精度
            <select v-model.number="pxPerM" class="input !w-28">
              <option :value="300">标准</option>
              <option :value="420">精细</option>
              <option :value="600">印刷级</option>
            </select>
          </label>
          <span class="text-sm muted">共 {{ cells.length }} 张分格图，每张 1㎡</span>
        </div>
        <div class="card p-4 flex justify-center" style="background: var(--c-surface-2)">
          <canvas ref="canvasRef" class="max-w-full border shadow" style="border-color: var(--c-border)" />
        </div>
      </div>

      <div class="card p-4 h-fit no-print">
        <h3 class="font-semibold mb-3">材料清单（按颜色汇总）</h3>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left muted">
              <th class="py-2 font-medium">编号</th>
              <th class="font-medium">分类</th>
              <th class="font-medium text-right">用量</th>
              <th class="font-medium text-right">面积㎡</th>
              <th class="font-medium text-right">库存差</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in bom" :key="row.material.id" class="border-t" style="border-color: var(--c-border)">
              <td class="py-2">
                <span class="inline-flex items-center gap-2">
                  <span class="w-4 h-4 rounded-sm border" :style="{ background: `rgb(${row.material.rgb.join(',')})` }" />
                  {{ row.material.code }}
                </span>
              </td>
              <td class="muted">{{ kindLabel[row.material.kind] }}</td>
              <td class="text-right">{{ row.count.toLocaleString() }}</td>
              <td class="text-right">{{ row.area.toFixed(2) }}</td>
              <td
                class="text-right font-medium"
                :style="row.stockDelta < 0 ? 'color: var(--color-danger)' : 'color: var(--c-text-2)'"
              >
                {{ row.stockDelta >= 0 ? '+' : '' }}{{ row.stockDelta.toLocaleString() }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t font-semibold" style="border-color: var(--c-border)">
              <td class="py-2" colspan="2">合计</td>
              <td class="text-right">{{ bom.reduce((s, r) => s + r.count, 0).toLocaleString() }}</td>
              <td class="text-right">{{ bom.reduce((s, r) => s + r.area, 0).toFixed(2) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <div id="print-area" class="hidden print:block">
      <PrintSheet
        v-for="(c, i) in cells"
        :key="i"
        :buffer="buffer!"
        :count="version?.stats.count ?? 0"
        :version="version!"
        :materials="materials"
        :wall="project!.wall"
        :cell="c"
        :project-name="project?.name ?? ''"
      />
    </div>
  </div>
</template>
