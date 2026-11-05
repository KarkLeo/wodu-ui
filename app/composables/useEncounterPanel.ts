import { useRoute, useRouter } from 'vue-router'
import { useGameLayout } from '@/components/layout/gameLayoutContext'
import { useTable } from '@/composables/useTable'
import { useEncounterStore } from '@/stores/encounter'

// The routes that render the table's tray, where the panel shows.
const TRAY_ROUTES = new Set(['game', 'game-party'])

/** The master's opener of the encounter panel, in the players panel and the game menu. */
export function useEncounterPanel() {
  const encounter = useEncounterStore()
  const route = useRoute()
  const router = useRouter()
  const { tableRoute } = useTable()
  const layout = useGameLayout()

  /** On the table, opens or closes the panel. Anywhere else it would not show, so this goes to the table with it open. */
  function toggle() {
    if (TRAY_ROUTES.has(String(route.name ?? ''))) {
      encounter.togglePanel()
    } else {
      if (!encounter.panelOpen) encounter.togglePanel()
      void router.push(tableRoute())
    }
    // Opening the panel changes no route, so the phone's players drawer would stay over it.
    layout?.closeMobileOverlays()
  }

  return { toggle }
}
