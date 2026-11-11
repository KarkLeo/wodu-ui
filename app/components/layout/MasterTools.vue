<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ListRow from '@/components/ui/ListRow.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import { useGameLayout } from './gameLayoutContext'
import { useEncounterPanel } from '@/composables/useEncounterPanel'
import { useTable } from '@/composables/useTable'
import { useEncounterStore } from '@/stores/encounter'
import type { Game } from '@/types/game'
import { t } from '@/locales'

const props = defineProps<{ game: Game }>()

const route = useRoute()
const router = useRouter()
const encounter = useEncounterStore()
const { toggle: toggleEncounter } = useEncounterPanel()
const { tableRoute } = useTable()
const layout = useGameLayout()

const living = computed(() => {
  if (encounter.gameId !== props.game.id || encounter.status !== 'ready') return 0
  return encounter.monsters.filter(m => m.diedAt === undefined).length
})

// A library row on its own screen goes back to the table; elsewhere it opens its library.
function openLibrary(name: 'game-monsters' | 'game-items') {
  if (route.name === name) void router.push(tableRoute())
  else void router.push({ name, params: { gameId: props.game.id } })
  layout?.closeMobileOverlays()
}

const rows = computed(() => [
  {
    key: 'encounter',
    label: t('games.tools.encounter'),
    ariaLabel: living.value > 0 ? t('games.tools.encounterCount', { count: living.value }) : undefined,
    active: encounter.panelOpen,
    current: undefined,
    pressed: encounter.panelOpen,
    count: living.value,
    onClick: toggleEncounter,
  },
  ...(['monsters', 'items'] as const).map((key) => {
    const name = key === 'monsters' ? 'game-monsters' as const : 'game-items' as const
    const here = route.name === name
    return {
      key,
      label: t(`games.tools.${key}`),
      ariaLabel: undefined,
      active: here,
      current: here ? 'page' as const : undefined,
      pressed: undefined,
      count: 0,
      onClick: () => openLibrary(name),
    }
  }),
])
</script>

<template>
  <div role="group" :aria-label="t('games.tools.title')" class="master-tools">
    <SectionLabel size="md" aria-hidden="true">{{ t('games.tools.title') }}</SectionLabel>
    <ListRow
      v-for="row in rows"
      :key="row.key"
      as="button"
      :title="row.label"
      :aria-label="row.ariaLabel"
      :aria-current="row.current"
      :selected="row.active"
      :pressed="row.pressed"
      @click="row.onClick"
    >
      <template v-if="row.count > 0" #trailing>
        <span class="mt-count">{{ row.count }}</span>
      </template>
    </ListRow>
  </div>
</template>

<style scoped>
.master-tools { display: flex; flex-direction: column; gap: 2px; }
.master-tools > .section-label { padding: 0 10px 4px; }
.mt-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vtt-accent-soft);
}
</style>
