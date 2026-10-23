import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import GameLayout from './GameLayout.vue'
import PlayersPanel from './PlayersPanel.vue'
import DiceDrawer from '@/components/DiceDrawer.vue'
import PartyView from '@/features/in-game/PartyView.vue'
import { brann, wren, sage, PARTY, ROLLS, CHANGES } from '@/stories/fixtures'
import { atRoute, DESKTOP_VIEWPORT, withStores } from '@/stories/state'

const PHONE = { viewport: { value: 'phone', isRotated: false } }

const meta = {
  title: 'Screens/Table',
  component: GameLayout,
  parameters: { layout: 'fullscreen' },
  decorators: [withStores({ characters: [...PARTY, sage], rolls: ROLLS, changes: CHANGES })],
  loaders: [atRoute(`/party/${brann.id},${wren.id}`)],
  render: () => ({
    components: { GameLayout, PartyView, PlayersPanel, DiceDrawer },
    template: `
      <GameLayout>
        <PartyView />
        <template #left><PlayersPanel /></template>
        <template #right><DiceDrawer /></template>
      </GameLayout>
    `,
  }),
} satisfies Meta<typeof GameLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  globals: DESKTOP_VIEWPORT,
}

export const DesktopSingleSheet: Story = {
  globals: DESKTOP_VIEWPORT,
  loaders: [atRoute(`/party/${brann.id}`)],
}

// Collapse buttons are display:none below 961px, which hides them from role queries; label queries still find them.
export const DesktopCollapsed: Story = {
  globals: DESKTOP_VIEWPORT,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const buttons = await canvas.findAllByLabelText('Collapse', { selector: 'button' })
    for (const button of buttons) await userEvent.click(button)
    await expect(canvas.getByText('Players · 5')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Log', { selector: 'button' })).toBeInTheDocument()
  },
}

export const Phone: Story = {
  globals: PHONE,
}

export const PhonePlayers: Story = {
  globals: PHONE,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Players' }))
  },
}

export const PhoneLog: Story = {
  globals: PHONE,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Dice' }))
  },
}
