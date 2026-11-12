import { computed, onScopeDispose, watch } from 'vue'
import { isGameMaster } from '@/composables/useRouteRecheck'
import { useTable } from '@/composables/useTable'
import { ONE_SHOT_CLEAR_GRACE_SECONDS, oneShotClearDelay, overlayKey, withoutSound } from '@/domain/stage'
import { sceneAudio } from '@/services/sceneAudioInstance'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { currentUser } from '@/transport/auth'
import { mode } from '@/transport/mode'
import { publishStage } from '@/transport/stage'
import { createLogger } from '@/utils/logger'

const log = createLogger('one-shot-clear')

/**
 * The master's client takes a finished one-shot off the stage, so a device that opens the table later does not
 * find it. It is bookkeeping and must never cut a sound the table still hears. Players never publish.
 *
 * `playingHere(key)` says whether this device has that overlay in its playback target. Then the clear comes from
 * the end of the track, `ONE_SHOT_CLEAR_GRACE_SECONDS` later (so the table's devices finish too), with a clock
 * backstop; otherwise (sound off, not played because overdue) the clock alone decides, with the same grace after
 * the duration. An unknown duration waits an hour. Whatever fires, the stage is published without the sound only
 * if it still holds the same overlay. A failed clear is silent and not retried for that overlay.
 */
export function useOneShotClear(playingHere: (key: string) => boolean) {
  const { gameId } = useTable()
  const stages = useStageStore()
  const media = useMediaStore()
  const audio = sceneAudio()

  const current = computed(() => {
    const id = gameId.value
    if (!id || mode.value !== 'online' || !currentUser.value || !isGameMaster(id)) return null
    const sound = stages.stageOf(id).sound
    return sound ? { gameId: id, sound, key: overlayKey(sound) } : null
  })
  const durationOf = computed(() => {
    const now = current.value
    if (!now || media.gameId !== now.gameId) return null
    return media.sounds.list.find(s => s.id === now.sound.id)?.duration ?? null
  })
  // What the timer depends on, as one string: it is re-armed when any part changes, not only the key.
  const armed = computed(() => {
    const now = current.value
    return now ? `${now.key}|${durationOf.value ?? ''}|${playingHere(now.key)}` : null
  })

  const timers = new Set<ReturnType<typeof setTimeout>>()
  let clockTimer: ReturnType<typeof setTimeout> | undefined
  let failedKey: string | null = null

  async function clearIfCurrent(key: string) {
    const now = current.value
    if (!now || now.key !== key || failedKey === key) return
    try {
      await publishStage(withoutSound(stages.stageOf(now.gameId)), { quiet: true })
    } catch (err) {
      failedKey = key
      log.warn('clearing the finished sound failed', { err })
    }
  }

  watch(armed, () => {
    clearTimeout(clockTimer)
    clockTimer = undefined
    const now = current.value
    if (!now) return
    const delay = oneShotClearDelay(now.sound, durationOf.value, new Date(), playingHere(now.key))
    if (delay === null) return
    clockTimer = setTimeout(() => void clearIfCurrent(now.key), delay)
  }, { immediate: true })

  const stopListening = audio.onOverlayEnded((key) => {
    if (current.value?.key !== key) return
    const timer = setTimeout(() => {
      timers.delete(timer)
      void clearIfCurrent(key)
    }, ONE_SHOT_CLEAR_GRACE_SECONDS * 1000)
    timers.add(timer)
  })
  onScopeDispose(() => {
    clearTimeout(clockTimer)
    timers.forEach(clearTimeout)
    stopListening()
  })
}
