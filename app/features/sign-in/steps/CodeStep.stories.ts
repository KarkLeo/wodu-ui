import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import CodeStep from './CodeStep.vue'
import { STORY_NOW } from '@/stories/fixtures'

const meta = {
  title: 'Screens/SignIn/CodeStep',
  component: CodeStep,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  args: {
    email: 'anna@mail.com',
    sentAt: STORY_NOW,
    busy: false,
    error: null,
    onSubmit: fn(),
    onResend: fn(),
    onBack: fn(),
  },
} satisfies Meta<typeof CodeStep>

export default meta
type Story = StoryObj<typeof meta>

const codeInput = (canvasElement: HTMLElement) =>
  within(canvasElement).getByLabelText('Code from the email')

export const Default: Story = {}

export const TypeEight: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    await userEvent.type(codeInput(canvasElement), '2451156')
    await expect(args.onSubmit).not.toHaveBeenCalled()
    await userEvent.type(codeInput(canvasElement), '6')
    await expect(args.onSubmit).toHaveBeenCalledOnce()
    await expect(args.onSubmit).toHaveBeenCalledWith('24511566')
  },
}

export const PasteWithSpace: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    await userEvent.click(codeInput(canvasElement))
    await userEvent.paste('2451 1566')
    await expect(args.onSubmit).toHaveBeenCalledOnce()
    await expect(args.onSubmit).toHaveBeenCalledWith('24511566')
  },
}

export const WrongCode: Story = {
  args: { error: 'Wrong or expired code.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Wrong or expired code.')).toBeVisible()
    await expect(codeInput(canvasElement)).toHaveValue('')
  },
}

export const ResendLocked: Story = {
  play: async ({ args, canvasElement }) => {
    const resend = within(canvasElement).getByRole('button', { name: /Send again/ })
    await expect(resend).toBeDisabled()
    await expect(resend).toHaveTextContent('1:00')
    await expect(args.onResend).not.toHaveBeenCalled()
  },
}

export const ResendOpen: Story = {
  args: { sentAt: STORY_NOW - 61_000 },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Send again' }))
    await expect(args.onResend).toHaveBeenCalledOnce()
  },
}

export const PasteLongText: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    await userEvent.click(codeInput(canvasElement))
    await userEvent.paste('Your code: 2451-1566 (World of Dungeons)')
    await expect(args.onSubmit).toHaveBeenCalledOnce()
    await expect(args.onSubmit).toHaveBeenCalledWith('24511566')
  },
}
