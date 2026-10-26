import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { ClientResponseError } from 'pocketbase'
import AccountMenu from './AccountMenu.vue'
import { authStore, pb, signInMock } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Layout/AccountMenu',
  component: AccountMenu,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: {
    user: { id: 'user-mock', email: 'anna@mail.com', name: 'Anna', language: 'en', verified: true },
  },
  beforeEach() {
    signInMock()
  },
  render: (args) => ({
    components: { AccountMenu },
    setup: () => ({ args }),
    template: '<div style="width: 248px; padding: 16px"><AccountMenu v-bind="args" /></div>',
  }),
} satisfies Meta<typeof AccountMenu>

export default meta
type Story = StoryObj<typeof meta>

// Menus and sheets are portalled to <body>, outside the story canvas.
const screen = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

async function openMenu(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: /Anna/ }))
  return screen(canvasElement).findByRole('menu')
}

export const Closed: Story = {}

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    for (const name of ['Change name', 'Sign out', 'Delete account']) {
      await expect(within(menu).getByRole('menuitem', { name })).toBeVisible()
    }
  },
}

export const Rename: Story = {
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('users'), 'update')
    const menu = await openMenu(canvasElement)
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Change name' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Change name' })
    const field = within(dialog).getByLabelText(/Player name/)
    await expect(field).toHaveValue('Anna')
    await userEvent.clear(field)
    await expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    await userEvent.type(field, 'Анна')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await expect(update).toHaveBeenCalledWith('user-mock', { name: 'Анна' })
  },
}

export const SignOut: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const menu = await openMenu(canvasElement)
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))
    await waitFor(() => expect(authStore.isValid).toBe(false))
  },
}

export const DeleteConfirm: Story = {
  play: async ({ canvasElement }) => {
    const remove = spyOn(pb.collection('users'), 'delete')
    const menu = await openMenu(canvasElement)
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Delete account' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Delete your account?' })
    await expect(remove).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await expect(remove).toHaveBeenCalledWith('user-mock')
    await waitFor(() => expect(authStore.isValid).toBe(false))
  },
}

export const RenameFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('users'), 'update').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    const menu = await openMenu(canvasElement)
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Change name' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Change name' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent('Something went wrong. Try again.')
    await expect(dialog).toBeVisible()
  },
}

export const DeleteFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('users'), 'delete').mockRejectedValueOnce(new ClientResponseError({ status: 0 }))
    const menu = await openMenu(canvasElement)
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Delete account' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Delete your account?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent(/No connection to the server/)
    await expect(authStore.isValid).toBe(true)
  },
}
