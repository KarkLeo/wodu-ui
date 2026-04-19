<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import HeaderStrip from './components/HeaderStrip.vue'
import StatsPanel from './components/StatsPanel.vue'
import SkillsPanel from './components/SkillsPanel.vue'
import AbilitiesPanel from './components/AbilitiesPanel.vue'
import InventoryPanel from './components/InventoryPanel.vue'
import MagicPanel from './components/MagicPanel.vue'
import NotesPanel from './components/NotesPanel.vue'
import type { Character } from '@/types/character'

type Tab = 'main' | 'inventory' | 'magic' | 'notes'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()

const id = computed(() => route.params.id as string)
const char = computed(() => characters.getById(id.value))

function patch(data: Partial<Character>) {
  characters.update(id.value, data)
}

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
      @patch="patch"
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
      <StatsPanel :char="char" @patch="patch" />
      <SkillsPanel :char="char" />
      <AbilitiesPanel :char="char" />
    </div>
    <InventoryPanel v-else-if="activeTab === 'inventory'" :char="char" @patch="patch" />
    <MagicPanel
      v-else-if="activeTab === 'magic'"
      :char="char"
      :ability-ids="char.abilityIds"
      @patch="patch"
    />
    <NotesPanel v-else-if="activeTab === 'notes'" :char="char" @patch="patch" />
  </div>
</template>

<style scoped>
.tabs { display: flex; border-bottom: 1px solid var(--color-border); background: var(--color-bg-dark); position: sticky; top: 0; z-index: 10; }
.tab { flex: 1; padding: 12px 0; background: none; border: none; border-bottom: 2px solid transparent; color: var(--color-text-muted); font-family: inherit; font-size: 13px; cursor: pointer; }
.tab--active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
</style>
