<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import ConfirmSheet from '@/components/ui/ConfirmSheet.vue'
import MediaPanelShell from './MediaPanelShell.vue'
import SoundRow from './SoundRow.vue'
import SoundSheet from './SoundSheet.vue'
import { useMediaChanges } from '@/composables/useMediaChanges'
import { useMediaDelete } from '@/composables/useMediaDelete'
import { useStageControl } from '@/composables/useStageControl'
import { useTable } from '@/composables/useTable'
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

// A sound's own change (play, stop, delete) is on its way: its row waits, the others do not.
const { busy, change } = useMediaChanges()

// The stage writer says by itself when a switch did not reach the table, so the panel adds nothing of its own;
// the row follows the store and stays as it was.
const play = (sound: Sound) => change(sound.id, () => playSound(sound), () => null)
const stop = (sound: Sound) => change(sound.id, stopSound, () => null)

// The loop values being saved, so a switch shows what was asked for until the answer comes.
const loopSaving = reactive(new Map<string, boolean>())

async function toggleLoop(sound: Sound, value: boolean) {
  const game = gameId.value
  // One save at a time per sound, and none while the sound's own delete, play or stop is under way.
  if (!game || loopSaving.has(sound.id) || busy.has(sound.id)) return
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

const shell = ref<{ focusAdd: () => void } | null>(null)

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

const { open: deleteOpen, name: deletingName, live: deletingPlaying, ask: askDelete, confirm: confirmDelete } = useMediaDelete<Sound>({
  gameId: () => gameId.value,
  list: () => media.sounds.list,
  busy,
  change,
  remove: deleteSound,
  isLive: sound => playingSoundId.value === sound.id,
  nameOf: sound => sound.name,
  notMasterKey: 'errors.soundNotMaster',
  failedKey: 'errors.soundDeleteFailed',
  focusEntry: id => rows.get(id)?.focusDelete(),
  focusAdd: () => shell.value?.focusAdd(),
})
</script>

<template>
  <MediaPanelShell ref="shell" kind="sounds" :status="status" :count="sounds.length" @add="add">
    <ul class="sp-list">
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

    <template #sheets>
      <SoundSheet v-if="gameId" v-model:open="sheetOpen" :game-id="gameId" :sound="sheetSound" />

      <ConfirmSheet v-model:open="deleteOpen" variant="danger" :title="t('stage.sounds.delete.title', { name: deletingName })">
        <p>{{ deletingPlaying ? t('stage.sounds.delete.bodyPlaying') : t('stage.sounds.delete.body') }}</p>
        <template #actions>
          <Button variant="hero-danger" @click="confirmDelete">{{ t('stage.sounds.delete.confirm') }}</Button>
          <Button variant="ghost" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
        </template>
      </ConfirmSheet>
    </template>
  </MediaPanelShell>
</template>

<style scoped>
.sp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
