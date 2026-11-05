import { useEncounterStore } from '@/stores/encounter'
import { useToastsStore } from '@/stores/toasts'
import { addMonster } from '@/transport/encounter'
import type { EncounterMonster } from '@/types/encounter'
import type { LibraryMonster } from '@/types/library'
import { createLogger } from '@/utils/logger'
import { t } from '@/locales'

const log = createLogger('encounter-add')

/**
 * The master adds an instance of a library monster to the encounter. A failure, or an encounter that is
 * not loaded yet, shows the save-failed toast; resolves to the new instance, or undefined on failure.
 */
export function useEncounterAdd() {
  const store = useEncounterStore()
  const toasts = useToastsStore()

  async function add(gameId: string, entry: LibraryMonster): Promise<EncounterMonster | undefined> {
    if (store.gameId !== gameId || store.status !== 'ready') {
      toasts.push(t('errors.encounterSaveFailed'), 'error')
      return undefined
    }
    try {
      return await addMonster(gameId, entry)
    } catch (err) {
      log.warn('add failed', { err })
      toasts.push(t('errors.encounterSaveFailed'), 'error')
      return undefined
    }
  }

  return { add }
}
