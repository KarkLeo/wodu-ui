import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import JoinByCodeSheet from './JoinByCodeSheet.vue'

const meta = {
  title: 'Screens/Cabinet/JoinByCodeSheet',
  component: JoinByCodeSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { open: true, 'onUpdate:open': fn(), onSubmit: fn() },
} satisfies Meta<typeof JoinByCodeSheet>

export default meta
type Story = StoryObj<typeof meta>

const dialog = (canvasElement: HTMLElement) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Join by code' }).then(d => within(d))

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(sheet.getByRole('button', { name: 'Join' })).toBeDisabled()
  },
}

/** Lowercase, spaces and the dash are accepted. */
export const Normalises: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await userEvent.type(sheet.getByLabelText('Invite code'), ' m4rt - 8wzn ')
    await userEvent.click(sheet.getByRole('button', { name: 'Join' }))
    await expect(args.onSubmit).toHaveBeenCalledWith('M4RT8WZN')
  },
}

/** Ambiguous characters (0, O, 1, I) and a wrong length are refused. */
export const Invalid: Story = {
  play: async ({ args, canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await userEvent.type(sheet.getByLabelText('Invite code'), 'K0QX-29AB')
    await userEvent.click(sheet.getByRole('button', { name: 'Join' }))
    await expect(sheet.getByRole('alert')).toHaveTextContent('doesn’t look like an invite code')
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}
