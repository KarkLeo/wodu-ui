import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import ScenesPanel from './ScenesPanel.vue'

const meta = {
  title: 'Features/Stage/ScenesPanel',
  component: ScenesPanel,
  globals: { viewport: { value: 'phone', isRotated: false } },
} satisfies Meta<typeof ScenesPanel>

export default meta
type Story = StoryObj<typeof meta>

/** The placeholder card: its title only, until the scenes list arrives. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: 'Scenes' })).toBeVisible()
  },
}
