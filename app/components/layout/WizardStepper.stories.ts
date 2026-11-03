import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import WizardStepper from './WizardStepper.vue'

const meta = {
  title: 'Layout/WizardStepper',
  component: WizardStepper,
  args: { count: 3, current: 2, navigable: false, onSelect: fn() },
  decorators: [() => ({ template: '<div style="max-width: 420px"><story /></div>' })],
} satisfies Meta<typeof WizardStepper>

export default meta
type Story = StoryObj<typeof meta>

/** Level-up: static dots, the current one marked as the step. */
export const Static: Story = {
  args: { count: 4, current: 3 },
  play: async ({ canvasElement }) => {
    const view = within(canvasElement)
    await expect(view.queryAllByRole('button')).toHaveLength(0)
    await expect(view.getByText('3').closest('[aria-current]')).toHaveAttribute('aria-current', 'step')
    await expect(view.queryByText('1')).toBeNull()
  },
}

/** Creation: dots are buttons that go back to a finished step only. */
export const Navigable: Story = {
  args: { count: 3, current: 2, navigable: true },
  play: async ({ args, canvasElement }) => {
    const [done, active, upcoming] = within(canvasElement).getAllByRole('button')
    await expect(within(canvasElement).getByRole('button', { name: '1' })).toBe(done)
    await expect(active).toHaveAttribute('aria-current', 'step')
    await expect(active).toHaveTextContent('2')
    await expect(upcoming).toBeDisabled()
    await userEvent.click(active!)
    await userEvent.click(upcoming!, { pointerEventsCheck: 0 })
    await expect(args.onSelect).not.toHaveBeenCalled()
    await userEvent.click(done!)
    await expect(args.onSelect).toHaveBeenCalledOnce()
    await expect(args.onSelect).toHaveBeenCalledWith(1)
  },
}

export const FirstStep: Story = {
  args: { count: 3, current: 1, navigable: true },
}

export const LastStep: Story = {
  args: { count: 5, current: 5 },
}
