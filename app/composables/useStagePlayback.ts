import { computed, watch } from 'vue'
import { useTable } from '@/composables/useTable'
import { playbackTarget } from '@/domain/stage'
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
export function useStageTarget() {
  const prefs = useMediaPrefsStore()
  const stages = useStageStore()
  const { gameId } = useTable()

  const stage = computed(() => {
    const id = gameId.value
    if (!id || mode.value !== 'online' || !currentUser.value) return null
    return stages.stageOf(id)
  })
  const target = computed(() => playbackTarget(
    stage.value,
    { sound: prefs.sound, background: prefs.background },
    pb.baseURL,
  ))
  return {
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
 * Call once, in `app.vue`: forwards the target to the audio service (the scene sound only when its URL
 * changes, the volume when it changes; no stage to play means silence) and exposes the backdrop.
 */
export function useStagePlayback() {
  const prefs = useMediaPrefsStore()
  const audio = sceneAudio()
  const { target, backdropUrl, wantsSound } = useStageTarget()

  // Sync, so that turning sound on inside a click starts the scene before the unlock that follows it.
  watch(() => target.value.sceneSound, src => audio.setScene(src), { immediate: true, flush: 'sync' })
  watch(() => prefs.volume, level => audio.setVolume(level), { immediate: true })

  return { backdropUrl, wantsSound, ...useSoundSwitch() }
}
