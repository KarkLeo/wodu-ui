<script setup lang="ts">
import { computed } from 'vue'
import AccordionRow from '@/components/ui/AccordionRow.vue'
import Button from '@/components/ui/Button.vue'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import ItemChips from './ItemChips.vue'
import type { LibraryItem } from '@/types/library'
import { t } from '@/locales'

const props = defineProps<{ item: LibraryItem }>()
const emit = defineEmits<{
  (e: 'give'): void
  (e: 'edit'): void
  (e: 'duplicate'): void
  (e: 'delete'): void
}>()

const expanded = defineModel<boolean>('expanded', { default: false })
const details = computed(() => (props.item.notes ? [{ label: t('library.items.notes'), text: props.item.notes }] : []))
</script>

<template>
  <AccordionRow v-model:expanded="expanded" :details="details">
    <template #title>{{ item.name }}</template>
    <template #meta><ItemChips :item="item" /></template>
    <template #actions>
      <Button variant="primary" size="sm" @click="emit('give')">{{ t('library.items.give.action') }}</Button>
      <Button variant="ghost" size="sm" :icon-left="IconEdit" @click="emit('edit')">{{ t('library.items.edit') }}</Button>
      <Button variant="ghost" size="sm" :icon-left="IconPlus" @click="emit('duplicate')">{{ t('library.items.duplicate') }}</Button>
      <Button variant="danger-ghost" size="sm" :icon-left="IconTrash" class="ir-delete" @click="emit('delete')">
        {{ t('library.items.delete') }}
      </Button>
    </template>
  </AccordionRow>
</template>

<style scoped>
.ir-delete { margin-left: auto; }
</style>
