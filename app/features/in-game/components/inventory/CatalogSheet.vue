<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { VisuallyHidden } from 'reka-ui'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Pill from '@/components/ui/Pill.vue'
import SearchField from '@/components/ui/SearchField.vue'
import SegmentedFilter from '@/components/ui/SegmentedFilter.vue'
import IconBag from '@/components/ui/icons/IconBag.vue'
import IconCheck from '@/components/ui/icons/IconCheck.vue'
import { GEAR_CATEGORY_IDS, GEAR_CATALOG, type GearTemplate } from '@/data/gear'
import { isConsumable, ownedByTemplate } from '@/domain/inventory'
import type { InventoryItem } from '@/types/character'
import ItemIcon from './ItemIcon.vue'
import ItemStatChip from './ItemStatChip.vue'
import { t } from '@/locales'
import { gearName, gearNotes, gearCategoryName } from '@/locales/content'

const props = defineProps<{ coins: number; inventory: InventoryItem[] }>()
const emit = defineEmits<{
  (e: 'buy', templateId: string): void
  (e: 'request-gm', templateId: string): void
}>()
const open = defineModel<boolean>('open', { required: true })

const ALL = 'all'
const activeCat = ref<string>(ALL)
const search = ref('')

const segments = computed(() => [
  { value: ALL, label: t('inGame.inventory.catalog.all') },
  ...GEAR_CATEGORY_IDS.map(id => ({ value: id, label: gearCategoryName(id) })),
])

const filtered = computed<GearTemplate[]>(() => {
  const q = search.value.trim().toLowerCase()
  return GEAR_CATALOG
    .filter(it => activeCat.value === ALL || it.category === activeCat.value)
    .filter(it => {
      if (!q) return true
      const name = gearName(it.templateId).toLowerCase()
      const notes = (gearNotes(it.templateId) ?? '').toLowerCase()
      return name.includes(q) || notes.includes(q)
    })
    .slice()
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
})

function armorChip(tpl: GearTemplate): string | null {
  const d = tpl.descriptor
  if (d.kind === 'armor') {
    if (d.class === 'full') return t('inGame.inventory.armorBonus', { amount: 2 })
    if (d.class === 'light') return t('inGame.inventory.armorBonus', { amount: 1 })
  }
  if (d.kind === 'shield') return t('inGame.inventory.armorBonus', { amount: 1 })
  return null
}

// ── Purchase feedback ──
// The row and the coins answer to what actually changed, so an item that arrives through "Ask the GM" shows too.
const BOUGHT_MS = 900
const owned = computed(() => ownedByTemplate(props.inventory))
/** Per item, how many times it has arrived while the sheet is open: the key that replays its animations. */
const arrivals = ref<Record<string, number>>({})
const spent = ref<{ amount: number; n: number } | null>(null)
const boughtId = ref<string | null>(null)
const announcement = ref('')
let boughtTimer: ReturnType<typeof setTimeout> | undefined

watch(owned, (now, before) => {
  if (!open.value) return
  for (const [id, count] of Object.entries(now)) {
    if (count <= (before[id] ?? 0)) continue
    arrivals.value = { ...arrivals.value, [id]: (arrivals.value[id] ?? 0) + 1 }
    announcement.value = `${gearName(id)}. ${t('inGame.inventory.catalog.owned', { count })}`
  }
})

watch(() => props.coins, (now, before) => {
  if (open.value && now < before) spent.value = { amount: before - now, n: (spent.value?.n ?? 0) + 1 }
})

watch(open, (now) => {
  if (now) return
  clearTimeout(boughtTimer)
  arrivals.value = {}
  spent.value = null
  boughtId.value = null
  announcement.value = ''
})

onBeforeUnmount(() => clearTimeout(boughtTimer))

function onBuyClick(tpl: GearTemplate) {
  const price = tpl.price ?? 0
  if (price > props.coins) {
    emit('request-gm', tpl.templateId)
    return
  }
  emit('buy', tpl.templateId)
  boughtId.value = tpl.templateId
  clearTimeout(boughtTimer)
  boughtTimer = setTimeout(() => { boughtId.value = null }, BOUGHT_MS)
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('inGame.inventory.catalog.title')" :max-width="560">
    <template #head-right>
      <span class="catalog-coins">
        <span v-if="spent" :key="`spent-${spent.n}`" class="catalog-spent" aria-hidden="true">−{{ spent.amount }}</span>
        <span :key="spent?.n ?? 0" :class="['catalog-coins-value', { 'is-spent': spent }]">
          {{ coins }} {{ t('inGame.inventory.coinsUnit') }}
        </span>
      </span>
    </template>

    <div class="catalog-search">
      <SearchField
        v-model="search"
        size="sm"
        :label="t('inGame.inventory.catalog.search')"
        :placeholder="t('inGame.inventory.catalog.search')"
      />
      <SegmentedFilter v-model="activeCat" :options="segments" class="catalog-segments" />
    </div>

    <VisuallyHidden role="status">{{ announcement }}</VisuallyHidden>

    <EmptyState v-if="!filtered.length" :hint="t('inGame.inventory.catalog.empty')" />
    <div v-else>
      <div v-for="tpl in filtered" :key="tpl.templateId" class="cat-item">
        <span
          v-if="arrivals[tpl.templateId]"
          :key="`flash-${arrivals[tpl.templateId]}`"
          class="cat-item-flash"
          aria-hidden="true"
        />
        <span :key="arrivals[tpl.templateId] ?? 0" :class="['cat-item-icon', { 'is-arrived': arrivals[tpl.templateId] }]">
          <ItemIcon
            :kind="tpl.descriptor.kind"
            :consumable="isConsumable(tpl)"
          />
        </span>
        <div class="cat-item-body">
          <div class="cat-item-title">
            <span class="cat-item-name">{{ gearName(tpl.templateId) }}</span>
            <Pill
              v-if="owned[tpl.templateId]"
              :key="arrivals[tpl.templateId] ?? 0"
              tone="accent"
              size="sm"
              :class="['cat-item-owned', { 'is-arrived': arrivals[tpl.templateId] }]"
            >
              <span class="cat-item-owned-count" aria-hidden="true"><IconBag :size="11" />×{{ owned[tpl.templateId] }}</span>
              <VisuallyHidden>{{ t('inGame.inventory.catalog.owned', { count: owned[tpl.templateId] }) }}</VisuallyHidden>
            </Pill>
          </div>
          <div v-if="gearNotes(tpl.templateId)" class="cat-item-desc">{{ gearNotes(tpl.templateId) }}</div>
        </div>
        <div class="cat-item-stats">
          <ItemStatChip v-if="tpl.damage" variant="damage">{{ tpl.damage }}</ItemStatChip>
          <ItemStatChip v-if="armorChip(tpl)" variant="armor">{{ armorChip(tpl) }}</ItemStatChip>
          <ItemStatChip
            v-if="isConsumable(tpl)"
            variant="qty"
          >{{ t('inGame.inventory.catalog.consumableShort') }}</ItemStatChip>
          <ItemStatChip
            v-if="tpl.price !== undefined"
            variant="price"
            :class="{ 'is-warn': (tpl.price ?? 0) > coins }"
          >
            {{ tpl.price }} {{ t('inGame.inventory.coinsUnit') }}
          </ItemStatChip>
        </div>
        <button
          type="button"
          :class="['cat-buy', { 'is-locked': (tpl.price ?? 0) > coins, 'is-bought': boughtId === tpl.templateId }]"
          @click="onBuyClick(tpl)"
        >
          <span class="cat-buy-label">
            {{ (tpl.price ?? 0) > coins ? t('inGame.inventory.catalog.ask') : t('inGame.inventory.buy') }}
          </span>
          <IconCheck v-if="boughtId === tpl.templateId" class="cat-buy-check" :size="14" />
        </button>
      </div>
    </div>
  </BottomSheet>
</template>

<style scoped>
.catalog-coins {
  position: relative;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-accent);
}
.catalog-coins-value { display: inline-block; }
.catalog-coins-value.is-spent { animation: cat-pop 320ms var(--ease); }
/* The spent amount leaves the purse: it stays inside the head, clear of the title on the far side. */
.catalog-spent {
  position: absolute;
  right: 100%;
  top: 0;
  margin-right: 8px;
  color: var(--vtt-danger-bright);
  white-space: nowrap;
  pointer-events: none;
  animation: cat-spent 900ms ease-out forwards;
}

/* Pinned under the sheet's head while the list scrolls; the negative offsets cancel the body's top padding. */
.catalog-search {
  position: sticky;
  top: -14px;
  background: var(--vtt-surface-a96);
  backdrop-filter: blur(10px);
  margin-top: -14px;
  padding: 14px 0 12px;
  margin-bottom: 8px;
  z-index: 2;
}
.catalog-segments { margin-top: 8px; }

.cat-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--vtt-border-subtle);
  /* Keeps the flash behind the row's own text. */
  position: relative;
  isolation: isolate;
}
.cat-item:last-child { border-bottom: none; }
.cat-item-flash {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: var(--r-sm);
  pointer-events: none;
  animation: cat-flash 700ms ease-out forwards;
}
.cat-item-icon { display: inline-flex; }
.cat-item-icon.is-arrived,
.cat-item-owned.is-arrived { animation: cat-pop 320ms var(--ease); }
.cat-item-body { min-width: 0; }
.cat-item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.cat-item-name {
  min-width: 0;
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--vtt-accent-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-item-owned-count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.cat-item-desc {
  font-size: 11px;
  color: var(--vtt-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-item-stats {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.is-warn {
  color: var(--vtt-warning) !important;
  border-color: var(--vtt-warning) !important;
}
.cat-buy {
  padding: 6px 12px;
  background: var(--vtt-bg-elevated);
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-sm);
  color: var(--vtt-accent-soft);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
  flex-shrink: 0;
  /* The label keeps its place under the check mark, so the button neither changes width nor loses its name. */
  display: inline-grid;
  place-items: center;
}
.cat-buy-label,
.cat-buy-check { grid-area: 1 / 1; }
.cat-buy.is-bought,
.cat-buy.is-bought:hover {
  border-color: var(--vtt-success);
  color: var(--vtt-success);
}
.cat-buy.is-bought .cat-buy-label { opacity: 0; }
.cat-buy:hover { border-color: var(--vtt-border-gold); color: var(--vtt-accent); }
.cat-buy.is-locked {
  color: var(--vtt-warning);
  border-color: var(--vtt-border-subtle);
}
.cat-buy.is-locked:hover {
  border-color: var(--vtt-warning);
  color: var(--vtt-warning);
}

@keyframes cat-flash {
  from { background: var(--vtt-accent-a18); }
  to   { background: var(--vtt-accent-a00); }
}
@keyframes cat-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.25); }
  100% { transform: scale(1); }
}
@keyframes cat-spent {
  from { opacity: 1; transform: translateY(4px); }
  to   { opacity: 0; transform: translateY(-8px); }
}
</style>
