import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import CatalogSheet from './CatalogSheet.vue'
import { useActiveCharacter } from '@/composables/useActiveCharacter'
import { brann, sage, wren } from '@/stories/fixtures'
import { modalDocs } from '@/stories/docs'
import { withStores } from '@/stories/state'

const meta = {
  title: 'Panels/InventoryPanel/CatalogSheet',
  parameters: { docs: modalDocs, controls: { disable: true } },
  component: CatalogSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  decorators: [withStores({ characters: [brann, wren, sage] })],
} satisfies Meta<typeof CatalogSheet>

export default meta
type Story = StoryObj<typeof CatalogSheet>

/** The sheet over a real character, so a purchase changes the coins and the inventory it reads. */
const forCharacter = (id: string): Story['render'] => () => ({
  components: { CatalogSheet },
  setup() {
    const { char, dispatch } = useActiveCharacter(() => id)
    const open = ref(true)
    const asked = ref('')
    const buy = (templateId: string) => dispatch({ type: 'BUY_ITEM', templateId })
    return { char, open, asked, buy }
  },
  template: `
    <CatalogSheet
      v-if="char"
      v-model:open="open"
      :coins="char.coins"
      :inventory="char.inventory"
      @buy="buy"
      @request-gm="asked = $event"
    />
    <output data-testid="asked">{{ asked }}</output>
  `,
})

const sheet = (canvasElement: HTMLElement) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Gear catalog' })
const rowOf = (dialog: HTMLElement, name: string) =>
  within(dialog).getByText(name).closest<HTMLElement>('.cat-item')!
const coins = (dialog: HTMLElement) => dialog.querySelector('.catalog-coins-value')!.textContent!.trim()

export const Default: Story = {
  render: forCharacter(sage.id),
  decorators: [withStores({ characters: [{ ...sage, coins: 30 }] })],
  play: async ({ canvasElement }) => {
    const dialog = await sheet(canvasElement)
    await expect(coins(dialog)).toBe('30 s.')
    await expect(dialog.querySelector('.cat-item-owned')).toBeNull()
  },
}

/** What is already in the backpack is counted when the sheet opens, without any animation. */
export const OwnedAlready: Story = {
  render: forCharacter(wren.id),
  play: async ({ canvasElement }) => {
    const dialog = await sheet(canvasElement)
    await expect(within(rowOf(dialog, 'Lockpicks')).getByText('In backpack: 1')).toBeInTheDocument()
    await expect(dialog.querySelector('.is-arrived, .cat-item-flash')).toBeNull()
  },
}

/** Buying answers in the row (flash, check mark, the count in the backpack) and in the coins (the spent amount). */
export const Buying: Story = {
  render: forCharacter(sage.id),
  decorators: [withStores({ characters: [{ ...sage, coins: 30 }] })],
  play: async ({ canvasElement }) => {
    const dialog = await sheet(canvasElement)
    const row = rowOf(dialog, 'Rope (20ft)')
    const buy = within(row).getByRole('button', { name: 'Buy' })

    await userEvent.click(buy)
    await expect(await within(row).findByText('In backpack: 1')).toBeInTheDocument()
    await expect(buy).toHaveClass('is-bought')
    await expect(buy).toHaveAccessibleName('Buy')
    await expect(row.querySelector('.cat-item-flash')).not.toBeNull()
    await expect(coins(dialog)).toBe('28 s.')
    await expect(dialog.querySelector('.catalog-spent')).toHaveTextContent('−2')
    await expect(within(dialog).getByRole('status')).toHaveTextContent('Rope (20ft). In backpack: 1')

    await userEvent.click(buy)
    await expect(await within(row).findByText('In backpack: 2')).toBeInTheDocument()
    await expect(coins(dialog)).toBe('26 s.')
    await waitFor(() => expect(buy).not.toHaveClass('is-bought'), { timeout: 2000 })
  },
}

/** A stack of consumables counts by its quantity. */
export const BuyingConsumables: Story = {
  render: forCharacter(sage.id),
  decorators: [withStores({ characters: [{ ...sage, coins: 30 }] })],
  play: async ({ canvasElement }) => {
    const dialog = await sheet(canvasElement)
    const row = rowOf(dialog, 'Travel rations')
    const buy = within(row).getByRole('button', { name: 'Buy' })
    await userEvent.click(buy)
    await userEvent.click(buy)
    await userEvent.click(buy)
    await expect(await within(row).findByText('In backpack: 3')).toBeInTheDocument()
  },
}

/** Short of coins the button asks the GM instead, and nothing claims a purchase. */
export const NotEnoughCoins: Story = {
  render: forCharacter(sage.id),
  play: async ({ canvasElement }) => {
    const dialog = await sheet(canvasElement)
    const row = rowOf(dialog, 'Rope (20ft)')
    await userEvent.click(within(row).getByRole('button', { name: 'Ask' }))
    await expect(within(canvasElement).getByTestId('asked')).toHaveTextContent('rope')
    await expect(dialog.querySelector('.is-bought, .cat-item-flash, .catalog-spent')).toBeNull()
  },
}
