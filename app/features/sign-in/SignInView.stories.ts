import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import SignInView from './SignInView.vue'
import { authStore, pb, signInMock } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Screens/SignIn',
  component: SignInView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  args: { gate: 'sign-in', onPlayOffline: fn() },
  beforeEach() {
    authStore.clear()
  },
} satisfies Meta<typeof SignInView>

export default meta
type Story = StoryObj<typeof meta>

async function sendCodeTo(canvasElement: HTMLElement, email: string) {
  const canvas = within(canvasElement)
  await userEvent.type(canvas.getByLabelText('Email'), email)
  await userEvent.click(canvas.getByRole('button', { name: 'Get code' }))
}

export const Email: Story = {}

export const EmailInvalid: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const requestOTP = spyOn(pb.collection('users'), 'requestOTP')
    await sendCodeTo(canvasElement, 'anna')
    await expect(within(canvasElement).getByText('That doesn’t look like an email.')).toBeVisible()
    await expect(requestOTP).not.toHaveBeenCalled()
  },
}

export const Code: Story = {
  play: async ({ canvasElement }) => {
    const requestOTP = spyOn(pb.collection('users'), 'requestOTP')
    await sendCodeTo(canvasElement, '  Anna@Mail.com ')
    await expect(await within(canvasElement).findByText('Check your email')).toBeVisible()
    await expect(within(canvasElement).getByText('code sent to anna@mail.com')).toBeVisible()
    await expect(requestOTP).toHaveBeenCalledWith('anna@mail.com')
  },
}

export const WrongCodeThenRight: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await sendCodeTo(canvasElement, 'anna@mail.com')
    const canvas = within(canvasElement)
    const input = await canvas.findByLabelText('Code from the email')
    await userEvent.type(input, '00000000')
    await expect(await canvas.findByText('Wrong or expired code.')).toBeVisible()
    await expect(input).toHaveValue('')
    await expect(authStore.isValid).toBe(false)
    await userEvent.type(input, '24511566')
    await waitFor(() => expect(authStore.isValid).toBe(true))
  },
}

export const BackToEmail: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await sendCodeTo(canvasElement, 'anna@mail.com')
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /different email/ }))
    await expect(canvas.getByLabelText('Email')).toHaveValue('anna@mail.com')
  },
}

export const Name: Story = {
  args: { gate: 'name' },
  beforeEach() {
    signInMock({ email: 'anna@mail.com', name: '' })
  },
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('users'), 'update')
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText(/Player name/)).toHaveValue('anna')
    await userEvent.click(canvas.getByRole('button', { name: 'Later' }))
    await expect(update).toHaveBeenCalledWith('user-mock', { name: 'anna' })
  },
}

export const NameTyped: Story = {
  tags: ['no-visual'],
  args: { gate: 'name' },
  beforeEach() {
    signInMock({ email: 'anna@mail.com', name: '' })
  },
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('users'), 'update')
    const canvas = within(canvasElement)
    const field = canvas.getByLabelText(/Player name/)
    await userEvent.clear(field)
    await userEvent.type(field, '  Анна ')
    await userEvent.click(canvas.getByRole('button', { name: 'Done' }))
    await expect(update).toHaveBeenCalledWith('user-mock', { name: 'Анна' })
  },
}

export const PlayOffline: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Play offline, no account' }))
    await expect(args.onPlayOffline).toHaveBeenCalledOnce()
  },
}
