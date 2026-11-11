<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Character } from '@/types/character'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import { useCharacterCreation } from '@/composables/useCharacterCreation'
import { useTable } from '@/composables/useTable'
import { useTableSelection } from '@/composables/useTableSelection'
import { useGamesStore } from '@/stores/games'
import { currentUser } from '@/transport/auth'
import { mode } from '@/transport/mode'
import { charactersInScope } from '@/utils/scope'
import { isMaster } from '@/utils/permissions'
import Avatar from '@/components/ui/Avatar.vue'
import Button from '@/components/ui/Button.vue'
import ListRow from '@/components/ui/ListRow.vue'
import Pill from '@/components/ui/Pill.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import StateNote from '@/components/ui/StateNote.vue'
import GameMenu from './GameMenu.vue'
import PanelFooter from './PanelFooter.vue'
import MasterlessNotice from './MasterlessNotice.vue'
import MasterTools from './MasterTools.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconChevronLeft from '@/components/ui/icons/IconChevronLeft.vue'
import IconChevronRight from '@/components/ui/icons/IconChevronRight.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { useGameLayout } from './gameLayoutContext'
import { t } from '@/locales'
import { className } from '@/locales/content'

const route = useRoute()
const router = useRouter()
const store = useCharactersStore()
const creation = useCreationStore()
const { createDraft } = useCharacterCreation()
const layout = useGameLayout()
const games = useGamesStore()
const { selectCharacter } = useTableSelection()
const { tableScope, gameId, game, partyRoute, newCharacterRoute } = useTable()

const me = computed(() => currentUser.value?.id ?? null)

// Online the panel lists the open table: a game's characters, or my free ones outside games.
const activeCharacters = computed(() => {
  const list = mode.value === 'online'
    ? charactersInScope(store.list, store.metaView, tableScope.value, me.value)
    : store.list
  return list.filter(c => c.status === 'active')
})

const isGameMaster = computed(() => !!game.value && isMaster(game.value, me.value))

const role = computed(() => {
  if (!game.value || !game.value.master) return null
  return isMaster(game.value, me.value) ? t('games.list.roleMaster') : t('games.list.rolePlayer')
})

function ownerLabel(c: Character): string {
  const owner = store.metaOf(c.id)?.owner
  if (owner === me.value) return t('games.table.you')
  const name = gameId.value ? games.membersOf(gameId.value).find(m => m.user === owner)?.name : ''
  return name || t('games.table.unknownOwner')
}

function subLine(c: Character): string {
  return game.value ? t('games.table.ownerLine', { owner: ownerLabel(c), line: classLabel(c) }) : classLabel(c)
}

const openIds = computed(() => {
  const raw = route.params.ids ?? route.params.id ?? ''
  const arr = Array.isArray(raw) ? raw : String(raw).split(',')
  return arr.map(s => s.trim()).filter(Boolean)
})

const openIdsSet = computed(() => new Set(openIds.value))

function classLabel(c: Character): string {
  const name = c.classId === 'custom'
    ? (c.customClassName ?? t('characterList.customClassFallback'))
    : className(c.classId)
  return t('characterList.classLine', { className: name, level: c.level })
}

function hpPercent(current: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (current / max) * 100))
}

function toggleCharacter(id: string) {
  if (openIdsSet.value.has(id)) {
    const remaining = openIds.value.filter(x => x !== id)
    if (store.activeId === id) {
      store.setActive(remaining[0] ?? null)
    }
    router.replace(partyRoute(remaining))
    return
  }
  router.replace(partyRoute([...openIds.value, id]))
  selectCharacter(id)
}

// Inside a game the draft is created in it (createDraft follows the scope) and the wizard stays there.
async function startNew() {
  creation.reset()
  const draft = await createDraft()
  if (!draft) return
  router.push(newCharacterRoute())
}
</script>

<template>
  <!-- ── COLLAPSED VIEW · rail 56px ───────────────── -->
  <div v-if="layout?.leftCollapsed.value" class="players-rail">
    <IconButton size="lg" :label="t('gameLayout.actions.togglePlayers')" @click="layout.toggleCollapsed('left')">
      <IconChevronRight :size="14" />
    </IconButton>
    <span class="gl-rail-label">{{ t('gameLayout.players.railLabel', { count: activeCharacters.length }) }}</span>
    <div v-if="activeCharacters.length" class="gl-rail-avatars">
      <Avatar
        v-for="c in activeCharacters"
        :key="c.id"
        as="div"
        size="sm"
        interactive
        :name="c.name"
        :selected="openIdsSet.has(c.id)"
        :title="c.name"
        @click="toggleCharacter(c.id)"
      ><span class="pr-dot" /></Avatar>
    </div>
  </div>

  <!-- ── EXPANDED VIEW ─────────────────────────── -->
  <div v-else class="players-panel">
    <div class="gl-panel-head">
      <div v-if="game" class="pr-game">
        <span class="pr-game-eyebrow">
          <SectionLabel size="md">{{ t('gameLayout.players.eyebrow') }}</SectionLabel>
          <Pill v-if="role" size="sm" :tone="game.master === me ? 'accent' : 'neutral'">{{ role }}</Pill>
        </span>
        <span class="pr-game-title" :title="game.name">{{ game.name }}</span>
      </div>
      <SectionLabel v-else as="p" size="md">{{ t('gameLayout.players.eyebrow') }}</SectionLabel>
      <div v-if="game" class="pr-game-menu"><GameMenu :game="game" /></div>
      <Pill v-if="mode === 'offline'" class="pr-offline-badge" tone="accent" dot>{{ t('mode.badge') }}</Pill>
      <IconButton
        v-if="layout"
        class="pr-collapse"
        :label="t('gameLayout.actions.collapsePanel')"
        @click="layout.toggleCollapsed('left')"
      >
        <IconChevronLeft :size="14" />
      </IconButton>
    </div>

    <MasterlessNotice v-if="game && !game.master" :game="game" />

    <div class="gl-panel-list">
      <ListRow
        v-for="c in activeCharacters"
        :key="c.id"
        as="button"
        class="player-row"
        :subtitle="subLine(c)"
        :selected="openIdsSet.has(c.id)"
        :pressed="openIdsSet.has(c.id)"
        @click="toggleCharacter(c.id)"
      >
        <template #leading><Avatar :name="c.name" :selected="openIdsSet.has(c.id)" /></template>
        <template #title><span class="pr-name">{{ c.name }}</span></template>
        <template #trailing><span class="pr-dot" /></template>
        <template #below>
          <span class="pr-hp"><span class="pr-hp-fill" :style="{ width: hpPercent(c.currentHp, c.maxHp) + '%' }" /></span>
        </template>
      </ListRow>

      <StateNote v-if="!activeCharacters.length" compact size="sm">
        {{ t('gameLayout.players.empty') }}
      </StateNote>

      <div v-if="mode === 'offline'" class="players-offline-hint">
        <StateNote inline align="start" size="xs">{{ t('mode.offlineHint') }}</StateNote>
      </div>
    </div>

    <div v-if="isGameMaster && game" class="gl-panel-tools">
      <MasterTools :game="game" />
    </div>

    <div class="gl-panel-foot">
      <Button
        variant="hero"
        size="sm"
        class="panel-btn-full"
        :icon-left="IconPlus"
        @click="startNew"
      >{{ t('characterList.new') }}</Button>
      <PanelFooter />
    </div>
  </div>
</template>

<style scoped>
.players-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.gl-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
  padding: var(--s-3) var(--s-4) var(--s-2);
}

.pr-game {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pr-game-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.pr-game-title {
  min-width: 0;
  font-family: var(--font-serif);
  font-size: 17px;
  line-height: 1.2;
  color: var(--vtt-accent-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pr-game-menu { margin-left: auto; display: inline-flex; }

.pr-offline-badge { margin-left: auto; }

.gl-panel-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--s-3) var(--s-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.gl-panel-list::-webkit-scrollbar { width: 4px; }
.gl-panel-list::-webkit-scrollbar-thumb {
  background: var(--vtt-border-strong);
  border-radius: var(--r-pill);
}

.player-row:hover {
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  backdrop-filter: blur(14px) saturate(1.15);
}
.player-row.is-selected {
  -webkit-backdrop-filter: blur(18px) saturate(1.25);
  backdrop-filter: blur(18px) saturate(1.25);
}
.player-row.is-selected::before {
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

.pr-name { text-shadow: 0 1px 3px var(--vtt-black-a50); }

.pr-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--r-pill);
  background: var(--vtt-success);
  box-shadow: 0 0 5px var(--vtt-success-glow-a60);
}

.pr-hp {
  display: block;
  height: 2px;
  margin-top: 5px;
  background: var(--vtt-sunken-a62);
  border-radius: var(--r-pill);
  overflow: hidden;
}
.pr-hp-fill {
  display: block;
  height: 100%;
  background: linear-gradient(to right, var(--vtt-danger), var(--vtt-danger-bright));
  border-radius: var(--r-pill);
}

.players-offline-hint { margin-top: var(--s-1); padding: 0 10px; }

.gl-panel-tools {
  flex: none;
  padding: 0 var(--s-3) var(--s-2);
}

.gl-panel-foot {
  padding: var(--s-3) var(--s-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.panel-btn-full { width: 100%; justify-content: center; }

/* ── COLLAPSED VIEW · rail ─────────────────────────── */
.players-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--s-3) 0;
  width: 56px;
  height: 100%;
  gap: var(--s-3);
}


.gl-rail-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  margin: var(--s-3) 0;
  white-space: nowrap;
}

.gl-rail-avatars {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-bottom: var(--s-2);
}
.gl-rail-avatars .pr-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 7px;
  height: 7px;
  border: 1.5px solid var(--vtt-base-a88);
}

@media (max-width: 960px) {
  .pr-collapse { display: none; }
  /* Below 961px the panel is the mobile overlay, whose close button sits over the head's right end. */
  .gl-panel-head { padding-right: 48px; }
}
</style>
