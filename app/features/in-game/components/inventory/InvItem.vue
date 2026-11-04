<script setup lang="ts">
import { computed } from 'vue'
import type { InventoryItem } from '@/types/character'
import { isConsumable } from '@/domain/inventory'
import { useSheetReadonly } from '@/composables/useSheetReadonly'
import ItemIcon from './ItemIcon.vue'
import ItemStatChip from './ItemStatChip.vue'
import IconCheck from '@/components/ui/icons/IconCheck.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { t } from '@/locales'
import { gearName, gearNotes } from '@/locales/content'

const props = defineProps<{ item: InventoryItem }>()
const emit = defineEmits<{
  (e: 'toggle-equip'): void
  (e: 'use'): void
  (e: 'remove'): void
}>()

const readonly = useSheetReadonly()
const consumable = computed(() => isConsumable(props.item))
const qty = computed(() => props.item.quantity ?? 1)
const displayName = computed(() => gearName(props.item.templateId, props.item.name))
const displayNotes = computed(() => gearNotes(props.item.templateId) ?? props.item.notes)

const armorChip = computed(() => {
  const d = props.item.descriptor
  if (d.kind === 'armor') {
    if (d.class === 'full') return t('inGame.inventory.armorBonus', { amount: 2 })
    if (d.class === 'light') return t('inGame.inventory.armorBonus', { amount: 1 })
  }
  if (d.kind === 'shield') return t('inGame.inventory.armorBonus', { amount: 1 })
  return null
})
</script>

<template>
  <div :class="['inv-item', { 'is-equipped': item.equipped, 'is-readonly': readonly }]">
    <ItemIcon
      :kind="item.descriptor.kind"
      :equipped="item.equipped"
      :consumable="consumable"
    />
    <div class="inv-item-body">
      <div class="inv-item-name">
        <span class="inv-item-name-text">{{ displayName }}</span>
        <span v-if="item.equipped" class="equipped-mark">{{ t('inGame.inventory.equippedMark') }}</span>
      </div>
      <div v-if="displayNotes" class="inv-item-desc">{{ displayNotes }}</div>
    </div>
    <div class="inv-item-stats">
      <ItemStatChip v-if="item.damage" variant="damage">{{ item.damage }}</ItemStatChip>
      <ItemStatChip v-if="armorChip" variant="armor">{{ armorChip }}</ItemStatChip>
      <ItemStatChip v-if="consumable && qty > 1" variant="qty">×{{ qty }}</ItemStatChip>
    </div>
    <div v-if="!readonly" class="inv-item-actions">
      <button
        v-if="consumable"
        type="button"
        class="inv-use"
        :title="t('inGame.inventory.use')"
        @click="emit('use')"
      >
        {{ t('inGame.inventory.useShort') }}
      </button>
      <IconButton
        v-else
        variant="square"
        :tone="item.equipped ? 'accent' : 'neutral'"
        :title="item.equipped ? t('inGame.inventory.unequip') : t('inGame.inventory.equip')"
        :label="item.equipped ? t('inGame.inventory.unequip') : t('inGame.inventory.equip')"
        @click="emit('toggle-equip')"
      >
        <IconCheck :size="14" />
      </IconButton>
      <IconButton
        variant="square"
        tone="danger"
        :title="t('inGame.inventory.remove')"
        :label="t('inGame.inventory.remove')"
        @click="emit('remove')"
      >
        <IconTrash />
      </IconButton>
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
.inv-item.is-readonly { grid-template-columns: auto minmax(0, 1fr) auto; }
.inv-item.is-equipped {
  border-left: 2px solid var(--vtt-accent);
  padding-left: 13px;
  background: linear-gradient(to right, var(--vtt-gold-a06), transparent 40%);
}

.inv-item-body { min-width: 0; }
.inv-item-name {
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--vtt-accent-soft);
  line-height: 1.2;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 6px;
  min-width: 0;
}
.inv-item-name-text {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 44px;
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
  background: var(--vtt-gold-a08);
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

.inv-use {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  background: transparent;
  border: 1px solid var(--vtt-accent-deep);
  border-radius: var(--r-sm);
  color: var(--vtt-accent-soft);
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.inv-use:hover { background: var(--vtt-gold-a15); }
</style>
