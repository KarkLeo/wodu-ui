import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import CoinBar from './CoinBar.vue'

const meta = {
  title: 'Panels/Inventory/CoinBar',
  component: CoinBar,
  args: { coins: 152, onUpdate: fn() },
  // Holds the value as the store would, so an update comes back as the new prop.
  render: (args) => ({
    components: { CoinBar },
    setup() {
      const coins = ref(args.coins)
      watch(() => args.coins, (v) => { coins.value = v })
      function update(v: number) {
        coins.value = v
        args.onUpdate?.(v)
      }
      return { coins, update }
    },
    template: '<CoinBar :coins="coins" @update="update" />',
  }),
  decorators: [() => ({ template: '<div style="max-width: 560px"><story /></div>' })],
  parameters: {
    docs: { description: { component: 'Design prototype: `materials/design-vtt/design/components/inventory.html`' } },
  },
} satisfies Meta<typeof CoinBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: { coins: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Decrease coins' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Increase coins' })).toBeEnabled()
  },
}

export const LargeAmount: Story = {
  args: { coins: 9529 },
}

/** Each update is a SET_COINS dispatch: typing stays a draft, and each edit or button press goes out once. */
export const OneUpdatePerEdit: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement)
    const field = canvas.getByRole('spinbutton', { name: 'Coins' })

    await step('Enter commits what was typed, once', async () => {
      await userEvent.clear(field)
      await userEvent.type(field, '250')
      await expect(args.onUpdate).not.toHaveBeenCalled()
      await userEvent.keyboard('{Enter}')
      await expect(args.onUpdate).toHaveBeenCalledTimes(1)
      await expect(args.onUpdate).toHaveBeenLastCalledWith(250)
    })

    await step('blur commits; a fraction is cut', async () => {
      await userEvent.clear(field)
      await userEvent.type(field, '80.5')
      await userEvent.tab()
      await expect(args.onUpdate).toHaveBeenCalledTimes(2)
      await expect(args.onUpdate).toHaveBeenLastCalledWith(80)
      await expect(field).toHaveValue(80)
    })

    await step('focus and leave without typing sends nothing', async () => {
      await userEvent.click(field)
      await userEvent.tab()
      await expect(args.onUpdate).toHaveBeenCalledTimes(2)
    })

    await step('Escape cancels', async () => {
      await userEvent.clear(field)
      await userEvent.type(field, '999')
      await userEvent.keyboard('{Escape}')
      await expect(field).toHaveValue(80)
      await userEvent.tab()
      await expect(args.onUpdate).toHaveBeenCalledTimes(2)
    })

    await step('the buttons step by one', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Increase coins' }))
      await expect(args.onUpdate).toHaveBeenCalledTimes(3)
      await expect(args.onUpdate).toHaveBeenLastCalledWith(81)
      await userEvent.click(canvas.getByRole('button', { name: 'Decrease coins' }))
      await expect(args.onUpdate).toHaveBeenCalledTimes(4)
      await expect(args.onUpdate).toHaveBeenLastCalledWith(80)
    })
  },
}
