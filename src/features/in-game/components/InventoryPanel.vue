<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Character, InventoryItem } from '@/types/character'
import { GEAR_CATALOG, GEAR_CATEGORIES, findGearTemplate } from '@/data/gear'

const props = defineProps<{ char: Character }>()
const emit = defineEmits<{ patch: [Partial<Character>] }>()

const showCatalog = ref(false)
const openCat = ref<string | null>('weapon')
const customName = ref('')
const customPrice = ref(0)
const pendingTemplateId = ref<string | null>(null)

const pendingTemplate = computed(() =>
  pendingTemplateId.value ? findGearTemplate(pendingTemplateId.value) ?? null : null
)

function setCoins(value: number) {
  emit('patch', { coins: Math.max(0, value) })
}

function addFromCatalog(templateId: string) {
  const tpl = findGearTemplate(templateId)
  if (!tpl) return
  const price = tpl.price ?? 0
  if (price > props.char.coins) {
    pendingTemplateId.value = templateId
    return
  }
  commitPurchase(tpl, true)
}

function commitPurchase(tpl: NonNullable<ReturnType<typeof findGearTemplate>>, deductCoins: boolean) {
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    name: tpl.name,
    price: tpl.price,
    tags: [...tpl.tags],
    damage: tpl.damage,
    notes: tpl.notes,
  }
  emit('patch', {
    inventory: [...props.char.inventory, item],
    ...(deductCoins ? { coins: Math.max(0, props.char.coins - (tpl.price ?? 0)) } : {}),
  })
  pendingTemplateId.value = null
}

function cancelPending() {
  pendingTemplateId.value = null
}

function gmApproved() {
  if (!pendingTemplate.value) return
  commitPurchase(pendingTemplate.value, false)
}

function removeItem(id: string) {
  emit('patch', { inventory: props.char.inventory.filter(i => i.id !== id) })
}

function toggleEquipped(id: string) {
  emit('patch', {
    inventory: props.char.inventory.map(i =>
      i.id === id ? { ...i, equipped: !i.equipped } : i
    ),
  })
}

const sortedInventory = computed(() => {
  const equipped = props.char.inventory.filter(i => i.equipped)
  const rest = props.char.inventory.filter(i => !i.equipped)
  return [...equipped, ...rest]
})

const multipleWeaponsEquipped = computed(() =>
  props.char.inventory.filter(i => i.equipped && i.tags.includes('weapon')).length > 1
)

function addCustom() {
  if (!customName.value.trim()) return
  const item: InventoryItem = {
    id: crypto.randomUUID(),
    name: customName.value.trim(),
    price: customPrice.value || undefined,
    tags: ['custom'],
  }
  emit('patch', { inventory: [...props.char.inventory, item] })
  customName.value = ''
  customPrice.value = 0
}

const itemsByCategory = computed(() => {
  const out: Record<string, typeof GEAR_CATALOG> = {}
  for (const cat of GEAR_CATEGORIES) out[cat.id] = []
  for (const item of GEAR_CATALOG) {
    const cat = item.tags.find(t => (GEAR_CATEGORIES as readonly { id: string }[]).some(c => c.id === t)) ?? 'gear'
    out[cat].push(item)
  }
  return out
})
</script>

<template>
  <section class="panel">
    <div class="coins-row">
      <span class="label">Монеты</span>
      <input
        type="number"
        class="coins-input"
        :value="char.coins"
        min="0"
        @change="setCoins(Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="list">
      <div class="label">Инвентарь</div>
      <div v-if="multipleWeaponsEquipped" class="warn">⚠ Экипировано несколько видов оружия</div>
      <div v-for="item in sortedInventory" :key="item.id" class="inv-row" :class="{ 'inv-row--equipped': item.equipped }">
        <button
          class="equip-btn"
          :class="{ 'equip-btn--on': item.equipped }"
          type="button"
          :title="item.equipped ? 'Снять' : 'Экипировать'"
          @click="toggleEquipped(item.id)"
        >⚔</button>
        <div class="inv-row__info">
          <div class="inv-row__name">{{ item.name }}</div>
          <div v-if="item.notes" class="inv-row__notes">{{ item.notes }}</div>
        </div>
        <div class="inv-row__right">
          <span v-if="item.damage" class="tag">{{ item.damage }}</span>
          <span v-if="item.price" class="tag">{{ item.price }}с</span>
          <button class="btn-mini" @click="removeItem(item.id)">×</button>
        </div>
      </div>
      <div v-if="!char.inventory.length" class="empty">Пусто.</div>
    </div>

    <div class="custom">
      <div class="label">Добавить свой</div>
      <div class="custom__row">
        <input class="input" placeholder="Название" v-model="customName" />
        <input class="input input--price" type="number" min="0" placeholder="Цена" v-model.number="customPrice" />
        <button class="btn-ghost" :disabled="!customName.trim()" @click="addCustom">+</button>
      </div>
    </div>

    <div v-if="pendingTemplate" class="gm-dialog">
      <div class="gm-dialog__text">
        Не хватает монет на <b>{{ pendingTemplate.name }}</b> ({{ pendingTemplate.price }}с, у вас {{ char.coins }}с). Обговорите с ГМ.
      </div>
      <div class="gm-dialog__actions">
        <button class="btn-ghost" @click="cancelPending">Обсудить с ГМ</button>
        <button class="btn-primary" @click="gmApproved">ГМ одобрил</button>
      </div>
    </div>

    <button class="btn-ghost catalog-toggle" @click="showCatalog = !showCatalog">
      {{ showCatalog ? 'Скрыть каталог' : 'Купить из каталога' }}
    </button>

    <div v-if="showCatalog" class="catalog">
      <div v-for="cat in GEAR_CATEGORIES" :key="cat.id" class="cat">
        <button class="cat__head" @click="openCat = openCat === cat.id ? null : cat.id">
          <span>{{ cat.name }}</span>
          <span>{{ openCat === cat.id ? '▾' : '▸' }}</span>
        </button>
        <div v-if="openCat === cat.id">
          <button
            v-for="item in itemsByCategory[cat.id]"
            :key="item.templateId"
            class="gear-item"
            @click="addFromCatalog(item.templateId)"
          >
            <div class="gear-item__name">{{ item.name }}</div>
            <div class="gear-item__meta">
              <span>{{ item.price }}с</span>
              <span v-if="item.damage">· {{ item.damage }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel { padding: 12px 16px; display: flex; flex-direction: column; gap: 14px; }
.coins-row { display: flex; justify-content: space-between; align-items: center; }
.coins-input { width: 100px; text-align: right; padding: 6px 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); border-radius: 3px; font-family: inherit; }
.list { display: flex; flex-direction: column; gap: 4px; }
.warn { font-size: 12px; color: var(--color-accent); padding: 6px 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-accent); border-radius: 3px; }
.inv-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: 3px; }
.inv-row--equipped { border-color: var(--color-accent); }
.inv-row__info { flex: 1; min-width: 0; }
.inv-row__name { font-weight: 600; }
.inv-row__notes { font-size: 11px; color: var(--color-text-muted); }
.inv-row__right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.equip-btn { background: none; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 14px; padding: 0 2px; flex-shrink: 0; }
.equip-btn--on { color: var(--color-accent); }
.tag { font-size: 11px; color: var(--color-text-muted); }
.btn-mini { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 16px; }
.custom__row { display: grid; grid-template-columns: 1fr 90px auto; gap: 6px; }
.input { padding: 8px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); color: var(--color-text); border-radius: 3px; font-family: inherit; }
.catalog { display: flex; flex-direction: column; gap: 6px; }
.cat { border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; }
.cat__head { width: 100%; display: flex; justify-content: space-between; padding: 8px 12px; background: var(--color-bg-elevated); border: none; color: var(--color-text); cursor: pointer; font-family: inherit; }
.gear-item { text-align: left; padding: 8px 12px; background: var(--color-bg-dark); border: none; border-top: 1px solid var(--color-border); color: var(--color-text); cursor: pointer; font-family: inherit; width: 100%; }
.gear-item__name { font-weight: 600; }
.gear-item__meta { font-size: 11px; color: var(--color-text-muted); }
.empty { color: var(--color-text-muted); font-size: 13px; }
.catalog-toggle { align-self: flex-start; }
.gm-dialog { background: var(--color-bg-elevated); border: 1px solid var(--color-accent); border-radius: 4px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.gm-dialog__text { font-size: 13px; }
.gm-dialog__actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
