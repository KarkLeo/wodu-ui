import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import DiceDrawer from './DiceDrawer.vue'
import { brann, crookhollow, GAMES, inGame, MEMBERS, oda, olden, PARTY, ROLLS, CHANGES, wren } from '@/stories/fixtures'
import { asActive, DESKTOP_VIEWPORT, inLayout, withStores } from '@/stories/state'
import { asTeammate } from '@/stories/readonly'
import { useCharactersStore } from '@/stores/characters'
import { setScope } from '@/transport/scope'

// Same width GameLayout gives the right column; collapse and rail only exist above 960px.
const desktopColumn: Decorator = (story) => ({
  components: { story },
  template: '<div style="width: 340px; height: 100%; display: flex; justify-content: flex-end"><story /></div>',
})

const meta = {
  title: 'Layout/DiceDrawer',
  component: DiceDrawer,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (story) => ({ components: { story }, template: '<div style="height: 100dvh; display: flex; flex-direction: column; align-items: flex-end"><story /></div>' }),
    withStores({ characters: PARTY, rolls: ROLLS, changes: CHANGES }),
  ],
} satisfies Meta<typeof DiceDrawer>

export default meta
type Story = StoryObj<typeof meta>

const pickFilter = (...names: string[]): Story['play'] => async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  for (const name of names) {
    const option = await canvas.findByRole('radio', { name })
    await userEvent.click(option)
    await expect(option).toHaveAttribute('aria-checked', 'true')
  }
}

export const Default: Story = {
  decorators: [asActive(brann.id)],
}

export const RollsOnly: Story = {
  decorators: [asActive(brann.id)],
  play: pickFilter('Rolls'),
}

export const ChangesOnly: Story = {
  decorators: [asActive(brann.id)],
  play: pickFilter('Changes'),
}

export const All: Story = {
  decorators: [asActive(brann.id)],
  play: pickFilter('Rolls', 'All'),
}

export const EmptyLog: Story = {
  decorators: [asActive(brann.id), withStores({ characters: PARTY })],
}

export const NoActiveCharacter: Story = {
  decorators: [asActive(null)],
}

export const AdvantageArmed: Story = {
  decorators: [asActive(brann.id)],
  play: async ({ canvasElement }) => {
    const chip = await within(canvasElement).findByRole('button', { name: 'Advantage' })
    await userEvent.click(chip)
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
  },
}

export const InvalidNotation: Story = {
  decorators: [asActive(brann.id)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = await canvas.findByPlaceholderText('2d6+1, d20, 4d6…')
    await userEvent.clear(input)
    await userEvent.type(input, 'three dice{enter}')
    await expect(await canvas.findByText(/Invalid format/)).toBeInTheDocument()
  },
}

export const InLayout: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [asActive(brann.id), inLayout(), desktopColumn],
}

export const Rail: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [asActive(brann.id), inLayout({ right: true }), desktopColumn],
}

export const RailEmpty: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [asActive(brann.id), inLayout({ right: true }), desktopColumn, withStores({ characters: PARTY })],
}

export const CollapseToRail: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [asActive(brann.id), inLayout(), desktopColumn],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByLabelText('Collapse', { selector: 'button' }))
    await expect(await canvas.findByLabelText('Log', { selector: 'button' })).toBeInTheDocument()
  },
}

/** The active sheet is a teammate's (read-only): the drawer offers no roll for it and says why. */
export const ReadOnlyActive: Story = {
  decorators: [asActive(oda.id), asTeammate(PARTY)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(`You can’t roll for ${oda.name}.`)).toBeVisible()
    await expect(canvas.getByRole('button', { name: '2d6' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Advantage' })).toBeDisabled()
    await expect(canvas.getByPlaceholderText('2d6+1, d20, 4d6…')).toBeDisabled()
  },
}

/**
 * Brann, active at Crookhollow's table, must not follow the player to Olden's: going home and opening
 * the other table leaves no active character, and none from another table is offered a roll.
 */
export const ActiveLeftOnAnotherTable: Story = {
  tags: ['no-visual'],
  decorators: [
    asActive(brann.id),
    withStores({
      characters: [brann, wren],
      games: GAMES,
      members: MEMBERS,
      meta: { [brann.id]: inGame(crookhollow), [wren.id]: inGame(olden) },
      scope: { kind: 'game', gameId: crookhollow.id },
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const store = useCharactersStore()
    await expect(canvas.getByRole('button', { name: '2d6' })).toBeEnabled()

    setScope({ kind: 'home' })
    setScope({ kind: 'game', gameId: olden.id })
    await expect(store.activeId).toBeNull()
    await waitFor(() => expect(canvas.getByRole('button', { name: '2d6' })).toBeDisabled())
    await expect(canvas.getByText('Open a character sheet to roll.')).toBeVisible()

    // Even set active again by hand, a character from another table gets no roll here.
    store.setActive(brann.id)
    await waitFor(() => expect(canvas.getByRole('button', { name: '2d6' })).toBeDisabled())
    await expect(canvas.queryByText(`You can’t roll for ${brann.name}.`)).toBeNull()
  },
}
