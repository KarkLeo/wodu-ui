import { computed, type ComputedRef } from 'vue'
import { useTable } from '@/composables/useTable'
import { withScene, withoutScene } from '@/domain/stage'
import { useStageStore } from '@/stores/stage'
import { publishStage } from '@/transport/stage'
import type { Scene } from '@/types/stage'

/** The master's switches for what the open game's table shows. Failures are thrown for the caller to show. */
export function useStageControl(): {
  activeSceneId: ComputedRef<string | null>
  turnOnScene: (scene: Scene) => Promise<void>
  turnOffScene: () => Promise<void>
} {
  const { gameId } = useTable()
  const stages = useStageStore()

  const activeSceneId = computed(() => (gameId.value ? stages.stageOf(gameId.value).scene?.id ?? null : null))

  function openGame(): string {
    if (!gameId.value) throw new Error('no game table is open')
    return gameId.value
  }

  return {
    activeSceneId,
    turnOnScene: (scene) => {
      const id = openGame()
      return publishStage(withScene(stages.stageOf(id), scene))
    },
    turnOffScene: () => {
      const id = openGame()
      return publishStage(withoutScene(stages.stageOf(id)))
    },
  }
}
