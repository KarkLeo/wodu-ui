import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import StatsPanel from './StatsPanel.vue'
import { brann, wren } from '@/stories/fixtures'
import { withStores } from '@/stories/state'
import { useActiveCharacter } from '@/composables/useActiveCharacter'

const meta = {
  title: 'Panels/StatsPanel',
  component: StatsPanel,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { controls: { disable: true } },
  decorators: [withStores({ characters: [brann, wren] })],
} satisfies Meta<typeof StatsPanel>

export default meta
type Story = StoryObj<typeof StatsPanel>

const forCharacter = (id: string): Story['render'] => () => ({
  components: { StatsPanel },
  setup() {
    const { char, dispatch } = useActiveCharacter(() => id)
    return { char, dispatch }
  },
  template: '<StatsPanel v-if="char" :char="char" :dispatch="dispatch" />',
})

export const Fighter: Story = {
  render: forCharacter(brann.id),
}

export const WithBuff: Story = {
  render: forCharacter(wren.id),
}

export const ModifiersOpen: Story = {
  render: forCharacter(wren.id),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: /^DEX/ }))
    await expect(await within(document.body).findByText('Cat’s grace')).toBeInTheDocument()
  },
}
