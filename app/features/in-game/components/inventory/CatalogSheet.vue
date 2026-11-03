<script setup lang="ts">
import { computed, ref } from 'vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SearchField from '@/components/ui/SearchField.vue'
import SegmentedFilter from '@/components/ui/SegmentedFilter.vue'
import { GEAR_CATEGORY_IDS, GEAR_CATALOG, type GearTemplate } from '@/data/gear'
import { isConsumable } from '@/domain/inventory'
import ItemIcon from './ItemIcon.vue'
import ItemStatChip from './ItemStatChip.vue'
import { t } from '@/locales'
import { gearName, gearNotes, gearCategoryName } from '@/locales/content'

const props = defineProps<{ coins: number }>()
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

function onBuyClick(tpl: GearTemplate) {
  const price = tpl.price ?? 0
  if (price > props.coins) emit('request-gm', tpl.templateId)
  else emit('buy', tpl.templateId)
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('inGame.inventory.catalog.title')" :max-width="560">
    <template #head-right>
      <span class="catalog-coins">{{ coins }} {{ t('inGame.inventory.coinsUnit') }}</span>
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

    <EmptyState v-if="!filtered.length" :title="t('inGame.inventory.catalog.empty')" />
    <div v-else>
      <div v-for="tpl in filtered" :key="tpl.templateId" class="cat-item">
        <ItemIcon
          :kind="tpl.descriptor.kind"
          :consumable="isConsumable(tpl)"
        />
        <div class="cat-item-body">
          <div class="cat-item-name">{{ gearName(tpl.templateId) }}</div>
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
          :class="['cat-buy', { 'is-locked': (tpl.price ?? 0) > coins }]"
          @click="onBuyClick(tpl)"
        >
          {{ (tpl.price ?? 0) > coins ? t('inGame.inventory.catalog.ask') : t('inGame.inventory.buy') }}
        </button>
      </div>
    </div>
  </BottomSheet>
</template>

<style scoped>
.catalog-coins {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-accent);
}

/* Pinned under the sheet's head while the list scrolls; the negative offsets cancel the body's top padding. */
.catalog-search {
  position: sticky;
  top: -14px;
  background: rgba(26, 21, 16, 0.96);
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
}
.cat-item:last-child { border-bottom: none; }
.cat-item-body { min-width: 0; }
.cat-item-name {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--vtt-accent-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
}
.cat-buy:hover { border-color: var(--vtt-border-gold); color: var(--vtt-accent); }
.cat-buy.is-locked {
  color: var(--vtt-warning);
  border-color: var(--vtt-border-subtle);
}
.cat-buy.is-locked:hover {
  border-color: var(--vtt-warning);
  color: var(--vtt-warning);
}
</style>
