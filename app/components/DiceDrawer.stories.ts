import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import DiceDrawer from './DiceDrawer.vue'
import { brann, PARTY, ROLLS, CHANGES } from '@/stories/fixtures'
import { asActive, DESKTOP_VIEWPORT, inLayout, withStores } from '@/stories/state'

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
