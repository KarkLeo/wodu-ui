import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { isGameMaster } from '@/composables/useRouteRecheck'
import { useTable } from '@/composables/useTable'
import { ONE_SHOT_CLEAR_GRACE_SECONDS, oneShotClearDelay, oneShotOverDelay, overlayKey, withoutSound } from '@/domain/stage'
import { sceneAudio } from '@/services/sceneAudioInstance'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { currentUser } from '@/transport/auth'
import { connection } from '@/transport/connection'
import { mode } from '@/transport/mode'
import { publishStage } from '@/transport/stage'
import { createLogger } from '@/utils/logger'

const log = createLogger('one-shot-clear')

// The key of the open game's one-shot that is over on the master's device, although the stage holds it until the clear.
const overKey = shallowRef<string | null>(null)

/**
 * Whether the master's one-shot with this overlay key is over on this device: it ended here, or this device does not
 * play it and its duration has passed since `startedAt`. The master's row then offers Play again, not Stop. Only
 * `useOneShotClear` (the master's client, at the open table) sets it; a loop is never over.
 */
export function oneShotIsOver(key: string): boolean {
  return overKey.value === key
}

export interface OneShotClearOptions {
  /** This device has that overlay in its playback target, or played it to its end. */
  playingHere: (key: string) => boolean
  /** This device played that overlay to its end. */
  endedHere: (key: string) => boolean
  /** How long after the end of the track the clear waits; stories shorten it. */
  graceSeconds?: number
}

/**
 * The master's client takes a finished one-shot off the stage, so a device that opens the table later does not
 * find it. It is bookkeeping and must never cut or swallow a sound a device still plays, so it is late (see
 * `oneShotClearDelay`): while this device plays it, `graceSeconds` after the end of the track, with a clock backstop;
 * otherwise the clock alone. Whatever fires, the stage is published without the sound only if it still holds the
 * same overlay. A failed clear is silent; it is tried once more after the grace, and again whenever the connection
 * comes back, while the stage still holds that overlay. One clear is on its way at a time: one that comes due meanwhile
 * waits for it and then runs, still quiet and still checked against the stage. Players never publish.
 */
export function useOneShotClear({ playingHere, endedHere, graceSeconds = ONE_SHOT_CLEAR_GRACE_SECONDS }: OneShotClearOptions) {
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
  // What the timers depend on, as one string: they are re-armed when any part changes, not only the key.
  const armed = computed(() => {
    const now = current.value
    return now ? `${now.key}|${durationOf.value ?? ''}|${playingHere(now.key)}` : null
  })

  // The key whose duration has passed while this device does not play it.
  const overByClock = shallowRef<string | null>(null)
  const over = computed(() => {
    const now = current.value
    if (!now || now.sound.loop) return null
    if (endedHere(now.key)) return now.key
    return !playingHere(now.key) && overByClock.value === now.key ? now.key : null
  })
  watch(over, (key) => { overKey.value = key }, { immediate: true, flush: 'sync' })

  const timers = new Set<ReturnType<typeof setTimeout>>()
  let clockTimer: ReturnType<typeof setTimeout> | undefined
  let overTimer: ReturnType<typeof setTimeout> | undefined
  let failedKey: string | null = null
  let sending = false
  // A clear that came due while another was on its way: it runs when that one is over, checked against the stage then.
  let waiting: { key: string; retry: boolean } | null = null

  function later(seconds: number, run: () => void) {
    const timer = setTimeout(() => {
      timers.delete(timer)
      run()
    }, seconds * 1000)
    timers.add(timer)
  }

  // After a failure only a retry may try that key again, so the timers that are re-armed by the rollback do not.
  async function clearIfCurrent(key: string, retry = false) {
    if (sending) {
      // The newest one wins; a retry stays a retry when the same key comes due again meanwhile.
      waiting = { key, retry: retry || (waiting?.key === key && waiting.retry) }
      return
    }
    const now = current.value
    if (!now || now.key !== key || (failedKey === key && !retry)) return
    sending = true
    try {
      await publishStage(withoutSound(stages.stageOf(now.gameId)), { quiet: true })
      failedKey = null
    } catch (err) {
      log.warn('clearing the finished sound failed', { err })
      const first = failedKey !== key
      failedKey = key
      if (first) later(graceSeconds, () => void clearIfCurrent(key, true))
    } finally {
      sending = false
      const next = waiting
      waiting = null
      if (next) void clearIfCurrent(next.key, next.retry)
    }
  }

  watch(connection, (state, previous) => {
    if (state === 'ok' && previous !== 'ok' && failedKey) void clearIfCurrent(failedKey, true)
  })

  watch(armed, () => {
    clearTimeout(clockTimer)
    clearTimeout(overTimer)
    clockTimer = undefined
    overTimer = undefined
    const now = current.value
    if (!now) return
    const here = playingHere(now.key)
    const delay = oneShotClearDelay(now.sound, durationOf.value, new Date(), here)
    if (delay !== null) clockTimer = setTimeout(() => void clearIfCurrent(now.key), delay)
    const overIn = here ? null : oneShotOverDelay(now.sound, durationOf.value, new Date())
    if (overIn === 0) overByClock.value = now.key
    else if (overIn !== null) overTimer = setTimeout(() => { overByClock.value = now.key }, overIn)
  }, { immediate: true })

  const stopListening = audio.onOverlayEnded((key) => {
    if (current.value?.key !== key) return
    later(graceSeconds, () => void clearIfCurrent(key))
  })
  onScopeDispose(() => {
    waiting = null
    clearTimeout(clockTimer)
    clearTimeout(overTimer)
    timers.forEach(clearTimeout)
    stopListening()
    overKey.value = null
  })
}
