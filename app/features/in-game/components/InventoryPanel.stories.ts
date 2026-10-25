import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import InventoryPanel from './InventoryPanel.vue'
import { brann, mirel, sage, wren } from '@/stories/fixtures'
import { withStores } from '@/stories/state'
import { useActiveCharacter } from '@/composables/useActiveCharacter'

const meta = {
  title: 'Panels/InventoryPanel',
  component: InventoryPanel,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { controls: { disable: true } },
  decorators: [withStores({ characters: [brann, wren, mirel, sage] })],
} satisfies Meta<typeof InventoryPanel>

export default meta
type Story = StoryObj<typeof InventoryPanel>

const forCharacter = (id: string): Story['render'] => () => ({
  components: { InventoryPanel },
  setup() {
    const { char, dispatch } = useActiveCharacter(() => id)
    return { char, dispatch }
  },
  template: '<InventoryPanel v-if="char" :char="char" :dispatch="dispatch" />',
})

const body = () => within(document.body)

export const EquippedGear: Story = {
  render: forCharacter(brann.id),
}

export const Empty: Story = {
  render: forCharacter(sage.id),
}

export const Quicksilver: Story = {
  render: forCharacter(mirel.id),
}

export const MultipleWeapons: Story = {
  render: forCharacter(wren.id),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const bow = canvas.getByText('Shortbow').closest<HTMLElement>('.inv-item')!
    await userEvent.click(within(bow).getByRole('button', { name: 'Equip' }))
    await expect(await canvas.findByText('Multiple weapons equipped.')).toBeVisible()
  },
}

export const CatalogOpen: Story = {
  render: forCharacter(brann.id),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Catalog' }))
    await expect(await body().findByText('Gear catalog')).toBeVisible()
  },
}

export const AskTheGm: Story = {
  render: forCharacter(sage.id),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Catalog' }))
    const [ask] = await body().findAllByRole('button', { name: 'Ask' })
    await userEvent.click(ask!)
    await expect(await body().findByText('Not enough coins')).toBeVisible()
  },
}

export const CustomItemOpen: Story = {
  render: forCharacter(brann.id),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Custom item' }))
    await expect(await body().findByRole('dialog')).toBeVisible()
  },
}
