import { computed, onScopeDispose, watch } from 'vue'
import { isGameMaster } from '@/composables/useRouteRecheck'
import { useTable } from '@/composables/useTable'
import { oneShotClearDelay, overlayKey, withoutSound } from '@/domain/stage'
import { sceneAudio } from '@/services/sceneAudioInstance'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { currentUser } from '@/transport/auth'
import { mode } from '@/transport/mode'
import { publishStage } from '@/transport/stage'
import { createLogger } from '@/utils/logger'

const log = createLogger('one-shot-clear')

// The device's own end of a track comes a little after startedAt + duration (loading, fades): the timer is only
// the fallback, and must not cut the tail off for the table.
const GRACE_MS = 1500

/**
 * The master's client takes a finished one-shot off the stage, so a device that opens the table later does not
 * find it. Players never publish. It clears when this device's audio reports the overlay ended, or by a timer
 * (sound off here, a refused or failed play, an overlay found already overdue), and only if the stage still
 * holds the same overlay. A failed clear is silent and not retried for that overlay.
 */
export function useOneShotClear() {
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
  // The duration comes from the sounds list: wait for it, or a long sound would be judged by the stale window.
  const armedKey = computed(() => {
    const now = current.value
    if (!now || media.gameId !== now.gameId) return null
    const status = media.sounds.status
    return status === 'ready' || status === 'failed' ? now.key : null
  })

  let timer: ReturnType<typeof setTimeout> | undefined
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

  watch(armedKey, (key) => {
    clearTimeout(timer)
    timer = undefined
    const now = current.value
    if (!key || !now) return
    const duration = media.sounds.list.find(s => s.id === now.sound.id)?.duration ?? null
    const delay = oneShotClearDelay(now.sound, duration, new Date())
    if (delay === null) return
    timer = setTimeout(() => void clearIfCurrent(key), delay + GRACE_MS)
  }, { immediate: true })

  const stopListening = audio.onOverlayEnded(key => void clearIfCurrent(key))
  onScopeDispose(() => {
    clearTimeout(timer)
    stopListening()
  })
}
