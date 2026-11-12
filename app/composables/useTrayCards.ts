import { computed, type Component, type ComputedRef } from 'vue'
import { useTable } from '@/composables/useTable'
import EncounterPanel from '@/features/encounter/EncounterPanel.vue'
import ScenesPanel from '@/features/stage/ScenesPanel.vue'
import SoundsPanel from '@/features/stage/SoundsPanel.vue'
import { useEncounterStore } from '@/stores/encounter'
import { useToolPanelsStore } from '@/stores/toolPanels'
import { currentUser } from '@/transport/auth'
import { isMaster } from '@/utils/permissions'
import { t } from '@/locales'
import type { ToolPanelKey } from '@/types/toolPanels'

export interface TrayCard {
  key: ToolPanelKey
  component: Component
  closeLabel: string
  close: () => void
}

/** The master's open cards, in the order of their rows, and whether the table's tray shows with no sheet open. */
export function useTrayCards(): { cards: ComputedRef<TrayCard[]>; shown: ComputedRef<boolean> } {
  const encounter = useEncounterStore()
  const panels = useToolPanelsStore()
  const { game } = useTable()

  const cards = computed<TrayCard[]>(() => {
    if (!isMaster(game.value, currentUser.value?.id ?? null)) return []
    const list: TrayCard[] = []
    if (encounter.panelOpen) {
      list.push({ key: 'encounter', component: EncounterPanel, closeLabel: t('encounter.close'), close: () => encounter.togglePanel() })
    }
    if (panels.open.scenes) {
      list.push({ key: 'scenes', component: ScenesPanel, closeLabel: t('stage.scenes.close'), close: () => panels.close('scenes') })
    }
    if (panels.open.sounds) {
      list.push({ key: 'sounds', component: SoundsPanel, closeLabel: t('stage.sounds.close'), close: () => panels.close('sounds') })
    }
    return list
  })

  return { cards, shown: computed(() => cards.value.length > 0) }
}
