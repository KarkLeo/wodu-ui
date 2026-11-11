import { computed, type ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameLayout } from '@/components/layout/gameLayoutContext'
import { useTable } from '@/composables/useTable'
import { useEncounterStore } from '@/stores/encounter'
import { useToolPanelsStore } from '@/stores/toolPanels'
import type { ToolPanelKey } from '@/types/toolPanels'

// The routes that render the table's tray, where the cards show.
const TRAY_ROUTES = new Set(['game', 'game-party'])

/** The master's opener of one tray card, a row of `MasterTools`. */
export function useToolPanel(key: ToolPanelKey): { open: ComputedRef<boolean>; toggle: () => void } {
  const encounter = useEncounterStore()
  const panels = useToolPanelsStore()
  const route = useRoute()
  const router = useRouter()
  const { tableRoute } = useTable()
  const layout = useGameLayout()

  const open = computed(() => (key === 'encounter' ? encounter.panelOpen : panels.open[key]))

  function flip() {
    if (key === 'encounter') encounter.togglePanel()
    else panels.toggle(key)
  }

  /** On the table, opens or closes the card. Anywhere else it would not show, so this goes to the table with it open. */
  function toggle() {
    if (TRAY_ROUTES.has(String(route.name ?? ''))) {
      flip()
    } else {
      if (!open.value) flip()
      void router.push(tableRoute())
    }
    // Opening a card changes no route, so the phone's players drawer would stay over it.
    layout?.closeMobileOverlays()
  }

  return { open, toggle }
}
