<script setup lang="ts">
import { computed, ref } from 'vue'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogClose } from 'reka-ui'
import IconClose from '@/components/ui/icons/IconClose.vue'
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
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="bs-overlay" />
      <DialogContent class="bs-content-wrap">
        <div class="bottom-sheet catalog-sheet">
          <div class="bs-head">
            <span class="bs-title">{{ t('inGame.inventory.catalog.title') }}</span>
            <div class="bs-head-right">
              <span class="bs-coins">{{ coins }} {{ t('inGame.inventory.coinsUnit') }}</span>
              <DialogClose class="bs-close" :aria-label="t('common.close')">
                <IconClose />
              </DialogClose>
            </div>
          </div>
          <div class="bs-body">
            <div class="catalog-search">
              <input
                class="catalog-search-input"
                type="text"
                :placeholder="t('inGame.inventory.catalog.search')"
                v-model="search"
              />
              <SegmentedFilter v-model="activeCat" :options="segments" class="catalog-segments" />
            </div>

            <div v-if="!filtered.length" class="catalog-empty">
              {{ t('inGame.inventory.catalog.empty') }}
            </div>
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
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.catalog-sheet {
  width: 100%;
  max-width: 560px;
}
.bs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  flex-shrink: 0;
}
.bs-title {
  font-family: var(--font-serif);
  font-size: 17px;
  color: var(--vtt-accent-soft);
}
.bs-head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bs-coins {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-accent);
}
.bs-close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-pill);
  color: var(--vtt-text-secondary);
  cursor: pointer;
  padding: 0;
}
.bs-close :deep(svg) { width: 12px; height: 12px; }
.bs-close:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
}

.bs-body {
  padding: 0 18px 18px;
  max-height: 70vh;
  overflow-y: auto;
  flex: 1;
}

.catalog-search {
  position: sticky;
  top: 0;
  background: rgba(26, 21, 16, 0.96);
  backdrop-filter: blur(10px);
  padding: 14px 0 12px;
  margin-bottom: 8px;
  z-index: 2;
}
.catalog-search-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--vtt-bg-sunken);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  outline: none;
}
.catalog-search-input::placeholder { color: var(--vtt-text-muted); }
.catalog-search-input:focus {
  border-color: var(--vtt-border-gold);
  box-shadow: 0 0 0 2px rgba(140, 106, 58, 0.15);
}
.catalog-segments { margin-top: 8px; }

.catalog-empty {
  padding: 22px 14px;
  text-align: center;
  color: var(--vtt-text-muted);
  font-size: 13px;
  font-style: italic;
  border: 1px dashed var(--vtt-border-subtle);
  border-radius: var(--r-sm);
}

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
