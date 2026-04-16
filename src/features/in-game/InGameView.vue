<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { xpThreshold } from '@/utils/character'
import GameHeader from './components/GameHeader.vue'
import HpXpBlock from './components/HpXpBlock.vue'
import StatsGrid from './components/StatsGrid.vue'
import MovesTab from './components/MovesTab.vue'
import GearTab from './components/GearTab.vue'
import BondsTab from './components/BondsTab.vue'
import type { Character } from '@/types/character'

const route = useRoute()
const router = useRouter()
const characters = useCharactersStore()

const id = computed(() => route.params.id as string)
const char = computed(() => characters.getById(id.value))

function patch(data: Partial<Character>) {
  characters.update(id.value, data)
}

const canLevelUp = computed(() =>
  char.value ? char.value.xp >= xpThreshold(char.value.level) : false
)

const activeTab = ref<'moves' | 'gear' | 'bonds'>('moves')
</script>

<template>
  <div v-if="char" class="content-wrap">
    <!-- Кнопка Level Up (только при заполненном XP) -->
    <div v-if="canLevelUp" class="levelup-banner">
      <span>Достаточно опыта для повышения уровня!</span>
      <button class="btn-primary" @click="router.push(`/character/${id}/levelup`)">
        Повысить уровень ↑
      </button>
    </div>

    <GameHeader :char="char" @back="router.push('/')" />
    <HpXpBlock :char="char" @patch="patch" />
    <StatsGrid :char="char" @patch="patch" />

    <!-- Sticky табы -->
    <div class="tabs">
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'moves' }"
        @click="activeTab = 'moves'"
      >Ходы</button>
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'gear' }"
        @click="activeTab = 'gear'"
      >Снаряжение</button>
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'bonds' }"
        @click="activeTab = 'bonds'"
      >Связи</button>
    </div>

    <MovesTab v-if="activeTab === 'moves'" :char="char" />
    <GearTab v-if="activeTab === 'gear'" :char="char" @patch="patch" />
    <BondsTab v-if="activeTab === 'bonds'" :char="char" @patch="patch" />
  </div>
</template>

<style scoped>
.levelup-banner {
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-accent);
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-dark);
  position: sticky;
  top: 0;
  z-index: 10;
}
.tab {
  flex: 1;
  padding: 12px 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}
.tab--active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
</style>
