<script setup lang="ts">
import { computed, useId } from 'vue'
import ItemStatChip from '@/features/in-game/components/inventory/ItemStatChip.vue'
import IconChevronRight from '@/components/ui/icons/IconChevronRight.vue'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import Button from '@/components/ui/Button.vue'
import type { LibraryMonster } from '@/types/library'
import { t } from '@/locales'

const props = defineProps<{ monster: LibraryMonster }>()
const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'duplicate'): void
  (e: 'delete'): void
}>()

const expanded = defineModel<boolean>('expanded', { default: false })
const bodyId = useId()
const hasDetails = computed(() => !!props.monster.special || !!props.monster.notes)
</script>

<template>
  <li :class="['mr-row', { 'is-open': expanded }]">
    <button
      type="button"
      class="mr-head"
      :aria-expanded="expanded"
      :aria-controls="bodyId"
      @click="expanded = !expanded"
    >
      <span class="mr-name">{{ monster.name }}</span>
      <!-- On the closed row too: at the table HP, armor and damage are what the master looks up. -->
      <span class="mr-stats">
        <ItemStatChip variant="hp">{{ t('library.monsters.hp', { hp: monster.hp }) }}</ItemStatChip>
        <ItemStatChip variant="armor">{{ t('library.monsters.armor', { armor: monster.armor }) }}</ItemStatChip>
        <ItemStatChip variant="damage">{{ monster.damage }}</ItemStatChip>
      </span>
      <IconChevronRight class="mr-chevron" aria-hidden="true" />
    </button>

    <div v-if="expanded" :id="bodyId" class="mr-body">
      <dl v-if="hasDetails" class="mr-details">
        <template v-if="monster.special">
          <dt>{{ t('library.monsters.special') }}</dt>
          <dd>{{ monster.special }}</dd>
        </template>
        <template v-if="monster.notes">
          <dt>{{ t('library.monsters.notes') }}</dt>
          <dd>{{ monster.notes }}</dd>
        </template>
      </dl>
      <div class="mr-actions">
        <Button variant="ghost" size="sm" :icon-left="IconEdit" @click="emit('edit')">{{ t('library.monsters.edit') }}</Button>
        <Button variant="ghost" size="sm" :icon-left="IconPlus" @click="emit('duplicate')">{{ t('library.monsters.duplicate') }}</Button>
        <Button variant="danger-ghost" size="sm" :icon-left="IconTrash" class="mr-delete" @click="emit('delete')">
          {{ t('library.monsters.delete') }}
        </Button>
      </div>
    </div>
  </li>
</template>

<style scoped>
.mr-row {
  list-style: none;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  transition: border-color var(--t-fast) var(--ease);
}
.mr-row:hover,
.mr-row.is-open { border-color: var(--vtt-border-strong); }

.mr-head {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px 10px 14px;
  background: transparent;
  border: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.mr-head:focus-visible {
  outline: 2px solid var(--vtt-accent);
  outline-offset: -2px;
  border-radius: var(--r-sm);
}
.mr-name {
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.25;
  color: var(--vtt-accent-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mr-stats { display: inline-flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
.mr-chevron {
  width: 12px;
  height: 12px;
  color: var(--vtt-text-muted);
  transition: transform var(--t-fast) var(--ease);
}
.mr-row.is-open .mr-chevron { transform: rotate(90deg); color: var(--vtt-accent); }

.mr-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px 14px 12px;
  border-top: 1px solid var(--vtt-border-subtle);
}
.mr-details { margin: 10px 0 0; display: flex; flex-direction: column; gap: 4px; }
.mr-details dt {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.mr-details dd {
  margin: 0 0 6px;
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.45;
  color: var(--vtt-text-primary);
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.mr-actions { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 10px; }
.mr-delete { margin-left: auto; }

@media (max-width: 419px) {
  .mr-head { grid-template-columns: minmax(0, 1fr) auto; }
  .mr-stats { grid-column: 1 / -1; grid-row: 2; justify-content: flex-start; }
}
</style>
