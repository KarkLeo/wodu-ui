import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useTable } from '@/composables/useTable'
import { isGameMaster } from '@/composables/useRouteRecheck'
import { fileUrl, revealKey, shouldReveal } from '@/domain/stage'
import { useStageStore } from '@/stores/stage'
import { currentUser } from '@/transport/auth'
import { onlineDataReady } from '@/transport/bootstrap'
import { mode } from '@/transport/mode'
import { pb } from '@/transport/pb'

export interface ShownImage {
  url: string
  caption: string | null
  /** `revealKey`: changes with every showing, also of the same image. */
  key: string
}

// One state per app: the card, the tray and the reveal all read it.
const revealed = ref(false)

/** The key seen last at the open table: `undefined` until the first value (a first value of null included). */
let seen: string | null | undefined
let openGame: string | null = null

function resetSeen(): void {
  seen = undefined
  openGame = null
  revealed.value = false
}

/** For stories: forget everything seen and close the large view. */
export function resetShownImage(): void {
  resetSeen()
}

/**
 * The image the master shows at the open table (the open game's stage, online and signed in only). Safe to call
 * from several places. It is always content, never atmosphere: no device switch turns it off.
 */
export function useShownImage(): {
  image: ComputedRef<ShownImage | null>
  revealed: Ref<boolean>
  open(): void
  close(): void
} {
  const stages = useStageStore()
  const { gameId } = useTable()

  const image = computed<ShownImage | null>(() => {
    const id = gameId.value
    // Until the online data is here the stores are empty, which looks like a table with nothing shown.
    if (!id || mode.value !== 'online' || !currentUser.value || !onlineDataReady.value) return null
    const shown = stages.stageOf(id).image
    if (!shown) return null
    return { url: fileUrl(pb.baseURL, shown.file), caption: shown.caption, key: revealKey(shown) }
  })

  return {
    image,
    revealed,
    open() { if (image.value) revealed.value = true },
    close() { revealed.value = false },
  }
}

/**
 * Call once, in `app.vue`: opens the large view on a non-master's device when the shown image's key changes at an
 * open table, by a live change or by a reconnect snapshot alike. What is found when the table opens never reveals.
 * Leaving the table, switching the mode or signing out forgets what was seen; no image closes the view.
 */
export function useShownImageReveal(): void {
  const { image } = useShownImage()
  const { gameId } = useTable()
  resetSeen()

  watch(
    () => [image.value?.key ?? null, gameId.value, mode.value, currentUser.value?.id ?? null, onlineDataReady.value] as const,
    ([key, id, m, user, ready]) => {
      // Not ready counts as no open table: what was seen starts with the first value after the data has loaded.
      const game = id && m === 'online' && user && ready ? id : null
      if (game !== openGame) {
        openGame = game
        seen = undefined
        revealed.value = false
      }
      if (!game) return
      if (shouldReveal(seen, key, isGameMaster(game))) revealed.value = true
      seen = key
      if (key === null) revealed.value = false
    },
    { immediate: true, flush: 'sync' },
  )
}
