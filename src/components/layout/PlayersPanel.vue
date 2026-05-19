<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Character } from '@/types/character'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import { useCharacterCreation } from '@/composables/useCharacterCreation'
import { CLASSES } from '@/data/classes'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import IconChevronLeft from '@/components/ui/icons/IconChevronLeft.vue'
import IconChevronRight from '@/components/ui/icons/IconChevronRight.vue'
import { useGameLayout } from './gameLayoutContext'
import { t } from '@/locales'

const route = useRoute()
const router = useRouter()
const store = useCharactersStore()
const creation = useCreationStore()
const { createDraft } = useCharacterCreation()
const layout = useGameLayout()

const activeCharacters = computed(() =>
  store.list.filter(c => c.status === 'active'),
)

const openIds = computed(() => {
  const raw = route.params.ids ?? route.params.id ?? ''
  const arr = Array.isArray(raw) ? raw : String(raw).split(',')
  return arr.map(s => s.trim()).filter(Boolean)
})

const openIdsSet = computed(() => new Set(openIds.value))

const confirmResetOpen = ref(false)

const buildLine = computed(() => {
  const built = new Date(__BUILD_TIMESTAMP__).toLocaleString('ru-RU', {
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
    : (CLASSES[c.classId]?.name ?? c.classId)
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
    if (remaining.length === 0) {
      router.replace('/')
    } else {
      router.replace(`/party/${remaining.join(',')}`)
    }
    return
  }
  const next = [...openIds.value, id]
  router.replace(`/party/${next.join(',')}`)
  store.setActive(id)
}

async function startNew() {
  creation.reset()
  const draft = await createDraft()
  if (!draft) return
  router.push('/character/new')
}

function confirmReset() {
  store.clearAll()
  creation.reset()
  confirmResetOpen.value = false
  router.replace('/')
}
</script>

<template>
  <!-- ── СВЁРНУТЫЙ ВИД · rail 56px ───────────────── -->
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

  <!-- ── РАЗВЁРНУТЫЙ ВИД ─────────────────────────── -->
  <div v-else class="players-panel">
    <div class="gl-panel-head">
      <p class="eyebrow">{{ t('gameLayout.players.eyebrow') }}</p>
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
          <span class="pr-nick">{{ classLabel(c) }}</span>
        </div>
        <div class="pr-status"><span class="pr-dot" /></div>
        <div class="pr-hp">
          <div class="pr-hp-fill" :style="{ width: hpPercent(c.currentHp, c.maxHp) + '%' }" />
        </div>
      </div>

      <div v-if="!activeCharacters.length" class="players-empty">
        {{ t('gameLayout.players.empty') }}
      </div>
    </div>

    <div class="gl-panel-foot">
      <Button
        variant="hero"
        size="sm"
        class="panel-btn-full"
        :icon-left="IconPlus"
        @click="startNew"
      >{{ t('characterList.new') }}</Button>
      <button
        type="button"
        class="reset-link"
        @click="confirmResetOpen = true"
      >{{ t('characterList.dev.reset') }}</button>
      <div class="build-id">{{ buildLine }}</div>
    </div>

    <ConfirmSheet
      v-model:open="confirmResetOpen"
      :title="t('characterList.dev.confirmTitle')"
      variant="danger"
    >
      {{ t('characterList.dev.confirmBody') }}
      <template #actions>
        <Button variant="hero-danger" size="base" @click="confirmReset">
          {{ t('characterList.dev.confirmAction') }}
        </Button>
        <Button variant="ghost" size="base" @click="confirmResetOpen = false">
          {{ t('common.cancel') }}
        </Button>
      </template>
    </ConfirmSheet>
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
  padding: var(--s-3) var(--s-4) var(--s-2);
}
.gl-panel-head .eyebrow {
  margin: 0;
  color: var(--vtt-accent-deep);
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
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
}
.player-row.is-active {
  background: rgba(212, 168, 87, 0.08);
  backdrop-filter: blur(18px) saturate(1.25);
  -webkit-backdrop-filter: blur(18px) saturate(1.25);
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

.gl-panel-foot {
  padding: var(--s-3) var(--s-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.panel-btn-full { width: 100%; justify-content: center; }

.reset-link {
  background: transparent;
  border: none;
  padding: 4px 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease);
}
.reset-link:hover { color: var(--vtt-danger-bright); }

.build-id {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--vtt-text-muted);
  opacity: 0.7;
  text-align: center;
}

/* ── СВЁРНУТЫЙ ВИД · rail ─────────────────────────── */
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
}
</style>
