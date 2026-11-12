import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useTable } from '@/composables/useTable'
import { useOneShotClear } from '@/composables/useOneShotClear'
import { nextOverlayDecision, overlayKey, playbackTarget, type OverlayDecision } from '@/domain/stage'
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
export function useStageTarget(overlay?: { decision: Ref<OverlayDecision | null>; ended: Ref<string[]> }) {
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
    if (!overlay || !next.overlay) return next
    // Nothing plays before this device has decided, whichever watcher runs first, and a key that ended here never again.
    const { key } = next.overlay
    const allowed = overlay.decision.value?.key === key && overlay.decision.value.play === true && !overlay.ended.value.includes(key)
    return allowed ? next : { ...next, overlay: null }
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
  const decision = ref<OverlayDecision | null>(null)
  const ended = ref<string[]>([])
  const { stage, target, backdropUrl, wantsSound } = useStageTarget({ decision, ended })
  const stages = useStageStore()

  // Whether this device plays a stage's overlay is decided once per key, when sound is first on for it, from how the
  // value reached this device (a realtime change or my own publish is live; a load or a reload is found). A computed
  // over the clock would re-judge it on every recomputation.
  let openGame: string | null = null
  watch(
    [() => stage.value?.id ?? null, () => (stage.value?.sound ? overlayKey(stage.value.sound) : null), () => prefs.sound === 'on'],
    ([game, , soundOn]) => {
      if (game !== openGame) {
        decision.value = null
        ended.value = []
        openGame = game
      }
      const received = game ? stages.arrivalOf(game) : undefined
      const now = new Date()
      decision.value = nextOverlayDecision(
        decision.value,
        stage.value?.sound ?? null,
        { live: received?.source === 'live', firstSeen: received ? new Date(received.at) : now },
        soundOn,
        now,
      )
    },
    { immediate: true, flush: 'sync' },
  )
  // A key that ended on this device is never played again while the table is open, even if a failed clear brings it back.
  const stopListening = audio.onOverlayEnded((key) => {
    if (!ended.value.includes(key)) ended.value = [...ended.value, key]
  })
  onScopeDispose(stopListening)

  // Sync, so that turning sound on inside a click starts the scene before the unlock that follows it.
  watch(() => target.value.sceneSound, src => audio.setScene(src), { immediate: true, flush: 'sync' })
  watch(
    () => target.value.overlay?.key ?? null,
    key => audio.setOverlay(key ? target.value.overlay : null),
    { immediate: true, flush: 'sync' },
  )
  watch(() => prefs.volume, level => audio.setVolume(level), { immediate: true })

  useOneShotClear(key => target.value.overlay?.key === key || ended.value.includes(key))

  return { backdropUrl, wantsSound, ...useSoundSwitch() }
}
