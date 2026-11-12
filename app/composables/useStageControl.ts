import { computed, type ComputedRef } from 'vue'
import { oneShotIsOver } from '@/composables/useOneShotClear'
import { useTable } from '@/composables/useTable'
import { overlayKey, withImage, withScene, withSound, withoutImage, withoutScene, withoutSound } from '@/domain/stage'
import { useStageStore } from '@/stores/stage'
import { publishStage } from '@/transport/stage'
import type { Scene, Sound, TableImage } from '@/types/stage'

/** The master's switches for what the open game's table shows. Failures are thrown for the caller to show. */
export function useStageControl(): {
  activeSceneId: ComputedRef<string | null>
  turnOnScene: (scene: Scene) => Promise<void>
  turnOffScene: () => Promise<void>
  playingSoundId: ComputedRef<string | null>
  playSound: (sound: Sound) => Promise<void>
  stopSound: () => Promise<void>
  shownImageId: ComputedRef<string | null>
  showImage: (image: TableImage, withCaption: boolean) => Promise<void>
  hideImage: () => Promise<void>
} {
  const { gameId } = useTable()
  const stages = useStageStore()

  const activeSceneId = computed(() => (gameId.value ? stages.stageOf(gameId.value).scene?.id ?? null : null))

  // A one-shot that is over on this device is not playing for the row, although the stage holds it until the clear:
  // Play then plays it again at once instead of stopping something nobody hears.
  const playingSoundId = computed(() => {
    const sound = gameId.value ? stages.stageOf(gameId.value).sound : null
    if (!sound || (!sound.loop && oneShotIsOver(overlayKey(sound)))) return null
    return sound.id
  })

  const shownImageId = computed(() => (gameId.value ? stages.stageOf(gameId.value).image?.id ?? null : null))

  function openGame(): string {
    if (!gameId.value) throw new Error('no game table is open')
    return gameId.value
  }

  return {
    activeSceneId,
    playingSoundId,
    shownImageId,
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
    showImage: (image, withCaption) => {
      const id = openGame()
      return publishStage(withImage(stages.stageOf(id), image, withCaption, new Date().toISOString()))
    },
    hideImage: () => {
      const id = openGame()
      return publishStage(withoutImage(stages.stageOf(id)))
    },
  }
}
