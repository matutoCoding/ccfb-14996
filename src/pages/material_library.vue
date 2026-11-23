<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import AppIcon from '@/components/app_icon.vue'
import { materialRepo } from '@/core/db'
import { refreshMaterials, session } from '@/store/session'
import type { Material, MaterialCategory } from '@/core/types'

const categoryLabel: Record<MaterialCategory, string> = {
  glass: '玻璃块',
  gold: '金箔块',
  stone: '石头',
}
const filters: (MaterialCategory | 'all')[] = ['all', 'glass', 'gold', 'stone']
const activeFilter = ref<MaterialCategory | 'all'>('all')
const showEditor = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  name: '',
  category: 'glass' as MaterialCategory,
  color: '#c08840',
  opacity: 0.9,
  roughness: 0.25,
  reflectivity: 0.7,
  stock: 1000,
})

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHex(c: [number, number, number]): string {
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    name: '',
    category: 'glass',
    color: '#c08840',
    opacity: 0.9,
    roughness: 0.25,
    reflectivity: 0.7,
    stock: 1000,
  })
  showEditor.value = true
}

function openEdit(m: Material) {
  editingId.value = m.id
  Object.assign(form, {
    name: m.name,
    category: m.category,
    color: rgbToHex(m.color),
    opacity: m.opacity,
    roughness: m.roughness,
    reflectivity: m.reflectivity,
    stock: m.stock,
  })
  showEditor.value = true
}

async function save() {
  const id = editingId.value ?? `mat-${Date.now().toString(36)}`
  const material: Material = {
    id,
    name: form.name || '未命名材料',
    category: form.category,
    color: hexToRgb(form.color),
    opacity: form.opacity,
    roughness: form.roughness,
    reflectivity: form.reflectivity,
    stock: form.stock,
  }
  await materialRepo.save(material)
  await refreshMaterials()
  showEditor.value = false
}

async function remove(m: Material) {
  if (!window.confirm(`删除材料「${m.name}」？已有排块的引用会保留颜色但失去参数。`)) return
  await materialRepo.remove(m.id)
  await refreshMaterials()
}

const list = () =>
  activeFilter.value === 'all'
    ? session.materials
    : session.materials.filter((m) => m.category === activeFilter.value)

const totalStock = () => session.materials.reduce((s, m) => s + m.stock, 0)

onMounted(refreshMaterials)
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="title">材料库</h1>
        <p class="subtitle">意大利手工熔制玻璃、金箔与石材的光学参数与库存，全部本地 IndexedDB 存储</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        <AppIcon name="plus" :size="16" />录入材料
      </button>
    </header>

    <div class="filter-row">
      <button
        v-for="f in filters"
        :key="f"
        class="btn"
        :class="{ active: activeFilter === f }"
        @click="activeFilter = f"
      >
        {{ f === 'all' ? `全部（${session.materials.length}）` : `${categoryLabel[f]}（${session.materials.filter((m) => m.category === f).length}）` }}
      </button>
      <div class="stock-summary">库存总量 <strong>{{ totalStock().toLocaleString() }}</strong> 块</div>
    </div>

    <div v-if="list().length === 0" class="card empty-state">
      <div class="icon-card"><AppIcon name="gem" :size="32" /></div>
      <div>该分类下还没有材料，点击右上角录入</div>
    </div>

    <div v-else class="grid">
      <article v-for="m in list()" :key="m.id" class="card material-card">
        <div class="swatch" :style="{ background: `rgb(${m.color.join(',')})` }">
          <span class="cat-tag">{{ categoryLabel[m.category] }}</span>
        </div>
        <div class="body">
          <div class="name-row">
            <h2 class="name">{{ m.name }}</h2>
            <code class="code">C{{ m.id.replace(/\D/g, '') }}</code>
          </div>
          <div class="stock-row" :class="{ low: m.stock < 1000 }">
            库存 <strong>{{ m.stock.toLocaleString() }}</strong> 块
          </div>
          <dl class="params">
            <div><dt>透明度</dt><dd>{{ m.opacity.toFixed(2) }}</dd></div>
            <div><dt>表面起伏</dt><dd>{{ m.roughness.toFixed(2) }}</dd></div>
            <div><dt>反光强度</dt><dd>{{ m.reflectivity.toFixed(2) }}</dd></div>
          </dl>
          <div class="actions">
            <button class="btn" @click="openEdit(m)"><AppIcon name="edit" :size="15" />编辑</button>
            <button class="btn btn-danger" @click="remove(m)"><AppIcon name="trash" :size="15" />删除</button>
          </div>
        </div>
      </article>
    </div>

    <div v-if="showEditor" class="modal-mask" @click.self="showEditor = false">
      <div class="card modal">
        <h2 class="modal-title">{{ editingId ? '编辑材料' : '录入新材料' }}</h2>
        <div class="form-grid">
          <div>
            <label class="label">名称</label>
            <input v-model="form.name" class="input" placeholder="例如：穆拉诺湖蓝" />
          </div>
          <div>
            <label class="label">分类</label>
            <select v-model="form.category" class="input">
              <option value="glass">玻璃块</option>
              <option value="gold">金箔块</option>
              <option value="stone">石头</option>
            </select>
          </div>
          <div>
            <label class="label">基色</label>
            <input v-model="form.color" type="color" class="input color-input" />
          </div>
          <div>
            <label class="label">库存数量（块）</label>
            <input v-model.number="form.stock" type="number" min="0" step="100" class="input" />
          </div>
          <div>
            <label class="label">透明度（{{ form.opacity.toFixed(2) }}）</label>
            <input v-model.number="form.opacity" type="range" min="0.1" max="1" step="0.01" class="input" />
          </div>
          <div>
            <label class="label">表面起伏（{{ form.roughness.toFixed(2) }}）</label>
            <input v-model.number="form.roughness" type="range" min="0" max="1" step="0.01" class="input" />
          </div>
          <div class="span-2">
            <label class="label">反光强度（{{ form.reflectivity.toFixed(2) }}）</label>
            <input v-model.number="form.reflectivity" type="range" min="0" max="1" step="0.01" class="input" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showEditor = false">取消</button>
          <button class="btn btn-primary" @click="save"><AppIcon name="check" :size="16" />保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: var(--sp-6);
  max-width: 1280px;
  margin: 0 auto;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--sp-5);
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
.filter-row {
  display: flex;
  gap: var(--sp-2);
  margin-bottom: var(--sp-5);
  align-items: center;
  flex-wrap: wrap;
}
.btn.active {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-weak);
}
.stock-summary {
  margin-left: auto;
  font-size: var(--fs-xs);
  color: var(--text-muted);
}
.stock-summary strong {
  color: var(--primary);
  font-size: var(--fs-base);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--sp-4);
}
.material-card {
  overflow: hidden;
}
.swatch {
  height: 96px;
  position: relative;
}
.cat-tag {
  position: absolute;
  left: var(--sp-3);
  bottom: var(--sp-2);
  background: rgba(10, 14, 22, 0.72);
  color: #fff;
  font-size: 12px;
  padding: 2px var(--sp-2);
  border-radius: 999px;
}
.body {
  padding: var(--sp-4);
}
.name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.name {
  font-size: var(--fs-base);
}
.code {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--surface-2);
  padding: 2px var(--sp-2);
  border-radius: var(--radius-sm);
}
.stock-row {
  font-size: var(--fs-xs);
  color: var(--text-muted);
  margin: var(--sp-2) 0;
}
.stock-row strong {
  color: var(--text);
}
.stock-row.low strong {
  color: var(--danger);
}
.params {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 0 0 var(--sp-3);
  gap: var(--sp-2);
}
.params div {
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: var(--sp-2);
  text-align: center;
}
.params dt {
  font-size: 12px;
  color: var(--text-muted);
}
.params dd {
  margin: 0;
  font-size: var(--fs-xs);
  font-weight: var(--fw-medium);
}
.actions {
  display: flex;
  gap: var(--sp-2);
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(4, 8, 16, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: var(--sp-5);
}
.modal {
  width: min(640px, 100%);
  padding: var(--sp-6);
  box-shadow: var(--shadow-lg);
}
.modal-title {
  font-size: var(--fs-xl);
  margin-bottom: var(--sp-5);
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
}
.span-2 {
  grid-column: span 2;
}
.color-input {
  height: 44px;
  padding: var(--sp-1);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
  margin-top: var(--sp-6);
}
</style>
