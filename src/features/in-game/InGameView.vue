<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useActiveCharacter } from '@/composables/useActiveCharacter'
import HeaderStrip from './components/HeaderStrip.vue'
import StatsPanel from './components/StatsPanel.vue'
import SkillsPanel from './components/SkillsPanel.vue'
import AbilitiesPanel from './components/AbilitiesPanel.vue'
import InventoryPanel from './components/InventoryPanel.vue'
import MagicPanel from './components/MagicPanel.vue'
import NotesPanel from './components/NotesPanel.vue'

type Tab = 'main' | 'inventory' | 'magic' | 'notes'

const router = useRouter()
const { id, char, dispatch } = useActiveCharacter()

const activeTab = ref<Tab>('main')

const hasMagic = computed(() =>
  !!char.value?.abilityIds?.some(id => id === 'summoning' || id === 'ritual'),
)
const tabs = computed<{ id: Tab; label: string }[]>(() => {
  const base: { id: Tab; label: string }[] = [
    { id: 'main', label: 'Основное' },
    { id: 'inventory', label: 'Инвентарь' },
  ]
  if (hasMagic.value) base.push({ id: 'magic', label: 'Магия' })
  base.push({ id: 'notes', label: 'Заметки' })
  return base
})
</script>

<template>
  <div v-if="char" class="content-wrap">
    <HeaderStrip
      :char="char"
      :dispatch="dispatch"
      @level-up="router.push(`/character/${id}/levelup`)"
      @back="router.push('/')"
    />

    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="tab"
        :class="{ 'tab--active': activeTab === t.id }"
        @click="activeTab = t.id"
      >{{ t.label }}</button>
    </nav>

    <div v-if="activeTab === 'main'">
      <StatsPanel :char="char" :dispatch="dispatch" />
      <SkillsPanel :char="char" />
      <AbilitiesPanel :char="char" />
    </div>
    <InventoryPanel v-else-if="activeTab === 'inventory'" :char="char" :dispatch="dispatch" />
    <MagicPanel
      v-else-if="activeTab === 'magic'"
      :char="char"
      :ability-ids="char.abilityIds"
      :dispatch="dispatch"
    />
    <NotesPanel v-else-if="activeTab === 'notes'" :char="char" :dispatch="dispatch" />
  </div>
</template>

<style scoped>
.tabs { display: flex; border-bottom: 1px solid var(--color-border); background: var(--color-bg-dark); position: sticky; top: 0; z-index: 10; }
.tab { flex: 1; padding: 12px 0; background: none; border: none; border-bottom: 2px solid transparent; color: var(--color-text-muted); font-family: inherit; font-size: 13px; cursor: pointer; }
.tab--active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
</style>
