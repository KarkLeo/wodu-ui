import { useToolPanel } from '@/composables/useToolPanel'

/** The master's opener of the encounter panel, the Encounter row of `MasterTools`. */
export function useEncounterPanel() {
  return useToolPanel('encounter')
}
