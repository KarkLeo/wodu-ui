<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Pill from '@/components/ui/Pill.vue'
import ItemStatChip from '@/features/in-game/components/inventory/ItemStatChip.vue'
import type { LibraryMonster } from '@/types/library'
import { t } from '@/locales'

defineProps<{
  monster: LibraryMonster
  /** Presses sent in this sitting; the pill shows from the first. */
  count: number
}>()
defineEmits<{ (e: 'add'): void }>()
</script>

<template>
  <li class="epr">
    <span class="epr-name">{{ monster.name }}</span>
    <span class="epr-chips">
      <ItemStatChip variant="hp">{{ t('library.monsters.hp', { hp: monster.hp }) }}</ItemStatChip>
      <ItemStatChip variant="damage">{{ monster.damage }}</ItemStatChip>
    </span>
    <Pill v-if="count > 0" tone="accent" role="status">{{ t('encounter.pick.count', { count }) }}</Pill>
    <Button variant="primary" size="sm" @click="$emit('add')">{{ t('encounter.pick.add') }}</Button>
  </li>
</template>

<style scoped>
.epr {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 8px 14px;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
}
.epr-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--vtt-text-primary);
}
.epr-chips { display: inline-flex; gap: 4px; }
</style>
