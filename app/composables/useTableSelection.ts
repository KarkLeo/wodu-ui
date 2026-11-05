import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCharactersStore } from '@/stores/characters'
import { useEncounterStore } from '@/stores/encounter'
import { currentUser } from '@/transport/auth'
import { isMaster } from '@/utils/permissions'
import { useTable } from '@/composables/useTable'
import type { TableSelection } from '@/types/encounter'

/**
 * The one thing selected at the table. A selected monster (alive, still in the panel, of this table, and I am its
 * master) wins; otherwise it is the active character, in scope and with its sheet open. Selecting a monster leaves
 * `activeId` alone, so deselecting returns to that character.
 */
export function useTableSelection() {
  const characters = useCharactersStore()
  const encounter = useEncounterStore()
  const route = useRoute()
  const { game } = useTable()

  // `activeId` outlives the sheets when the master goes to a library and comes back.
  const openSheets = computed(() => String(route.params.ids ?? '').split(','))
  const monsterHere = computed(() => {
    const g = game.value
    return !!g && encounter.gameId === g.id && isMaster(g, currentUser.value?.id ?? null)
  })

  const selection = computed<TableSelection>(() => {
    const monster = monsterHere.value && encounter.selectedMonsterId ? encounter.monsterById(encounter.selectedMonsterId) : undefined
    if (monster && monster.diedAt === undefined) return { kind: 'monster', id: monster.id }
    const id = characters.activeId
    if (id && characters.inScope(id) && openSheets.value.includes(id)) return { kind: 'character', id }
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
