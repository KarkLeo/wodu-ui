import { computed, ref } from 'vue'
import type { Character, InventoryItem } from '@/types/character'
import type { CharacterCommand } from '@/domain/commands'
import { useInventory } from './useInventory'
import { useDiceRoller } from './useDiceRoller'
import { isQuicksilverOverdose, effectiveStat } from '@/utils/derived'
import { findGearTemplate } from '@/data/gear'
import { createLogger } from '@/utils/logger'
import { t } from '@/locales'

const log = createLogger('mercury')

type Dispatcher = (cmd: CharacterCommand) => void

export function useMercury(getChar: () => Character, dispatch: Dispatcher) {
  const inv = useInventory(dispatch)
  const { rollStat } = useDiceRoller()

  const count = computed(() => getChar().quicksilverCount ?? 0)
  const limit = computed(() => getChar().level)
  const isOverdose = computed(() => isQuicksilverOverdose(getChar()))

  const mercuryItem = computed<InventoryItem | null>(() =>
    getChar().inventory.find(i => {
      if ((i.quantity ?? 1) <= 0) return false
      const tpl = i.templateId ? findGearTemplate(i.templateId) : undefined
      return tpl?.useEffect === 'quicksilver'
    }) ?? null,
  )

  const pendingItemId = ref<string | null>(null)
  const overdoseOpen = computed({
    get: () => pendingItemId.value !== null,
    set: v => { if (!v) pendingItemId.value = null },
  })

  function drink(itemId: string) {
    if (isOverdose.value) {
      pendingItemId.value = itemId
      return
    }
    inv.use(itemId)
  }

  function reset() {
    dispatch({ type: 'RESET_QUICKSILVER' })
    pendingItemId.value = null
  }

  async function rollOverdose() {
    const id = pendingItemId.value
    if (!id) return
    const char = getChar()
    try {
      await rollStat(
        char.id,
        char.name,
        'con',
        t('inGame.inventory.overdose.rollLabel'),
        effectiveStat(char, 'con'),
      )
    } catch (err) {
      log.error('overdose roll failed', err)
    }
    inv.use(id)
    pendingItemId.value = null
  }

  function cancel() {
    pendingItemId.value = null
  }

  return {
    count,
    limit,
    isOverdose,
    mercuryItem,
    overdoseOpen,
    drink,
    reset,
    rollOverdose,
    cancel,
  }
}
