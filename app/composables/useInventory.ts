import type { InventoryItem } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'

type Dispatcher = (cmd: CharacterCommand) => void

export function useInventory(dispatch: Dispatcher) {
  return {
    buy: (templateId: string) => dispatch({ type: 'BUY_ITEM', templateId }),
    receive: (item: Omit<InventoryItem, 'id'>) => dispatch({ type: 'RECEIVE_ITEM', item }),
    addCustom: (name: string, price?: number, notes?: string, consumable?: boolean, quantity?: number) =>
      dispatch({ type: 'ADD_CUSTOM_ITEM', name, price, notes, consumable, quantity }),
    editCustom: (itemId: string, fields: { name: string; price?: number; notes?: string; consumable?: boolean; quantity?: number }) =>
      dispatch({ type: 'EDIT_CUSTOM_ITEM', itemId, ...fields }),
    remove: (itemId: string) => dispatch({ type: 'REMOVE_ITEM', itemId }),
    equip: (itemId: string) => dispatch({ type: 'EQUIP_ITEM', itemId }),
    unequip: (itemId: string) => dispatch({ type: 'UNEQUIP_ITEM', itemId }),
    setCoins: (amount: number) => dispatch({ type: 'SET_COINS', amount }),
    use: (itemId: string) => dispatch({ type: 'USE_ITEM', itemId }),
  }
}
