import type { ComputedRef } from 'vue'
import type { Character, InventoryItem } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'

type Dispatcher = (cmd: CharacterCommand) => void

export function useInventory(_char: ComputedRef<Character | undefined>, dispatch: Dispatcher) {
  return {
    buy: (templateId: string) => dispatch({ type: 'BUY_ITEM', templateId }),
    receive: (item: Omit<InventoryItem, 'id'>) => dispatch({ type: 'RECEIVE_ITEM', item }),
    addCustom: (name: string, price?: number) => dispatch({ type: 'ADD_CUSTOM_ITEM', name, price }),
    remove: (itemId: string) => dispatch({ type: 'REMOVE_ITEM', itemId }),
    equip: (itemId: string) => dispatch({ type: 'EQUIP_ITEM', itemId }),
    unequip: (itemId: string) => dispatch({ type: 'UNEQUIP_ITEM', itemId }),
    setCoins: (amount: number) => dispatch({ type: 'SET_COINS', amount }),
  }
}
