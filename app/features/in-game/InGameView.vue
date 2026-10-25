<script setup lang="ts">
import { computed, ref } from 'vue'
import { useActiveCharacter } from '@/composables/useActiveCharacter'
import AppShell from '@/components/AppShell.vue'
import TabBar from '@/components/ui/TabBar.vue'
import StatusHeader from './components/StatusHeader.vue'
import StatsPanel from './components/StatsPanel.vue'
import SkillsPanel from './components/SkillsPanel.vue'
import AbilitiesPanel from './components/AbilitiesPanel.vue'
import InventoryPanel from './components/InventoryPanel.vue'
import MagicPanel from './components/MagicPanel.vue'
import NotesPanel from './components/NotesPanel.vue'
import { hasMagicAbility } from '@/data/abilities'
import { t } from '@/locales'

type Tab = 'main' | 'inventory' | 'magic' | 'notes'

const props = defineProps<{ id?: string }>()

const { id, char, dispatch } = useActiveCharacter(() => props.id)

const activeTab = ref<Tab>('main')

const hasMagic = computed(() => hasMagicAbility(char.value?.abilityIds ?? []))
const tabs = computed<{ value: Tab; label: string }[]>(() => {
  const base: { value: Tab; label: string }[] = [
    { value: 'main', label: t('inGame.tabs.main') },
    { value: 'inventory', label: t('inGame.tabs.inventory') },
  ]
  if (hasMagic.value) base.push({ value: 'magic', label: t('inGame.tabs.magic') })
  base.push({ value: 'notes', label: t('inGame.tabs.notes') })
  return base
})
const tabModel = computed<string>({
  get: () => activeTab.value,
  set: (v) => { activeTab.value = v as Tab },
})
</script>

<template>
  <AppShell v-if="char" variant="top">
    <template #header="{ compact }">
      <StatusHeader :id="id" :compact="compact" />
      <StatsPanel :char="char" :dispatch="dispatch" />
    </template>

    <template v-if="activeTab === 'main'">
      <SkillsPanel :char="char" />
      <AbilitiesPanel :char="char" />
    </template>
    <InventoryPanel
      v-else-if="activeTab === 'inventory'"
      :char="char"
      :dispatch="dispatch"
    />
    <MagicPanel
      v-else-if="activeTab === 'magic'"
      :char="char"
      :ability-ids="char.abilityIds"
      :dispatch="dispatch"
    />
    <NotesPanel
      v-else-if="activeTab === 'notes'"
      :char="char"
      :dispatch="dispatch"
    />

    <template #tabs>
      <TabBar v-model="tabModel" :tabs="tabs" variant="top" />
    </template>
  </AppShell>
</template>
