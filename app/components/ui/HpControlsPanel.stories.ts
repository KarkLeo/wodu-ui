import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import HpControlsPanel from './HpControlsPanel.vue'

const meta = {
  title: 'UI/HpControlsPanel',
  component: HpControlsPanel,
  args: {
    current: 9,
    max: 12,
    showHeader: true,
    onApplyDamage: fn(),
    onHeal: fn(),
    onAddTemp: fn(),
    onSubmitted: fn(),
  },
  argTypes: {
    // With a characterId the dice buttons roll through useDiceRoller, which persists to PocketBase.
    characterId: { table: { disable: true } },
    characterName: { table: { disable: true } },
  },
  decorators: [
    () => ({
      template: `<div style="width: 320px; padding: 14px 16px; background: var(--vtt-bg-elevated);
        border: 1px solid var(--vtt-border-strong); border-radius: var(--r-md)"><story /></div>`,
    }),
  ],
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/hp-bar.html`',
      },
    },
  },
} satisfies Meta<typeof HpControlsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const WithHeader: Story = {}

export const WithoutHeader: Story = {
  args: { showHeader: false },
}

export const WithTempHp: Story = {
  args: { current: 7, temp: 3 },
}

export const Critical: Story = {
  args: { current: 2 },
}

/** The amount is local: typing only changes the preview, and one press of the submit button applies it. */
export const TypingAppliesNothing: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('radiogroup', { name: 'HP change type' })).toBeVisible()
    const submit = canvas.getByRole('button', { name: 'Deal damage' })
    await expect(submit).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Decrease' })).toBeDisabled()

    const amount = canvas.getByRole('spinbutton', { name: 'Amount' })
    await userEvent.clear(amount)
    await userEvent.type(amount, '12')
    await userEvent.tab()
    await expect(args.onApplyDamage).not.toHaveBeenCalled()
    await expect(canvasElement.querySelector('.hp-pop-preview')).toHaveTextContent('9 −12 = 0 / 12')

    await userEvent.click(submit)
    await expect(args.onApplyDamage).toHaveBeenCalledTimes(1)
    await expect(args.onApplyDamage).toHaveBeenCalledWith(12)
    await expect(args.onSubmitted).toHaveBeenCalledTimes(1)
    await expect(amount).toHaveValue(0)
  },
}

export const ModeSwitchResetsAmount: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Increase' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Increase' }))
    const amount = canvas.getByRole('spinbutton', { name: 'Amount' })
    await expect(amount).toHaveValue(2)

    await userEvent.click(canvas.getByRole('radio', { name: 'Heal' }))
    await expect(amount).toHaveValue(0)
    await userEvent.click(canvas.getByRole('button', { name: '2d6' }))
    await expect(Number((amount as HTMLInputElement).value)).toBeGreaterThanOrEqual(2)
    await userEvent.click(canvas.getByRole('button', { name: 'Restore' }))
    await expect(args.onHeal).toHaveBeenCalledTimes(1)
  },
}
