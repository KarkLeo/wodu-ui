import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import EmailStep from './EmailStep.vue'

const meta = {
  title: 'Screens/SignIn/EmailStep',
  component: EmailStep,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  args: {
    email: '',
    busy: false,
    error: null,
    onSubmit: fn(),
    onPlayOffline: fn(),
    'onUpdate:email': fn(),
  },
} satisfies Meta<typeof EmailStep>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithError: Story = {
  args: { email: 'anna', error: 'That doesn’t look like an email.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent('That doesn’t look like an email.')
  },
}

export const Busy: Story = {
  args: { email: 'anna@mail.com', busy: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Get code' })).toBeDisabled()
  },
}

export const SubmitByEnter: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    await userEvent.type(within(canvasElement).getByLabelText('Email'), 'anna@mail.com{Enter}')
    await expect(args.onSubmit).toHaveBeenCalledOnce()
    await expect(args['onUpdate:email']).toHaveBeenLastCalledWith('anna@mail.com')
  },
}
