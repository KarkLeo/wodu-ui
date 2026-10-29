import { libraryItemToInventory } from '@/domain/library'
import { useCharactersStore } from '@/stores/characters'
import { useToastsStore } from '@/stores/toasts'
import type { LibraryItem } from '@/types/library'
import { t } from '@/locales'

export function useGiveItem() {
  const characters = useCharactersStore()
  const toasts = useToastsStore()

  async function give(characterId: string, item: LibraryItem): Promise<void> {
    const target = characters.getById(characterId)
    if (!target) return
    // dispatch refuses silently apart from its own toast, and throws after toasting a failed write:
    // either way nothing was delivered, so nothing is announced.
    const editable = characters.canEditCharacter(characterId)
    try {
      await characters.dispatch(characterId, { type: 'RECEIVE_ITEM', item: libraryItemToInventory(item) })
    } catch {
      return
    }
    if (editable) toasts.push(t('library.items.give.done', { character: target.name, item: item.name }), 'info')
  }

  return { give }
}
