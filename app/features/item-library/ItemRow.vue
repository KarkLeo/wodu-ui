<script setup lang="ts">
import { useId } from 'vue'
import IconChevronRight from '@/components/ui/icons/IconChevronRight.vue'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import Button from '@/components/ui/Button.vue'
import ItemChips from './ItemChips.vue'
import type { LibraryItem } from '@/types/library'
import { t } from '@/locales'

defineProps<{ item: LibraryItem }>()
const emit = defineEmits<{
  (e: 'give'): void
  (e: 'edit'): void
  (e: 'duplicate'): void
  (e: 'delete'): void
}>()

const expanded = defineModel<boolean>('expanded', { default: false })
const bodyId = useId()
</script>

<template>
  <li :class="['ir-row', { 'is-open': expanded }]">
    <button
      type="button"
      class="ir-head"
      :aria-expanded="expanded"
      :aria-controls="bodyId"
      @click="expanded = !expanded"
    >
      <span class="ir-name">{{ item.name }}</span>
      <ItemChips :item="item" class="ir-stats" />
      <IconChevronRight class="ir-chevron" aria-hidden="true" />
    </button>

    <div v-if="expanded" :id="bodyId" class="ir-body">
      <dl v-if="item.notes" class="ir-details">
        <dt>{{ t('library.items.notes') }}</dt>
        <dd>{{ item.notes }}</dd>
      </dl>
      <div class="ir-actions">
        <Button variant="primary" size="sm" @click="emit('give')">{{ t('library.items.give.action') }}</Button>
        <Button variant="ghost" size="sm" :icon-left="IconEdit" @click="emit('edit')">{{ t('library.items.edit') }}</Button>
        <Button variant="ghost" size="sm" :icon-left="IconPlus" @click="emit('duplicate')">{{ t('library.items.duplicate') }}</Button>
        <Button variant="danger-ghost" size="sm" :icon-left="IconTrash" class="ir-delete" @click="emit('delete')">
          {{ t('library.items.delete') }}
        </Button>
      </div>
    </div>
  </li>
</template>

<style scoped>
.ir-row {
  list-style: none;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-sm);
  transition: border-color var(--t-fast) var(--ease);
}
.ir-row:hover,
.ir-row.is-open { border-color: var(--vtt-border-strong); }

.ir-head {
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
.ir-head:focus-visible {
  outline: 2px solid var(--vtt-accent);
  outline-offset: -2px;
  border-radius: var(--r-sm);
}
.ir-name {
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.25;
  color: var(--vtt-accent-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ir-stats { justify-content: flex-end; }
.ir-chevron {
  width: 12px;
  height: 12px;
  color: var(--vtt-text-muted);
  transition: transform var(--t-fast) var(--ease);
}
.ir-row.is-open .ir-chevron { transform: rotate(90deg); color: var(--vtt-accent); }

.ir-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px 14px 12px;
  border-top: 1px solid var(--vtt-border-subtle);
}
.ir-details { margin: 10px 0 0; display: flex; flex-direction: column; gap: 4px; }
.ir-details dt {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.ir-details dd {
  margin: 0 0 6px;
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.45;
  color: var(--vtt-text-primary);
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.ir-actions { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 10px; }
.ir-delete { margin-left: auto; }

/* Without chips the chevron would slide next to the name. */
@media (min-width: 420px) {
  .ir-chevron { grid-column: 3; }
}
@media (max-width: 419px) {
  .ir-head { grid-template-columns: minmax(0, 1fr) auto; }
  .ir-stats { grid-column: 1 / -1; grid-row: 2; justify-content: flex-start; }
}
</style>
