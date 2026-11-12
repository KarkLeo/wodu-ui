import { computed, type ComputedRef } from 'vue'
import { useTable } from '@/composables/useTable'
import { withScene, withSound, withoutScene, withoutSound } from '@/domain/stage'
import { useStageStore } from '@/stores/stage'
import { publishStage } from '@/transport/stage'
import type { Scene, Sound } from '@/types/stage'

/** The master's switches for what the open game's table shows. Failures are thrown for the caller to show. */
export function useStageControl(): {
  activeSceneId: ComputedRef<string | null>
  turnOnScene: (scene: Scene) => Promise<void>
  turnOffScene: () => Promise<void>
  playingSoundId: ComputedRef<string | null>
  playSound: (sound: Sound) => Promise<void>
  stopSound: () => Promise<void>
} {
  const { gameId } = useTable()
  const stages = useStageStore()

  const activeSceneId = computed(() => (gameId.value ? stages.stageOf(gameId.value).scene?.id ?? null : null))

  const playingSoundId = computed(() => (gameId.value ? stages.stageOf(gameId.value).sound?.id ?? null : null))

  function openGame(): string {
    if (!gameId.value) throw new Error('no game table is open')
    return gameId.value
  }

  return {
    activeSceneId,
    playingSoundId,
    turnOnScene: (scene) => {
      const id = openGame()
      return publishStage(withScene(stages.stageOf(id), scene))
    },
    turnOffScene: () => {
      const id = openGame()
      return publishStage(withoutScene(stages.stageOf(id)))
    },
    playSound: (sound) => {
      const id = openGame()
      return publishStage(withSound(stages.stageOf(id), sound, new Date().toISOString()))
    },
    stopSound: () => {
      const id = openGame()
      return publishStage(withoutSound(stages.stageOf(id)))
    },
  }
}
