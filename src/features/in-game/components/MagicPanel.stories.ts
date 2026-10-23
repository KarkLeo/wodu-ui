import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import MagicPanel from './MagicPanel.vue'
import { mirel } from '@/stories/fixtures'
import { withStores } from '@/stories/state'
import { applyCommand } from '@/domain/reducer'
import { useActiveCharacter } from '@/composables/useActiveCharacter'

// Mirel with one more dose in the backpack, so she can drink past the daily limit.
const mirelStocked = applyCommand(mirel, { type: 'BUY_ITEM', templateId: 'mercury' }).character

const meta = {
  title: 'Panels/MagicPanel',
  component: MagicPanel,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof MagicPanel>

export default meta
type Story = StoryObj<typeof MagicPanel>

const render: Story['render'] = () => ({
  components: { MagicPanel },
  setup() {
    const { char, dispatch } = useActiveCharacter(() => mirel.id)
    return { char, dispatch }
  },
  template: '<MagicPanel v-if="char" :char="char" :ability-ids="char.abilityIds" :dispatch="dispatch" />',
})

const drink = (name: string) => async (canvasElement: HTMLElement) => {
  const button = within(canvasElement).getByRole('button', { name })
  await userEvent.click(button)
}

export const Wizard: Story = {
  render,
  decorators: [withStores({ characters: [mirel] })],
}

export const AtDailyLimit: Story = {
  render,
  decorators: [withStores({ characters: [mirel] })],
  play: async ({ canvasElement }) => {
    await drink('Drink quicksilver')(canvasElement)
    await expect(await within(canvasElement).findByText('Next dose requires a CON roll.')).toBeVisible()
  },
}

export const OverdoseConfirm: Story = {
  render,
  decorators: [withStores({ characters: [mirelStocked] })],
  play: async ({ canvasElement }) => {
    await drink('Drink quicksilver')(canvasElement)
    await drink('Drink anyway')(canvasElement)
    await expect(await within(document.body).findByRole('button', { name: 'Roll CON and drink' })).toBeVisible()
  },
}

export const NewSpirit: Story = {
  render,
  decorators: [withStores({ characters: [mirel] })],
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Spirit' }))
    await expect(await within(canvasElement).findByText('New spirit')).toBeVisible()
  },
}
