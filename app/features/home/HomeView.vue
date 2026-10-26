<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TabBar from '@/components/ui/TabBar.vue'
import GamesTab from './GamesTab.vue'
import CharactersTab from './CharactersTab.vue'
import { onlineDataReady } from '@/transport/bootstrap'
import { t } from '@/locales'

type HomeTab = 'games' | 'characters'

const TAB_STORAGE_KEY = 'wod.home.tab.v1'

function readTab(): HomeTab {
  try {
    return localStorage.getItem(TAB_STORAGE_KEY) === 'characters' ? 'characters' : 'games'
  } catch {
    return 'games'
  }
}

const tab = ref<string>(readTab())

watch(tab, (value) => {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, value)
  } catch {
    // storage unavailable: the tab is remembered for this visit only
  }
})

const tabs = computed(() => [
  { value: 'games', label: t('games.tabs.games') },
  { value: 'characters', label: t('games.tabs.characters') },
])
</script>

<template>
  <div class="content-wrap hm-screen">
    <TabBar v-model="tab" :tabs="tabs" class="hm-tabs" />

    <div v-if="!onlineDataReady" class="hm-loading" role="status">
      {{ t('games.loading') }}
    </div>
    <div v-else role="tabpanel" class="hm-panel">
      <GamesTab v-if="tab === 'games'" />
      <CharactersTab v-else />
    </div>
  </div>
</template>

<style scoped>
.hm-screen {
  /* Same column as CharacterListView: centred, never under GameLayout's side panels. */
  --hm-w: min(640px, 100% - var(--gl-inset-left, 0px) - var(--gl-inset-right, 0px));
  width: var(--hm-w);
  margin-left: clamp(var(--gl-inset-left, 0px), (100% - var(--hm-w)) / 2, 100% - var(--gl-inset-right, 0px) - var(--hm-w));
  padding: 16px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.hm-tabs { border-radius: var(--r-sm) var(--r-sm) 0 0; }
.hm-loading {
  margin: 48px auto;
  padding: 24px;
  text-align: center;
  color: var(--vtt-text-muted);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
}
</style>
