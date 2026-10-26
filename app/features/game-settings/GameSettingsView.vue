<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import InvitePanel from '@/components/layout/InvitePanel.vue'
import MembersList from '@/components/layout/MembersList.vue'
import AuthField from '@/features/sign-in/AuthField.vue'
import { useGameAction } from '@/composables/useGameAction'
import { exitGameQuietly } from '@/composables/useRouteRecheck'
import { useTable } from '@/composables/useTable'
import { deleteGame, renameGame } from '@/transport/games'
import { GAME_NAME_MAX, gameNameError } from '@/utils/gameName'
import { t } from '@/locales'
import { createLogger } from '@/utils/logger'

const log = createLogger('game-settings')

const router = useRouter()
const { game, tableRoute } = useTable()
const { busy, run } = useGameAction()

// ── Name ──
const name = ref(game.value?.name ?? '')
const saving = ref(false)
const nameStatus = ref<'saved' | 'failed' | null>(null)

const nameError = computed(() => gameNameError(name.value))
const unchanged = computed(() => name.value.trim() === (game.value?.name ?? ''))
const canSave = computed(() => !!game.value && !saving.value && !unchanged.value && nameError.value === null)

// Follows a rename from elsewhere (realtime) unless the field has been edited.
watch(() => game.value?.name, (next, prev) => {
  if (next !== undefined && (prev === undefined || name.value.trim() === prev)) name.value = next
})
// Trimming the saved value is not an edit, so it keeps the "Saved." status.
watch(name, (next, prev) => {
  if (next.trim() !== prev.trim()) nameStatus.value = null
})

async function saveName() {
  const current = game.value
  if (!current || !canSave.value) return
  saving.value = true
  nameStatus.value = null
  try {
    await renameGame(current.id, name.value)
    name.value = name.value.trim()
    nameStatus.value = 'saved'
  } catch (err) {
    log.warn('renameGame failed', { err })
    nameStatus.value = 'failed'
  } finally {
    saving.value = false
  }
}

// ── Members ──
// The former master is a player now: back to the table (the route re-check may get there first).
function afterTransfer() {
  void router.replace(tableRoute())
}

// ── Delete ──
const deleteOpen = ref(false)

async function confirmDelete() {
  const current = game.value
  if (!current) return
  const gameId = current.id
  const ok = await run('deleteGame', t('games.remove.failed'), () => exitGameQuietly(gameId, () => deleteGame(gameId)))
  if (!ok) return
  deleteOpen.value = false
  void router.replace({ name: 'character-list' })
}

function backToTable() {
  void router.push(tableRoute())
}
</script>

<template>
  <div class="content-wrap st-screen">
    <header class="st-head">
      <div class="st-titles">
        <h1 class="st-title">{{ t('games.settings.title') }}</h1>
        <p v-if="game" class="st-game">{{ game.name }}</p>
      </div>
      <Button variant="ghost" size="sm" @click="backToTable">{{ t('games.settings.back') }}</Button>
    </header>

    <div v-if="!game" class="st-loading" role="status">{{ t('games.loading') }}</div>

    <template v-else>
      <!-- The field's own label says what it is; the section keeps a name for assistive tech. -->
      <section class="st-section" :aria-label="t('games.settings.name')">
        <form class="st-form" novalidate @submit.prevent="saveName">
          <AuthField
            id="game-settings-name"
            v-model="name"
            :label="t('games.create.label')"
            :placeholder="t('games.create.placeholder')"
            autocomplete="off"
          />
          <p v-if="nameError === 'tooLong'" class="st-error" role="alert">
            {{ t('games.create.tooLong', { max: GAME_NAME_MAX }) }}
          </p>
          <p v-else-if="nameStatus === 'failed'" class="st-error" role="alert">{{ t('games.settings.renameFailed') }}</p>
          <div class="st-form-foot">
            <p class="st-status" role="status">{{ nameStatus === 'saved' ? t('games.settings.saved') : '' }}</p>
            <Button type="submit" variant="primary" size="sm" :disabled="!canSave">{{ t('common.save') }}</Button>
          </div>
        </form>
      </section>

      <section class="st-section" aria-labelledby="st-invite">
        <h2 id="st-invite" class="st-label">{{ t('games.settings.invite') }}</h2>
        <InvitePanel :game="game" />
      </section>

      <section class="st-section" aria-labelledby="st-members">
        <h2 id="st-members" class="st-label">{{ t('games.settings.members') }}</h2>
        <MembersList :game="game" @transferred="afterTransfer" />
      </section>

      <section class="st-section is-danger" aria-labelledby="st-delete">
        <h2 id="st-delete" class="st-label">{{ t('games.menu.delete') }}</h2>
        <p class="st-hint">{{ t('games.settings.deleteHint') }}</p>
        <Button variant="danger-ghost" size="sm" class="st-delete" @click="deleteOpen = true">{{ t('games.menu.delete') }}</Button>
      </section>

      <ConfirmSheet v-model:open="deleteOpen" variant="danger" :title="t('games.remove.title', { game: game.name })">
        <p>{{ t('games.remove.body') }}</p>
        <template #actions>
          <Button variant="hero-danger" :disabled="busy" @click="confirmDelete">{{ t('games.remove.confirm') }}</Button>
          <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
        </template>
      </ConfirmSheet>
    </template>
  </div>
</template>

<style scoped>
.st-screen {
  /* Same column as CharacterListView: centred, never under GameLayout's side panels. */
  --st-w: min(640px, 100% - var(--gl-inset-left, 0px) - var(--gl-inset-right, 0px));
  width: var(--st-w);
  margin-left: clamp(var(--gl-inset-left, 0px), (100% - var(--st-w)) / 2, 100% - var(--gl-inset-right, 0px) - var(--st-w));
  padding: 16px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.st-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.st-titles { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.st-title {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 22px;
  line-height: 1.2;
  color: var(--vtt-accent-soft);
}
.st-game {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
  color: var(--vtt-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.st-loading {
  margin: 48px auto;
  padding: 24px;
  text-align: center;
  color: var(--vtt-text-muted);
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 14px;
}

.st-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  background: var(--vtt-bg-surface);
  border: 1px solid var(--vtt-border-subtle);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-1);
}
.st-section.is-danger { border-color: var(--vtt-border-strong); }
.st-label {
  margin: 0;
  font-family: var(--font-mono);
  font-weight: 400;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vtt-text-muted);
}
.st-hint {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  line-height: 1.45;
  color: var(--vtt-text-muted);
}

.st-form { display: flex; flex-direction: column; gap: 10px; }
.st-form-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.st-error { margin: 0; font-family: var(--font-serif); font-size: 13px; color: var(--vtt-danger-bright); }
.st-status {
  margin: 0;
  min-height: 1.4em;
  font-family: var(--font-serif);
  font-size: 13px;
  color: var(--vtt-success);
}
.st-delete { align-self: flex-start; }
</style>
