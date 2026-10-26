import { computed, ref } from 'vue'
import { expect } from 'storybook/test'
import type { Decorator } from '@storybook/vue3-vite'
import type { Character } from '@/types/character'
import type { GameMember } from '@/types/game'
import { provideSheetReadonly } from '@/composables/useSheetReadonly'
import { useCharactersStore } from '@/stores/characters'
import { olden } from './fixtures'
import { withGameTable } from './state'

/** Seva runs Olden's Tower; the story user plays there and cannot edit Seva's characters. */
export const TEAMMATE_NAME = 'Seva'

/**
 * The given characters sit at Olden's table as Seva's, so the story user sees them read-only.
 * `members` replaces the table's member list (e.g. `[]` for an owner whose name is not loaded).
 */
export function asTeammate(characters: Character[], members?: GameMember[]): Decorator {
  const meta = Object.fromEntries(characters.map(c => [c.id, { owner: olden.master, game: olden.id }]))
  return withGameTable(olden, characters, meta, members)
}

/** What InGameView provides around a panel rendered on its own: read-only exactly when the user cannot edit `id`. */
export function sheetFor(id: string): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      const characters = useCharactersStore()
      provideSheetReadonly(computed(() => !characters.canEditCharacter(id)))
    },
    template: '<story />',
  })
}

/** A read-only sheet around a piece rendered on its own. */
export const readonlySheet: Decorator = (story) => ({
  components: { story },
  setup() {
    provideSheetReadonly(ref(true))
  },
  template: '<story />',
})

const CONTROLS = 'button, input, textarea, select, [role="button"], [role="spinbutton"], [contenteditable="true"]'
// Tabs, the triggers of info popovers whose read-only content is checked by opening them (stats, damage, armor),
// the abilities reference and a bottom sheet's close button only show things. The coin chip is not exempt: on a
// read-only sheet it must not be a button at all, since its popover holds only the coin Stepper.
const VIEW_ONLY = [
  '[role="tab"]',
  '.stat-chip',
  '.status-chip.kind-damage',
  '.status-chip.kind-dim',
  '.status-chip.kind-armor',
  '.abilities-section-link',
  '.bs-close',
].join(', ')

/** Fails with the names of any control under `root` that could change the character. */
export async function expectNoEditControls(root: ParentNode): Promise<void> {
  const offenders = [...root.querySelectorAll<HTMLElement>(CONTROLS)]
    .filter(el => !el.matches(VIEW_ONLY))
    .map(el => el.getAttribute('aria-label') || el.textContent?.trim() || el.outerHTML.slice(0, 80))
  await expect(offenders).toEqual([])
}
