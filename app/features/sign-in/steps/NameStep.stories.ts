import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import NameStep from './NameStep.vue'

const meta = {
  title: 'Screens/SignIn/NameStep',
  component: NameStep,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  args: { suggested: 'anna', busy: false, onSave: fn() },
} satisfies Meta<typeof NameStep>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Busy: Story = {
  args: { busy: true },
}

export const LaterKeepsSuggestion: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText(/Player name/), 'x')
    await userEvent.click(canvas.getByRole('button', { name: 'Later' }))
    await expect(args.onSave).toHaveBeenCalledWith('anna')
  },
}

export const BlankFallsBackToSuggestion: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.clear(canvas.getByLabelText(/Player name/))
    await userEvent.type(canvas.getByLabelText(/Player name/), '   ')
    await userEvent.click(canvas.getByRole('button', { name: 'Done' }))
    await expect(args.onSave).toHaveBeenCalledWith('anna')
  },
}
