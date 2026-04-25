<script setup lang="ts">
import { computed } from 'vue'
import type { InventoryItem } from '@/types/character'
import { isConsumable } from '@/domain/inventory'
import ItemIcon from './ItemIcon.vue'
import ItemStatChip from './ItemStatChip.vue'
import IconCheck from '@/components/ui/icons/IconCheck.vue'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import { t } from '@/locales'

const props = defineProps<{ item: InventoryItem }>()
const emit = defineEmits<{
  (e: 'toggle-equip'): void
  (e: 'use'): void
  (e: 'edit'): void
  (e: 'remove'): void
}>()

const consumable = computed(() => isConsumable(props.item))
const qty = computed(() => props.item.quantity ?? 1)

const armorChip = computed(() => {
  const d = props.item.descriptor
  if (d.kind === 'armor') {
    if (d.class === 'full') return '+2 бр.'
    if (d.class === 'light') return '+1 бр.'
  }
  if (d.kind === 'shield') return '+1 бр.'
  return null
})
</script>

<template>
  <div :class="['inv-item', { 'is-equipped': item.equipped }]">
    <ItemIcon
      :kind="item.descriptor.kind"
      :equipped="item.equipped"
      :consumable="consumable"
    />
    <div class="inv-item-body">
      <div class="inv-item-name">
        <span class="inv-item-name-text">{{ item.name }}</span>
        <span v-if="item.equipped" class="equipped-mark">{{ t('inGame.inventory.equippedMark') }}</span>
      </div>
      <div v-if="item.notes" class="inv-item-desc">{{ item.notes }}</div>
    </div>
    <div class="inv-item-stats">
      <ItemStatChip v-if="item.damage" variant="damage">{{ item.damage }}</ItemStatChip>
      <ItemStatChip v-if="armorChip" variant="armor">{{ armorChip }}</ItemStatChip>
      <ItemStatChip v-if="consumable && qty > 1" variant="qty">×{{ qty }}</ItemStatChip>
    </div>
    <div class="inv-item-actions">
      <button
        v-if="consumable"
        type="button"
        class="item-btn is-use"
        :title="t('inGame.inventory.use')"
        @click="emit('use')"
      >
        {{ t('inGame.inventory.useShort') }}
      </button>
      <button
        v-else
        type="button"
        :class="['item-btn', { 'is-active': item.equipped }]"
        :title="item.equipped ? t('inGame.inventory.unequip') : t('inGame.inventory.equip')"
        :aria-label="item.equipped ? t('inGame.inventory.unequip') : t('inGame.inventory.equip')"
        @click="emit('toggle-equip')"
      >
        <IconCheck />
      </button>
      <button
        v-if="item.descriptor.kind === 'custom'"
        type="button"
        class="item-btn"
        :title="t('inGame.inventory.edit')"
        :aria-label="t('inGame.inventory.edit')"
        @click="emit('edit')"
      >
        <IconEdit />
      </button>
      <button
        type="button"
        class="item-btn is-danger"
        :title="t('inGame.inventory.remove')"
        :aria-label="t('inGame.inventory.remove')"
        @click="emit('remove')"
      >
        <IconTrash />
      </button>
    </div>
  </div>
</template>

<style scoped>
.inv-item {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  transition: border-color var(--t-fast) var(--ease);
}
.inv-item:hover { border-color: var(--vtt-border-strong); }
.inv-item.is-equipped {
  border-left: 2px solid var(--vtt-accent);
  padding-left: 13px;
  background: linear-gradient(to right, rgba(140, 106, 58, 0.06), transparent 40%);
}

.inv-item-body { min-width: 0; }
.inv-item-name {
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--vtt-accent-soft);
  line-height: 1.2;
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.inv-item-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.equipped-mark {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-accent);
  padding: 1px 5px;
  border: 1px solid var(--vtt-accent-deep);
  border-radius: var(--r-xs);
  background: rgba(140, 106, 58, 0.08);
  line-height: 1.2;
  flex-shrink: 0;
}
.inv-item-desc {
  color: var(--vtt-text-muted);
  font-size: 12px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inv-item-stats {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.inv-item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.item-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  color: var(--vtt-text-muted);
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
  padding: 0;
}
.item-btn :deep(svg) { width: 14px; height: 14px; }
.item-btn:hover {
  border-color: var(--vtt-border-strong);
  color: var(--vtt-accent-soft);
  background: var(--vtt-bg-elevated);
}
.item-btn.is-active {
  border-color: var(--vtt-border-gold);
  color: var(--vtt-accent);
  background: rgba(140, 106, 58, 0.1);
}
.item-btn.is-danger:hover {
  border-color: var(--vtt-danger-bright);
  color: var(--vtt-danger-bright);
  background: rgba(178, 59, 79, 0.08);
}
.item-btn.is-use {
  width: auto;
  padding: 0 10px;
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--vtt-accent-soft);
  border-color: var(--vtt-accent-deep);
}
.item-btn.is-use:hover { background: rgba(140, 106, 58, 0.15); }
</style>
