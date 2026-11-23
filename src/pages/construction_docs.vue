<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/app_icon.vue'
import { selectProject, session } from '@/store/session'
import { buildBill, codeOf, printSheets, renderSheets, type MaterialBill, type SheetCell } from '@/core/construction'

const route = useRoute()
const router = useRouter()
const projectId = route.params.id as string

const sheets = ref<SheetCell[]>([])
const bill = ref<MaterialBill[]>([])
const pxPerMeter = ref(220)
const error = ref('')

const categoryLabel: Record<string, string> = {
  glass: '玻璃',
  gold: '金箔',
  stone: '石头',
}

const totalShortage = computed(() => bill.value.reduce((s, b) => s + b.shortage, 0))

function rebuild() {
  if (!session.currentProject || !session.currentTiles) return
  sheets.value = renderSheets(session.currentProject.wall, session.currentTiles, pxPerMeter.value)
  bill.value = buildBill(session.currentTiles, session.materials, session.currentProject.wall)
}

function doPrint() {
  if (!session.currentProject || sheets.value.length === 0) return
  printSheets(sheets.value, session.currentProject.name)
}

onMounted(async () => {
  await selectProject(projectId)
  if (!session.currentTiles || session.currentTiles.count === 0) {
    error.value = '还没有排块数据，请先生成排块'
    return
  }
  rebuild()
})
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <button class="btn" @click="router.push(`/projects/${projectId}/preview`)">
          <AppIcon name="back" :size="16" />预览
        </button>
        <div>
          <h1 class="title">施工图与材料清单</h1>
          <p class="subtitle">按每平方米分格出图，块体标注颜色编号；清单按材料汇总用量并核对库存</p>
        </div>
      </div>
      <div class="head-actions">
        <label class="btn">
          出图精度
          <select :value="pxPerMeter" @change="pxPerMeter = Number(($event.target as HTMLSelectElement).value); rebuild()">
            <option :value="160">标准</option>
            <option :value="220">精细</option>
            <option :value="320">印刷级</option>
          </select>
        </label>
        <button class="btn btn-primary" :disabled="!sheets.length" @click="doPrint">
          <AppIcon name="doc" :size="16" />打印 / 存 PDF
        </button>
      </div>
    </header>

    <div v-if="error" class="card empty-state">
      <div class="icon-card"><AppIcon name="warn" :size="32" /></div>
      <div style="color: var(--text)">{{ error }}</div>
      <button class="btn btn-primary" @click="router.push(`/projects/${projectId}/layout`)">去排块</button>
    </div>

    <template v-else>
      <section v-if="bill.length" class="card bill-card">
        <div class="bill-head">
          <h2 class="panel-title">材料清单</h2>
          <span v-if="totalShortage > 0" class="tag danger-tag">
            <AppIcon name="warn" :size="14" />总缺口 {{ totalShortage.toLocaleString() }} 块
          </span>
        </div>
        <table class="bill-table">
          <thead>
            <tr>
              <th>编号</th><th>色样</th><th>材料</th><th>类别</th>
              <th class="num">用量（块）</th><th class="num">折算面积 ㎡</th>
              <th class="num">库存</th><th class="num">缺口</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in bill" :key="b.materialId" :class="{ short: b.shortage > 0 }">
              <td><code>{{ codeOf(b.materialId) }}</code></td>
              <td><span class="color-chip" :style="{ background: `rgb(${b.color.join(',')})` }"></span></td>
              <td>{{ b.name }}</td>
              <td>{{ categoryLabel[b.category] }}</td>
              <td class="num">{{ b.count.toLocaleString() }}</td>
              <td class="num">{{ b.area.toFixed(2) }}</td>
              <td class="num">{{ b.stock.toLocaleString() }}</td>
              <td class="num">{{ b.shortage > 0 ? b.shortage.toLocaleString() : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="sheets-grid">
        <div v-for="(s, i) in sheets" :key="i" class="card sheet-card">
          <img :src="s.canvas.toDataURL('image/png')" :alt="`分格 ${s.row}-${s.col}`" />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: var(--sp-6);
  max-width: 1320px;
  margin: 0 auto;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--sp-5);
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.head-left {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}
.title {
  font-size: var(--fs-2xl);
}
.subtitle {
  color: var(--text-muted);
  font-size: var(--fs-sm);
  margin: var(--sp-1) 0 0;
}
.head-actions {
  display: flex;
  gap: var(--sp-3);
}
.bill-card {
  padding: var(--sp-5);
  margin-bottom: var(--sp-5);
  overflow-x: auto;
}
.bill-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--sp-4);
}
.panel-title {
  font-size: var(--fs-lg);
}
.danger-tag {
  background: rgba(224, 85, 99, 0.14);
  color: var(--danger);
  border-color: rgba(224, 85, 99, 0.4);
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
}
.bill-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-xs);
  min-width: 760px;
}
.bill-table th {
  text-align: left;
  color: var(--text-muted);
  font-weight: var(--fw-medium);
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border);
}
.bill-table td {
  padding: var(--sp-3);
  border-bottom: 1px solid var(--border);
}
.bill-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.bill-table tr.short td {
  color: var(--danger);
}
.color-chip {
  display: inline-block;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.sheets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--sp-4);
}
.sheet-card {
  padding: var(--sp-3);
}
.sheet-card img {
  width: 100%;
  display: block;
  border-radius: var(--radius-sm);
}
</style>
