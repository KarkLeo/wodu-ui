import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import AbilitiesPanel from './AbilitiesPanel.vue'
import { brann, mirel, wren } from '@/stories/fixtures'
import { withStores } from '@/stories/state'
import { useActiveCharacter } from '@/composables/useActiveCharacter'

const meta = {
  title: 'Panels/AbilitiesPanel',
  component: AbilitiesPanel,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { controls: { disable: true } },
  decorators: [withStores({ characters: [brann, wren, mirel] })],
} satisfies Meta<typeof AbilitiesPanel>

export default meta
type Story = StoryObj<typeof AbilitiesPanel>

const forCharacter = (id: string): Story['render'] => () => ({
  components: { AbilitiesPanel },
  setup() {
    const { char } = useActiveCharacter(() => id)
    return { char }
  },
  template: '<AbilitiesPanel v-if="char" :char="char" />',
})

export const Fighter: Story = {
  render: forCharacter(brann.id),
}

export const Thief: Story = {
  render: forCharacter(wren.id),
}

export const Wizard: Story = {
  render: forCharacter(mirel.id),
}

export const AllAbilitiesSheet: Story = {
  render: forCharacter(brann.id),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'all →' }))
    await expect(await within(document.body).findByRole('dialog', { name: 'All abilities' })).toBeVisible()
  },
}
