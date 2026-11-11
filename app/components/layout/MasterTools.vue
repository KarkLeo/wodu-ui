<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ListRow from '@/components/ui/ListRow.vue'
import Pill from '@/components/ui/Pill.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import { useGameLayout } from './gameLayoutContext'
import { useToolPanel } from '@/composables/useToolPanel'
import { useStageControl } from '@/composables/useStageControl'
import { useTable } from '@/composables/useTable'
import { useEncounterStore } from '@/stores/encounter'
import { useMediaStore } from '@/stores/media'
import type { Game } from '@/types/game'
import { t } from '@/locales'

const props = defineProps<{ game: Game }>()

interface ToolRow {
  key: string
  label: string
  ariaLabel?: string
  /** `toggle` opens a card of the tray and is pressed while it is open; `link` opens a screen and is the current page there. */
  kind: 'toggle' | 'link'
  on: boolean
  /** A count in the trailing slot, shown while above zero. */
  count?: number
  /** Live text under the title, truncated; never the trailing slot, which would squeeze the title. */
  status?: string
  onClick: () => void
}

const route = useRoute()
const router = useRouter()
const encounter = useEncounterStore()
const media = useMediaStore()
const encounterPanel = useToolPanel('encounter')
const scenesPanel = useToolPanel('scenes')
const { activeSceneId } = useStageControl()
const { tableRoute } = useTable()
const layout = useGameLayout()

const living = computed(() => {
  if (encounter.gameId !== props.game.id || encounter.status !== 'ready') return 0
  return encounter.monsters.filter(m => m.diedAt === undefined).length
})

const activeSceneName = computed(() => {
  if (!activeSceneId.value || media.gameId !== props.game.id) return ''
  return media.scenes.list.find(s => s.id === activeSceneId.value)?.name ?? ''
})

// A library row on its own screen goes back to the table; elsewhere it opens its library.
function openLibrary(name: 'game-monsters' | 'game-items') {
  if (route.name === name) void router.push(tableRoute())
  else void router.push({ name, params: { gameId: props.game.id } })
  layout?.closeMobileOverlays()
}

function libraryRow(key: 'monsters' | 'items'): ToolRow {
  const name = key === 'monsters' ? 'game-monsters' as const : 'game-items' as const
  return { key, label: t(`games.tools.${key}`), kind: 'link', on: route.name === name, onClick: () => openLibrary(name) }
}

const rows = computed<ToolRow[]>(() => [
  {
    key: 'encounter',
    label: t('games.tools.encounter'),
    ariaLabel: living.value > 0 ? t('games.tools.encounterCount', { count: living.value }) : undefined,
    kind: 'toggle',
    on: encounterPanel.open.value,
    count: living.value,
    onClick: encounterPanel.toggle,
  },
  libraryRow('monsters'),
  libraryRow('items'),
  {
    key: 'scenes',
    label: t('stage.scenes.title'),
    ariaLabel: activeSceneName.value ? t('games.tools.scenesOn', { name: activeSceneName.value }) : undefined,
    kind: 'toggle',
    on: scenesPanel.open.value,
    status: activeSceneName.value || undefined,
    onClick: scenesPanel.toggle,
  },
])
</script>

<template>
  <div role="group" :aria-label="t('games.tools.title')" class="master-tools">
    <SectionLabel class="mt-label" size="md" aria-hidden="true">{{ t('games.tools.title') }}</SectionLabel>
    <div class="mt-rows">
      <ListRow
        v-for="row in rows"
        :key="row.key"
        class="mt-row"
        as="button"
        :title="row.label"
        :subtitle="row.status"
        :aria-label="row.ariaLabel"
        :aria-current="row.kind === 'link' && row.on ? 'page' : undefined"
        :selected="row.on"
        :pressed="row.kind === 'toggle' ? row.on : undefined"
        @click="row.onClick"
      >
        <template v-if="row.count" #trailing>
          <Pill tone="accent" size="sm">{{ row.count }}</Pill>
        </template>
      </ListRow>
    </div>
  </div>
</template>

<style scoped>
.master-tools { display: flex; flex-direction: column; gap: 2px; min-height: 0; }
/* With more rows the block scrolls inside itself rather than squeezing the character list. */
.mt-rows { display: flex; flex-direction: column; gap: 2px; min-height: 0; overflow-y: auto; }
.mt-label { padding: 0 10px 4px; }
/* The same gold side bar as a selected player row: a tool that is on reads as selected. */
.mt-row.is-selected::before {
  content: "";
  position: absolute;
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 22px;
  background: var(--vtt-accent);
  border-radius: 0 var(--r-pill) var(--r-pill) 0;
  box-shadow: 0 0 8px var(--vtt-accent-a50);
}
</style>
