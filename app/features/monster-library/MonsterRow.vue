<script setup lang="ts">
import { computed } from 'vue'
import ItemStatChip from '@/features/in-game/components/inventory/ItemStatChip.vue'
import AccordionRow from '@/components/ui/AccordionRow.vue'
import Button from '@/components/ui/Button.vue'
import IconEdit from '@/components/ui/icons/IconEdit.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconTrash from '@/components/ui/icons/IconTrash.vue'
import type { LibraryMonster } from '@/types/library'
import { t } from '@/locales'

const props = defineProps<{ monster: LibraryMonster }>()
const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'duplicate'): void
  (e: 'delete'): void
}>()

const expanded = defineModel<boolean>('expanded', { default: false })
const details = computed(() => [
  ...(props.monster.special ? [{ label: t('library.monsters.special'), text: props.monster.special }] : []),
  ...(props.monster.notes ? [{ label: t('library.monsters.notes'), text: props.monster.notes }] : []),
])
</script>

<template>
  <AccordionRow v-model:expanded="expanded" :details="details">
    <template #title>{{ monster.name }}</template>
    <!-- On the closed row too: at the table HP, armor and damage are what the master looks up. -->
    <template #meta>
      <ItemStatChip variant="hp">{{ t('library.monsters.hp', { hp: monster.hp }) }}</ItemStatChip>
      <ItemStatChip variant="armor">{{ t('library.monsters.armor', { armor: monster.armor }) }}</ItemStatChip>
      <ItemStatChip variant="damage">{{ monster.damage }}</ItemStatChip>
    </template>
    <template #actions>
      <Button variant="ghost" size="sm" :icon-left="IconEdit" @click="emit('edit')">{{ t('library.monsters.edit') }}</Button>
      <Button variant="ghost" size="sm" :icon-left="IconPlus" @click="emit('duplicate')">{{ t('library.monsters.duplicate') }}</Button>
      <Button variant="danger-ghost" size="sm" :icon-left="IconTrash" class="mr-delete" @click="emit('delete')">
        {{ t('library.monsters.delete') }}
      </Button>
    </template>
  </AccordionRow>
</template>

<style scoped>
.mr-delete { margin-left: auto; }
</style>
