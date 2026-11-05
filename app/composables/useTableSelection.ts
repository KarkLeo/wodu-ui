import { computed } from 'vue'
import { useCharactersStore } from '@/stores/characters'
import { useEncounterStore } from '@/stores/encounter'
import { currentUser } from '@/transport/auth'
import { isMaster } from '@/utils/permissions'
import { useTable } from '@/composables/useTable'
import type { TableSelection } from '@/types/encounter'

/**
 * The one thing selected at the table. A selected monster (alive, still in the panel) wins; otherwise
 * it is the active character in scope. Selecting a monster leaves `activeId` alone, so deselecting
 * returns to that character.
 */
export function useTableSelection() {
  const characters = useCharactersStore()
  const encounter = useEncounterStore()

  const selection = computed<TableSelection>(() => {
    const monster = encounter.selectedMonsterId ? encounter.monsterById(encounter.selectedMonsterId) : undefined
    if (monster && monster.diedAt === undefined) return { kind: 'monster', id: monster.id }
    const id = characters.activeId
    if (id && characters.inScope(id)) return { kind: 'character', id }
    return null
  })

  function selectMonster(id: string) {
    encounter.selectMonster(encounter.selectedMonsterId === id ? null : id)
  }

  function selectCharacter(id: string | null) {
    characters.setActive(id)
    encounter.selectMonster(null)
  }

  return { selection, selectMonster, selectCharacter }
}

/** Whether the encounter panel is on screen: the master's open tray at a game table. */
export function useEncounterPanelShown() {
  const encounter = useEncounterStore()
  const { game } = useTable()
  return computed(() => encounter.panelOpen && isMaster(game.value, currentUser.value?.id ?? null))
}
