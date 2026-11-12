<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import IconPlus from '@/components/ui/icons/IconPlus.vue'
import StateNote from '@/components/ui/StateNote.vue'
import SoundRow from './SoundRow.vue'
import SoundSheet from './SoundSheet.vue'
import { retryMedia } from '@/composables/useMediaSession'
import { useStageControl } from '@/composables/useStageControl'
import { useTable } from '@/composables/useTable'
import { MEDIA_LIMITS } from '@/domain/stage'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { useToastsStore } from '@/stores/toasts'
import { deleteSound, MediaWriteError, updateSound } from '@/transport/media'
import type { Sound } from '@/types/stage'
import { createLogger } from '@/utils/logger'
import { t } from '@/locales'

const log = createLogger('sounds-panel')
const media = useMediaStore()
const stages = useStageStore()
const toasts = useToastsStore()
const { gameId } = useTable()
const { playingSoundId, playSound, stopSound } = useStageControl()

// The store holds one game's list; at another game's table it is not this table's to show or to play.
const mine = computed(() => media.gameId !== null && media.gameId === gameId.value)
const status = computed(() => (mine.value ? media.sounds.status : 'idle'))
const sounds = computed(() => (mine.value ? media.sounds.list : []))
const atLimit = computed(() => sounds.value.length >= MEDIA_LIMITS.sounds)

// A sound's own change (play, stop, delete) is on its way: its row waits, the others do not.
const busy = reactive(new Set<string>())

// `failed` turns an error into the toast to show, or null for one that needs none.
async function change(sound: Sound, run: () => Promise<void>, failed: (err: unknown) => string | null): Promise<boolean> {
  if (busy.has(sound.id)) return true
  busy.add(sound.id)
  try {
    await run()
    return true
  } catch (err) {
    log.error('sound change failed', { id: sound.id, err })
    const text = failed(err)
    if (text) toasts.push(text, 'error')
    return false
  } finally {
    busy.delete(sound.id)
  }
}

// The stage writer says by itself when a switch did not reach the table, so the panel adds nothing of its own;
// the row follows the store and stays as it was.
const play = (sound: Sound) => change(sound, () => playSound(sound), () => null)
const stop = (sound: Sound) => change(sound, stopSound, () => null)

// The loop values being saved, so a switch shows what was asked for until the answer comes.
const loopSaving = reactive(new Map<string, boolean>())

async function toggleLoop(sound: Sound, value: boolean) {
  const game = gameId.value
  if (!game || loopSaving.has(sound.id)) return
  loopSaving.set(sound.id, value)
  try {
    await updateSound(game, { id: sound.id, name: sound.name, loop: value, duration: sound.duration })
  } catch (err) {
    log.error('loop change failed', { id: sound.id, err })
    if (!(err instanceof MediaWriteError && err.kind === 'aborted')) {
      toasts.push(t(err instanceof MediaWriteError && err.kind === 'notMaster' ? 'errors.soundNotMaster' : 'errors.soundSaveFailed'), 'error')
    }
  } finally {
    loopSaving.delete(sound.id)
  }
}

// The loop of a sound that is playing applies from its next play.
const stageLoop = computed(() => (gameId.value ? stages.stageOf(gameId.value).sound?.loop : undefined))
const loopWaits = (sound: Sound) => playingSoundId.value === sound.id && stageLoop.value !== undefined && stageLoop.value !== sound.loop

const rows = new Map<string, { focusDelete: () => void }>()
function setRow(id: string, row: unknown) {
  if (row) rows.set(id, row as { focusDelete: () => void })
  else rows.delete(id)
}

const addRef = ref<{ $el: HTMLElement } | null>(null)

const sheetOpen = ref(false)
// Kept after the sheet closes, so its title does not flip to "new sound" while it fades out.
const sheetSound = ref<Sound | undefined>(undefined)

function add() {
  sheetSound.value = undefined
  sheetOpen.value = true
}

function edit(sound: Sound) {
  sheetSound.value = sound
  sheetOpen.value = true
}

const deleting = ref<Sound | null>(null)
const deleteOpen = computed({
  get: () => deleting.value !== null,
  set: (v: boolean) => { if (!v) deleting.value = null },
})
// Kept when the sheet closes, or the title loses the name during the closing animation.
const deletingName = ref('')
const deletingPlaying = ref(false)

function askDelete(sound: Sound) {
  deletingName.value = sound.name
  deletingPlaying.value = playingSoundId.value === sound.id
  deleting.value = sound
}

async function confirmDelete() {
  const sound = deleting.value
  const game = gameId.value
  if (!sound || !game || busy.has(sound.id)) return
  deleting.value = null
  const wasPlaying = playingSoundId.value === sound.id
  const done = await change(sound, () => deleteSound(game, sound.id), (err) => {
    // The session ended under the write: nobody is left to tell.
    if (err instanceof MediaWriteError) {
      if (err.kind === 'aborted') return null
      if (err.kind === 'notMaster') return t('errors.soundNotMaster')
    }
    // A playing sound is stopped first; if that failed it still plays, and the stage writer has said so.
    if (wasPlaying && playingSoundId.value === sound.id) return null
    return t('errors.soundDeleteFailed')
  })
  await nextTick()
  if (!done) {
    rows.get(sound.id)?.focusDelete()
    return
  }
  // The row went with the sound, and with it the button the focus came from.
  if (!media.sounds.list.some(s => s.id === sound.id)) addRef.value?.$el.focus()
}
</script>

<template>
  <section class="sp" :aria-label="t('stage.sounds.title')">
    <header class="sp-head">
      <h2 class="sp-title">{{ t('stage.sounds.title') }}</h2>
      <span v-if="status === 'ready'" class="sp-count">
        {{ t('stage.sounds.count', { count: sounds.length, max: MEDIA_LIMITS.sounds }) }}
      </span>
      <Button
        v-if="status === 'ready'"
        ref="addRef"
        variant="dashed"
        size="sm"
        :icon-left="IconPlus"
        :disabled="atLimit"
        @click="add"
      >
        {{ t('stage.sounds.add') }}
      </Button>
    </header>

    <div class="sp-body">
      <StateNote v-if="status === 'loading' || status === 'idle'" size="sm" role="status">{{ t('stage.sounds.loading') }}</StateNote>
      <StateNote v-else-if="status === 'failed'" size="sm" role="alert">
        {{ t('stage.sounds.loadFailed') }}
        <template #action>
          <Button variant="ghost" size="sm" @click="retryMedia">{{ t('stage.sounds.retry') }}</Button>
        </template>
      </StateNote>
      <template v-else-if="status === 'ready'">
        <!-- Above the list: at the limit the list is long and the note would scroll out of sight. -->
        <StateNote v-if="atLimit" size="sm" inline>{{ t('stage.sounds.limitReached', { max: MEDIA_LIMITS.sounds }) }}</StateNote>
        <EmptyState v-if="!sounds.length" :hint="t('stage.sounds.empty')" />
        <ul v-else class="sp-list">
          <SoundRow
            v-for="sound in sounds"
            :key="sound.id"
            :ref="el => setRow(sound.id, el)"
            :sound="sound"
            :playing="playingSoundId === sound.id"
            :busy="busy.has(sound.id)"
            :loop="loopSaving.get(sound.id) ?? sound.loop"
            :loop-saving="loopSaving.has(sound.id)"
            :loop-next-play="loopWaits(sound)"
            @play="play(sound)"
            @stop="stop(sound)"
            @toggle-loop="toggleLoop(sound, $event)"
            @edit="edit(sound)"
            @delete="askDelete(sound)"
          />
        </ul>
      </template>
    </div>

    <SoundSheet v-if="gameId" v-model:open="sheetOpen" :game-id="gameId" :sound="sheetSound" />

    <ConfirmSheet v-model:open="deleteOpen" variant="danger" :title="t('stage.sounds.delete.title', { name: deletingName })">
      <p>{{ deletingPlaying ? t('stage.sounds.delete.bodyPlaying') : t('stage.sounds.delete.body') }}</p>
      <template #actions>
        <Button variant="hero-danger" @click="confirmDelete">{{ t('stage.sounds.delete.confirm') }}</Button>
        <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
      </template>
    </ConfirmSheet>
  </section>
</template>

<style scoped>
.sp {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  border-radius: var(--r-lg);
  background: var(--vtt-surface-a88);
  box-shadow: 0 0 0 1px var(--vtt-gold-a35);
  overflow: hidden;
}
.sp-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  /* Room on the right for the column's close button. */
  padding: 12px 40px 10px 14px;
  border-bottom: 1px solid var(--vtt-border-subtle);
}
.sp-title {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 20px;
  color: var(--vtt-text-primary);
}
.sp-count {
  flex: 1 1 auto;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--vtt-text-muted);
}
.sp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
