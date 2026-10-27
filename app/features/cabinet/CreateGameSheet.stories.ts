import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import CreateGameSheet from './CreateGameSheet.vue'
import { withStores } from '@/stories/state'
import { pb } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Screens/Cabinet/CreateGameSheet',
  component: CreateGameSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  decorators: [withStores({ characters: [] })],
  args: { open: true, 'onUpdate:open': fn(), onCreated: fn() },
} satisfies Meta<typeof CreateGameSheet>

export default meta
type Story = StoryObj<typeof meta>

const dialog = (canvasElement: HTMLElement) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'New game' }).then(d => within(d))

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(sheet.getByRole('button', { name: 'Create' })).toBeDisabled()
  },
}

export const TooLong: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await userEvent.type(sheet.getByLabelText('Game name'), 'y'.repeat(81))
    await expect(sheet.getByRole('alert')).toHaveTextContent('At most 80 characters.')
    await expect(sheet.getByRole('button', { name: 'Create' })).toBeDisabled()
  },
}

export const Creates: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await userEvent.type(sheet.getByLabelText('Game name'), 'x'.repeat(80))
    await userEvent.click(sheet.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(args.onCreated).toHaveBeenCalledWith(expect.objectContaining({ name: 'x'.repeat(80) })))
    await expect(args['onUpdate:open']).toHaveBeenCalledWith(false)
  },
}

export const CreateFails: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    spyOn(pb.collection('games'), 'create').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    const sheet = await dialog(canvasElement)
    await userEvent.type(sheet.getByLabelText('Game name'), 'The Sunken Abbey')
    await userEvent.click(sheet.getByRole('button', { name: 'Create' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('Couldn’t create the game. Try again.')
    await expect(args.onCreated).not.toHaveBeenCalled()
  },
}
