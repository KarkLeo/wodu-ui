<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Character } from '@/types/character'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import { useCharacterCreation } from '@/composables/useCharacterCreation'
import { useAccount } from '@/composables/useAccount'
import { useTable } from '@/composables/useTable'
import { useGamesStore } from '@/stores/games'
import { currentUser } from '@/transport/auth'
import { mode } from '@/transport/mode'
import { charactersInScope } from '@/utils/scope'
import { isMaster } from '@/utils/permissions'
import Button from '@/components/ui/Button.vue'
import AccountMenu from './AccountMenu.vue'
import GameMenu from './GameMenu.vue'
import MasterlessNotice from './MasterlessNotice.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconChevronLeft from '@/components/ui/icons/IconChevronLeft.vue'
import IconChevronRight from '@/components/ui/icons/IconChevronRight.vue'
import { useGameLayout } from './gameLayoutContext'
import { t, currentLocale, LOCALES, type Locale } from '@/locales'
import { className } from '@/locales/content'

const route = useRoute()
const router = useRouter()
const store = useCharactersStore()
const creation = useCreationStore()
const { createDraft } = useCharacterCreation()
const { user, setLanguage } = useAccount()
const layout = useGameLayout()
const games = useGamesStore()
const { tableScope, gameId, game, partyRoute, newCharacterRoute } = useTable()

const me = computed(() => currentUser.value?.id ?? null)

// Online the panel lists the open table: a game's characters, or my free ones outside games.
const activeCharacters = computed(() => {
  const list = mode.value === 'online'
    ? charactersInScope(store.list, store.metaView, tableScope.value, me.value)
    : store.list
  return list.filter(c => c.status === 'active')
})

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

const localeOptions = LOCALES.map(l => ({ value: l, label: l.toUpperCase() }))

const buildLine = computed(() => {
  const built = new Date(__BUILD_TIMESTAMP__).toLocaleString(currentLocale.value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return t('gameLayout.players.buildLine', { version: __APP_VERSION__, built })
})

function initial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

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
  store.setActive(id)
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
    <button
      type="button"
      class="btn-rail-toggle"
      :aria-label="t('gameLayout.actions.togglePlayers')"
      @click="layout.toggleCollapsed('left')"
    >
      <IconChevronRight :size="14" />
    </button>
    <span class="gl-rail-label">{{ t('gameLayout.players.railLabel', { count: activeCharacters.length }) }}</span>
    <div v-if="activeCharacters.length" class="gl-rail-avatars">
      <div
        v-for="c in activeCharacters"
        :key="c.id"
        :class="['pr-avatar', { 'is-active': openIdsSet.has(c.id) }]"
        :title="c.name"
        @click="toggleCharacter(c.id)"
      >
        {{ initial(c.name) }}<span class="pr-dot" />
      </div>
    </div>
  </div>

  <!-- ── EXPANDED VIEW ─────────────────────────── -->
  <div v-else class="players-panel">
    <div class="gl-panel-head">
      <div v-if="game" class="pr-game">
        <span class="pr-game-eyebrow">
          <span class="eyebrow">{{ t('gameLayout.players.eyebrow') }}</span>
          <span v-if="role" :class="['pr-role', { 'is-master': game.master === me }]">{{ role }}</span>
        </span>
        <span class="pr-game-title" :title="game.name">{{ game.name }}</span>
      </div>
      <p v-else class="eyebrow">{{ t('gameLayout.players.eyebrow') }}</p>
      <div v-if="game" class="pr-game-menu"><GameMenu :game="game" /></div>
      <span v-if="mode === 'offline'" class="pr-offline-badge">
        <span class="pr-offline-dot" aria-hidden="true" />
        <span>{{ t('mode.badge') }}</span>
      </span>
      <button
        v-if="layout"
        type="button"
        class="btn-collapse"
        :aria-label="t('gameLayout.actions.collapsePanel')"
        @click="layout.toggleCollapsed('left')"
      >
        <IconChevronLeft :size="14" />
      </button>
    </div>

    <MasterlessNotice v-if="game && !game.master" :game="game" />

    <div class="gl-panel-list">
      <div
        v-for="c in activeCharacters"
        :key="c.id"
        :class="['player-row', { 'is-active': openIdsSet.has(c.id) }]"
        role="button"
        tabindex="0"
        @click="toggleCharacter(c.id)"
        @keydown.enter.prevent="toggleCharacter(c.id)"
        @keydown.space.prevent="toggleCharacter(c.id)"
      >
        <div class="pr-avatar">{{ initial(c.name) }}</div>
        <div class="pr-body">
          <span class="pr-name">{{ c.name }}</span>
          <span class="pr-nick">{{ subLine(c) }}</span>
        </div>
        <div class="pr-status"><span class="pr-dot" /></div>
        <div class="pr-hp">
          <div class="pr-hp-fill" :style="{ width: hpPercent(c.currentHp, c.maxHp) + '%' }" />
        </div>
      </div>

      <div v-if="!activeCharacters.length" class="players-empty">
        {{ t('gameLayout.players.empty') }}
      </div>

      <p v-if="mode === 'offline'" class="players-offline-hint">{{ t('mode.offlineHint') }}</p>
    </div>

    <div class="gl-panel-foot">
      <Button
        variant="hero"
        size="sm"
        class="panel-btn-full"
        :icon-left="IconPlus"
        @click="startNew"
      >{{ t('characterList.new') }}</Button>
      <div class="build-id">{{ buildLine }}</div>
      <AccountMenu v-if="mode === 'online' && user" :user="user" />
      <div class="pr-locale" role="group" :aria-label="t('gameLayout.players.language')">
        <button
          v-for="opt in localeOptions"
          :key="opt.value"
          type="button"
          class="pr-locale-btn"
          :class="{ 'is-active': currentLocale === opt.value }"
          :aria-pressed="currentLocale === opt.value"
          @click="setLanguage(opt.value as Locale)"
        >{{ opt.label }}</button>
      </div>
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
.gl-panel-head .eyebrow {
  margin: 0;
  color: var(--vtt-accent-deep);
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
.pr-role {
  flex-shrink: 0;
  padding: 1px 7px;
  border: 1px solid var(--vtt-border-strong);
  border-radius: var(--r-pill);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-secondary);
}
.pr-role.is-master { border-color: var(--vtt-border-gold); color: var(--vtt-accent); }
.pr-game-menu { margin-left: auto; display: inline-flex; }

.pr-offline-badge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border: 1px solid var(--vtt-border-gold);
  border-radius: var(--r-pill);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vtt-accent-soft);
  white-space: nowrap;
}
.pr-offline-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--r-pill);
  background: var(--vtt-accent);
}

.btn-collapse {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(228, 201, 160, 0.04);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: 50%;
  color: var(--vtt-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.btn-collapse:hover {
  color: var(--vtt-accent-soft);
  border-color: var(--vtt-border-strong);
  background: rgba(228, 201, 160, 0.08);
}

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

.player-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 12px;
  padding: 8px 10px;
  border-radius: var(--r-md);
  cursor: pointer;
  transition: background var(--t-fast) var(--ease);
  position: relative;
}
.player-row:hover {
  background: rgba(228, 201, 160, 0.04);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  backdrop-filter: blur(14px) saturate(1.15);
}
.player-row.is-active {
  background: rgba(212, 168, 87, 0.08);
  -webkit-backdrop-filter: blur(18px) saturate(1.25);
  backdrop-filter: blur(18px) saturate(1.25);
}
.player-row.is-active::before {
  content: "";
  position: absolute;
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 22px;
  background: var(--vtt-accent);
  border-radius: 0 var(--r-pill) var(--r-pill) 0;
  box-shadow: 0 0 8px rgba(212, 168, 87, 0.5);
}

.pr-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(58, 45, 33, 0.9) 0%, rgba(26, 21, 16, 0.9) 100%);
  box-shadow: inset 0 0 0 1px rgba(228, 201, 160, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 500;
  line-height: 1;
  color: var(--vtt-accent-soft);
  flex-shrink: 0;
}
.player-row.is-active .pr-avatar {
  background: linear-gradient(135deg, rgba(140, 106, 58, 0.55) 0%, rgba(74, 58, 40, 0.75) 100%);
  box-shadow: inset 0 0 0 1px rgba(228, 201, 160, 0.28);
  color: var(--vtt-accent);
}

.pr-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.pr-name {
  font-family: var(--font-serif);
  font-size: 15px;
  color: var(--vtt-accent-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.pr-nick {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--vtt-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.pr-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--r-pill);
  background: var(--vtt-success);
  box-shadow: 0 0 5px rgba(107, 142, 78, 0.6);
}

.pr-hp {
  height: 2px;
  margin-top: 5px;
  background: rgba(7, 5, 10, 0.6);
  border-radius: var(--r-pill);
  overflow: hidden;
  grid-column: 2 / 4;
}
.pr-hp-fill {
  height: 100%;
  background: linear-gradient(to right, var(--vtt-danger), var(--vtt-danger-bright));
  border-radius: var(--r-pill);
}

.players-empty {
  padding: 12px 10px;
  color: var(--vtt-text-muted);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  text-align: center;
}

.players-offline-hint {
  margin: var(--s-1) 0 0;
  padding: 0 10px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  line-height: 1.4;
  color: var(--vtt-text-muted);
}

.gl-panel-foot {
  padding: var(--s-3) var(--s-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.panel-btn-full { width: 100%; justify-content: center; }

.build-id {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--vtt-text-muted);
  opacity: 0.7;
  text-align: center;
}

.pr-locale { display: flex; gap: 2px; margin-top: 6px; }
.pr-locale-btn {
  padding: 2px 6px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--vtt-text-muted);
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.pr-locale-btn.is-active {
  color: var(--vtt-text-primary);
  background: var(--vtt-bg-elevated);
}

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

.btn-rail-toggle {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(228, 201, 160, 0.04);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: 50%;
  color: var(--vtt-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}
.btn-rail-toggle:hover {
  color: var(--vtt-accent);
  border-color: var(--vtt-border-strong);
  background: rgba(228, 201, 160, 0.08);
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
.gl-rail-avatars .pr-avatar {
  width: 30px;
  height: 30px;
  font-size: 12px;
  position: relative;
  cursor: pointer;
  transition: background var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
}
.gl-rail-avatars .pr-avatar:hover {
  box-shadow: inset 0 0 0 1px rgba(228, 201, 160, 0.2);
}
.gl-rail-avatars .pr-avatar.is-active {
  background: linear-gradient(135deg, rgba(140, 106, 58, 0.55) 0%, rgba(74, 58, 40, 0.75) 100%);
  box-shadow:
    inset 0 0 0 1px rgba(228, 201, 160, 0.45),
    0 0 10px rgba(212, 168, 87, 0.35);
  color: var(--vtt-accent);
}
.gl-rail-avatars .pr-avatar .pr-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 7px;
  height: 7px;
  border: 1.5px solid rgba(14, 11, 8, 0.9);
}

@media (max-width: 960px) {
  .btn-collapse { display: none; }
  /* Below 961px the panel is the mobile overlay, whose close button sits over the head's right end. */
  .gl-panel-head { padding-right: 48px; }
}
</style>
