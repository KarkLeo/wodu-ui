import { computed, ref, watch, type Ref } from 'vue'
import { useTable } from '@/composables/useTable'
import { useOneShotClear } from '@/composables/useOneShotClear'
import { nextOverlayArrival, overlayKey, playbackTarget, type OverlayArrival } from '@/domain/stage'
import { sceneAudio } from '@/services/sceneAudioInstance'
import { useMediaPrefsStore } from '@/stores/mediaPrefs'
import { useStageStore } from '@/stores/stage'
import { currentUser } from '@/transport/auth'
import { onlineDataReady } from '@/transport/bootstrap'
import { mode } from '@/transport/mode'
import { pb } from '@/transport/pb'

/**
 * What this device plays and shows for the open table. The stage that counts is the open game's, online;
 * anywhere else there is none. What the device has off gets no URL. Reads only: `useStagePlayback` acts on it.
 */
export function useStageTarget(arrival?: Ref<OverlayArrival | null>) {
  const prefs = useMediaPrefsStore()
  const stages = useStageStore()
  const { gameId } = useTable()

  const stage = computed(() => {
    const id = gameId.value
    if (!id || mode.value !== 'online' || !currentUser.value) return null
    return stages.stageOf(id)
  })
  const target = computed(() => {
    const sound = stage.value?.sound
    const decided = sound && arrival?.value?.key === overlayKey(sound) ? arrival.value : null
    const next = playbackTarget(
      stage.value,
      { sound: prefs.sound, background: prefs.background },
      pb.baseURL,
      decided ? { receivedLive: decided.receivedLive, now: decided.at } : undefined,
    )
    // With a decision expected, no overlay plays before it is made, whichever watcher runs first.
    return arrival && sound && !decided ? { ...next, overlay: null } : next
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
  const arrival = ref<OverlayArrival | null>(null)
  const { stage, target, backdropUrl, wantsSound } = useStageTarget(arrival)

  // An overlay already in the stage as the table's stage was loaded is "found"; one that arrives afterwards (realtime,
  // my own publish) is live. Decided once per key, here, since a computed over the clock would re-judge it.
  let loaded = false
  let loadedGame: string | null = null
  watch(
    [() => stage.value?.id ?? null, () => onlineDataReady.value, () => (stage.value?.sound ? overlayKey(stage.value.sound) : null)],
    ([game, ready, key]) => {
      if (game !== loadedGame) {
        arrival.value = null
        loaded = false
        loadedGame = game
      }
      arrival.value = nextOverlayArrival(arrival.value, key, loaded, new Date())
      loaded = game !== null && ready
    },
    { immediate: true, flush: 'sync' },
  )

  // Sync, so that turning sound on inside a click starts the scene before the unlock that follows it.
  watch(() => target.value.sceneSound, src => audio.setScene(src), { immediate: true, flush: 'sync' })
  watch(
    () => target.value.overlay?.key ?? null,
    key => audio.setOverlay(key ? target.value.overlay : null),
    { immediate: true, flush: 'sync' },
  )
  watch(() => prefs.volume, level => audio.setVolume(level), { immediate: true })

  useOneShotClear()

  return { backdropUrl, wantsSound, ...useSoundSwitch() }
}
