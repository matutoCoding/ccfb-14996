<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/page_header.vue'
import Icon from '@/components/icon.vue'
import EmptyState from '@/components/empty_state.vue'
import { materialRepo } from '@/data/repos'
import type { Material, MaterialKind } from '@/core/types'
import { uid } from '@/core/rng'

const materials = ref<Material[]>([])
const filter = ref<MaterialKind | 'all'>('all')
const showEdit = ref(false)
const editing = ref<Material | null>(null)

const kindLabel: Record<MaterialKind, string> = { glass: '手工玻璃', gold: '金箔块', stone: '天然石材' }
const filters: { value: MaterialKind | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'glass', label: '手工玻璃' },
  { value: 'gold', label: '金箔块' },
  { value: 'stone', label: '天然石材' },
]

const blank = (): Material => ({
  id: uid('mat'),
  code: '',
  name: '',
  kind: 'glass',
  rgb: [180, 180, 180],
  opacity: 0.9,
  roughness: 0.35,
  reflectivity: 0.55,
  stock: 0,
})

const form = ref<Material>(blank())
const colorText = computed(() => '#' + form.value.rgb.map((v) => v.toString(16).padStart(2, '0')).join(''))

function onColor(e: Event): void {
  const hex = (e.target as HTMLInputElement).value
  form.value.rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function openCreate(): void {
  editing.value = null
  form.value = blank()
  showEdit.value = true
}

function openEdit(m: Material): void {
  editing.value = m
  form.value = { ...m, rgb: [...m.rgb] as [number, number, number] }
  showEdit.value = true
}

async function save(): Promise<void> {
  if (!form.value.code.trim() || !form.value.name.trim()) return
  await materialRepo.save({ ...form.value })
  showEdit.value = false
  await refresh()
}

async function remove(m: Material): Promise<void> {
  if (!window.confirm(`删除材料「${m.name}」？已排块版本中引用它的地方会显示为缺料。`)) return
  await materialRepo.remove(m.id)
  await refresh()
}

async function refresh(): Promise<void> {
  materials.value = (await materialRepo.list()).sort((a, b) => a.code.localeCompare(b.code))
}

const shown = computed(() =>
  filter.value === 'all' ? materials.value : materials.value.filter((m) => m.kind === filter.value),
)
const totalStock = computed(() => materials.value.reduce((s, m) => s + m.stock, 0))

onMounted(refresh)
</script>

<template>
  <div>
    <PageHeader title="材料库" :subtitle="`共 ${materials.length} 种材料，库存合计 ${totalStock.toLocaleString()} 块`">
      <button class="btn btn-primary" @click="openCreate"><Icon name="plus" /> 新增材料</button>
    </PageHeader>

    <div class="px-6 pt-4 flex gap-2">
      <button
        v-for="f in filters"
        :key="f.value"
        class="btn !h-8"
        :class="filter === f.value ? 'btn-primary' : ''"
        @click="filter = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <div class="p-6">
      <EmptyState v-if="shown.length === 0" icon="material" title="该分类下没有材料" description="新增一种玻璃、金箔或石材" />
      <div v-else class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left" style="background: var(--c-surface-2); color: var(--c-text-2)">
              <th class="font-medium px-4 py-3">色样</th>
              <th class="font-medium px-4 py-3">编号</th>
              <th class="font-medium px-4 py-3">名称</th>
              <th class="font-medium px-4 py-3">分类</th>
              <th class="font-medium px-4 py-3">透明度</th>
              <th class="font-medium px-4 py-3">表面起伏</th>
              <th class="font-medium px-4 py-3">反光</th>
              <th class="font-medium px-4 py-3 text-right">库存（块）</th>
              <th class="font-medium px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in shown" :key="m.id" class="border-t" style="border-color: var(--c-border)">
              <td class="px-4 py-2.5">
                <span class="inline-block w-7 h-7 rounded-sm border" :style="{ background: `rgb(${m.rgb.join(',')})`, borderColor: 'var(--c-border)' }" />
              </td>
              <td class="px-4 py-2.5 font-medium">{{ m.code }}</td>
              <td class="px-4 py-2.5">{{ m.name }}</td>
              <td class="px-4 py-2.5 muted">{{ kindLabel[m.kind] }}</td>
              <td class="px-4 py-2.5">{{ m.opacity.toFixed(2) }}</td>
              <td class="px-4 py-2.5">{{ m.roughness.toFixed(2) }}</td>
              <td class="px-4 py-2.5">{{ m.reflectivity.toFixed(2) }}</td>
              <td class="px-4 py-2.5 text-right" :class="m.stock < 3000 ? 'font-medium' : ''" :style="m.stock < 3000 ? 'color: var(--color-warn)' : ''">
                {{ m.stock.toLocaleString() }}
              </td>
              <td class="px-4 py-2.5">
                <div class="flex gap-1 justify-end">
                  <button class="btn !h-8 !w-8 !p-0" @click="openEdit(m)"><Icon name="edit" :size="15" /></button>
                  <button class="btn btn-danger !h-8 !w-8 !p-0" @click="remove(m)"><Icon name="trash" :size="15" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showEdit" class="modal-mask" @click.self="showEdit = false">
      <div class="card w-[520px] max-w-[92vw] p-5">
        <h2 class="text-lg font-semibold mb-4">{{ editing ? '编辑材料' : '新增材料' }}</h2>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">颜色编号</label>
            <input v-model="form.code" class="input" placeholder="如 G-116" />
          </div>
          <div>
            <label class="label">名称</label>
            <input v-model="form.name" class="input" placeholder="如 湖蓝玻璃" />
          </div>
          <div>
            <label class="label">分类</label>
            <select v-model="form.kind" class="input">
              <option v-for="(label, key) in kindLabel" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div>
            <label class="label">颜色</label>
            <div class="flex items-center gap-2 h-9">
              <input type="color" :value="colorText" class="w-10 h-9 rounded border-0 bg-transparent" @input="onColor" />
              <span class="text-sm muted">{{ colorText.toUpperCase() }}</span>
            </div>
          </div>
          <div>
            <label class="label">透明度 {{ form.opacity.toFixed(2) }}</label>
            <input v-model.number="form.opacity" type="range" min="0.3" max="1" step="0.01" class="w-full" />
          </div>
          <div>
            <label class="label">表面起伏 {{ form.roughness.toFixed(2) }}</label>
            <input v-model.number="form.roughness" type="range" min="0" max="1" step="0.01" class="w-full" />
          </div>
          <div>
            <label class="label">反光强度 {{ form.reflectivity.toFixed(2) }}</label>
            <input v-model.number="form.reflectivity" type="range" min="0" max="1" step="0.01" class="w-full" />
          </div>
          <div>
            <label class="label">库存数量（块）</label>
            <input v-model.number="form.stock" type="number" min="0" step="100" class="input" />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button class="btn" @click="showEdit = false">取消</button>
          <button class="btn btn-primary" :disabled="!form.code.trim() || !form.name.trim()" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgb(15 23 42 / 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
</style>
