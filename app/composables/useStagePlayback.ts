import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue'
import { useTable } from '@/composables/useTable'
import { useOneShotClear } from '@/composables/useOneShotClear'
import { endOverlay, nextOverlayMemory, overlayKey, playbackTarget, playedToTheEnd, shouldPlayKey, type OverlayMemory } from '@/domain/stage'
import { sceneAudio } from '@/services/sceneAudioInstance'
import { useMediaPrefsStore } from '@/stores/mediaPrefs'
import { useStageStore } from '@/stores/stage'
import { currentUser } from '@/transport/auth'
import { mode } from '@/transport/mode'
import { pb } from '@/transport/pb'

/**
 * What this device plays and shows for the open table. The stage that counts is the open game's, online;
 * anywhere else there is none. What the device has off gets no URL. Reads only: `useStagePlayback` acts on it.
 */
export function useStageTarget(memory?: Ref<OverlayMemory>) {
  const prefs = useMediaPrefsStore()
  const stages = useStageStore()
  const { gameId } = useTable()

  const stage = computed(() => {
    const id = gameId.value
    if (!id || mode.value !== 'online' || !currentUser.value) return null
    return stages.stageOf(id)
  })
  const target = computed(() => {
    const next = playbackTarget(stage.value, { sound: prefs.sound, background: prefs.background }, pb.baseURL)
    if (!memory || !next.overlay) return next
    // Nothing plays before this device has decided, whichever watcher runs first, and a one-shot that ended here never again.
    return shouldPlayKey(memory.value, stage.value?.sound ?? null) ? next : { ...next, overlay: null }
  })
  return {
    stage,
    target,
    backdropUrl: computed(() => target.value.backdrop),
    wantsSound: computed(() => target.value.wantsSound),
  }
}

/** The device's sound choice. Turning on must be called directly inside the click, so the browser sees the gesture. */
export function useSoundSwitch() {
  const prefs = useMediaPrefsStore()
  const audio = sceneAudio()

  async function turnSoundOn() {
    prefs.sound = 'on'
    await audio.unlock()
  }

  function turnSoundOff() {
    prefs.sound = 'off'
  }

  return { blocked: audio.blocked, turnSoundOn, turnSoundOff }
}

/**
 * Call once, in `app.vue`: forwards the target to the audio service (the scene sound and the master's overlay
 * only when their URL or key changes, the volume when it changes; no stage to play means silence), lets the
 * master's client clear a finished one-shot, and exposes the backdrop.
 */
export function useStagePlayback() {
  const prefs = useMediaPrefsStore()
  const audio = sceneAudio()
  const memory = shallowRef<OverlayMemory>({})
  const { stage, target, backdropUrl, wantsSound } = useStageTarget(memory)
  const stages = useStageStore()

  // Every overlay key seen at an open table gets one record, at its first sight (how it arrived, when, and in the end
  // whether this device plays it), kept while the table is open even when the stage's sound goes to null: a rollback,
  // an echo or a snapshot never makes a key new, and nothing is read from the store later than that first sight.
  let openGame: string | null = null
  watch(
    [() => stage.value?.id ?? null, () => (stage.value?.sound ? overlayKey(stage.value.sound) : null), () => prefs.sound === 'on'],
    ([game, , soundOn]) => {
      if (game !== openGame) {
        memory.value = {}
        openGame = game
      }
      const now = new Date().getTime()
      const received = game ? stages.arrivalOf(game) : undefined
      memory.value = nextOverlayMemory(memory.value, stage.value?.sound ?? null, received ?? { source: 'load', at: now }, soundOn, now)
    },
    { immediate: true, flush: 'sync' },
  )
  // A one-shot that ran to its end here is never played again.
  const stopListening = audio.onOverlayEnded((key) => {
    memory.value = endOverlay(memory.value, key, true)
  })
  onScopeDispose(stopListening)

  // Sync, so that turning sound on inside a click starts the scene before the unlock that follows it.
  watch(() => target.value.sceneSound, src => audio.setScene(src), { immediate: true, flush: 'sync' })
  watch(
    () => target.value.overlay?.key ?? null,
    (key, previous) => {
      // A one-shot that stopped being the target (replaced, stopped, sound off) is done, so a rollback never restarts it.
      if (previous) memory.value = endOverlay(memory.value, previous)
      audio.setOverlay(key ? target.value.overlay : null)
    },
    { immediate: true, flush: 'sync' },
  )
  watch(() => prefs.volume, level => audio.setVolume(level), { immediate: true })
  // With sound on, the first tap anywhere primes the pool, so the first sound plays without one; the listener runs in
  // the capture phase, before the master's own Play. An `unset` device is primed by the prompt's button instead.
  watch(() => prefs.sound === 'on' && stage.value !== null, (on) => { if (on) audio.arm() }, { immediate: true, flush: 'sync' })

  useOneShotClear(key => target.value.overlay?.key === key || playedToTheEnd(memory.value, key))

  return { backdropUrl, wantsSound, ...useSoundSwitch() }
}
