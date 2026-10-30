import { libraryItemToInventory } from '@/domain/library'
import { useCharactersStore } from '@/stores/characters'
import { useToastsStore } from '@/stores/toasts'
import type { LibraryItem } from '@/types/library'
import { t } from '@/locales'

export function useGiveItem() {
  const characters = useCharactersStore()
  const toasts = useToastsStore()

  /** Resolves to whether the item was delivered. `announce: false` leaves the confirmation to the caller. */
  async function give(characterId: string, item: LibraryItem, { announce = true } = {}): Promise<boolean> {
    const target = characters.getById(characterId)
    if (!target) return false
    // dispatch refuses silently apart from its own toast, and throws after toasting a failed write:
    // either way nothing was delivered, so nothing is announced.
    const editable = characters.canEditCharacter(characterId)
    try {
      await characters.dispatch(characterId, { type: 'RECEIVE_ITEM', item: libraryItemToInventory(item) })
    } catch {
      return false
    }
    if (editable && announce) toasts.push(t('library.items.give.done', { character: target.name, item: item.name }), 'info')
    return editable
  }

  return { give }
}
