<script setup lang="ts">
import { computed } from 'vue'
import ItemStatChip from '@/features/in-game/components/inventory/ItemStatChip.vue'
import { isConsumable } from '@/domain/inventory'
import type { LibraryItem } from '@/types/library'
import { t } from '@/locales'

const props = defineProps<{ item: LibraryItem }>()

const reach = computed(() => {
  const d = props.item.descriptor
  return d.kind === 'weapon' ? t(d.melee ? 'library.items.melee' : 'library.items.ranged') : null
})

const armor = computed(() => {
  const d = props.item.descriptor
  let amount = 0
  if (d.kind === 'armor') amount = d.class === 'full' ? 2 : d.class === 'light' ? 1 : 0
  else if (d.kind === 'shield') amount = 1
  return amount ? t('library.items.armorBonus', { amount }) : null
})

const quantity = computed(() => (isConsumable(props.item) ? (props.item.quantity ?? 1) : 0))
</script>

<template>
  <span class="ic-chips">
    <ItemStatChip v-if="item.damage" variant="damage">{{ item.damage }}</ItemStatChip>
    <ItemStatChip v-if="reach" variant="qty">{{ reach }}</ItemStatChip>
    <ItemStatChip v-if="armor" variant="armor">{{ armor }}</ItemStatChip>
    <ItemStatChip v-if="quantity" variant="qty">×{{ quantity }}</ItemStatChip>
    <ItemStatChip v-if="item.price !== undefined" variant="price">{{ t('library.items.price', { price: item.price }) }}</ItemStatChip>
  </span>
</template>

<style scoped>
.ic-chips { display: inline-flex; flex-wrap: wrap; gap: 4px; }
/* An item with nothing to show takes no room in its row. */
.ic-chips:empty { display: none; }
</style>
