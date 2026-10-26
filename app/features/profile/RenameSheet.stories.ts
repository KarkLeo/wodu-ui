import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { ClientResponseError } from 'pocketbase'
import RenameSheet from './RenameSheet.vue'
import { pb, signInMock } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Screens/Profile/RenameSheet',
  component: RenameSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { name: 'Anna', open: true, 'onUpdate:open': fn() },
  beforeEach() {
    signInMock()
  },
} satisfies Meta<typeof RenameSheet>

export default meta
type Story = StoryObj<typeof meta>

// The sheet is portalled to <body>, outside the story canvas.
const sheet = (canvasElement: HTMLElement) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Change name' })

/** Opens with the current name; an empty name cannot be saved; Save writes the trimmed name. */
export const Rename: Story = {
  play: async ({ args, canvasElement }) => {
    const update = spyOn(pb.collection('users'), 'update')
    const dialog = await sheet(canvasElement)
    const field = within(dialog).getByLabelText(/Player name/)
    await expect(field).toHaveValue('Anna')
    await userEvent.clear(field)
    await expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    await userEvent.type(field, '  Annika ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await expect(update).toHaveBeenCalledWith('user-mock', { name: 'Annika' })
    await waitFor(() => expect(args['onUpdate:open']).toHaveBeenCalledWith(false))
  },
}

export const RenameFails: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    spyOn(pb.collection('users'), 'update').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    const dialog = await sheet(canvasElement)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent('Something went wrong. Try again.')
    await expect(dialog).toBeVisible()
    await expect(args['onUpdate:open']).not.toHaveBeenCalled()
  },
}
