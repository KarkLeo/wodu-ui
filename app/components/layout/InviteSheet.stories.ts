import { computed } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import InviteSheet from './InviteSheet.vue'
import { crookhollow, olden, PARTY, CROOKHOLLOW_META, OLDEN_META } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'
import { useGamesStore } from '@/stores/games'
import { useToastsStore } from '@/stores/toasts'
import { pb } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Layout/InviteSheet',
  component: InviteSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { game: crookhollow, open: true, 'onUpdate:open': fn() },
  decorators: [withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)],
  // The game comes from the store, so a reset code shows up in the sheet.
  render: (args) => ({
    components: { InviteSheet },
    setup() {
      const games = useGamesStore()
      return { args, game: computed(() => games.byId(args.game.id)) }
    },
    template: '<InviteSheet v-if="game" :open="args.open" :game="game" @update:open="args[\'onUpdate:open\']" />',
  }),
} satisfies Meta<typeof InviteSheet>

export default meta
type Story = StoryObj<typeof meta>

const dialog = (canvasElement: HTMLElement) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Invite players' }).then(d => within(d))

/** A player sees the code and link and can copy them, but cannot reset the code. */
export const AsPlayer: Story = {
  args: { game: olden },
  decorators: [withGameTable(olden, PARTY, OLDEN_META)],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(sheet.getByTestId('invite-code')).toHaveTextContent('M4RT-8WZN')
    await expect(sheet.getByTestId('invite-link')).toHaveTextContent(/\/join\/M4RT8WZN$/)
    await expect(sheet.queryByRole('button', { name: 'Reset code' })).toBeNull()
  },
}

export const AsMaster: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(sheet.getByTestId('invite-code')).toHaveTextContent('K7QX-29AB')
    await expect(sheet.getByRole('button', { name: 'Reset code' })).toBeVisible()
  },
}

export const CopyLinkAndCode: Story = {
  play: async ({ canvasElement }) => {
    const write = spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    const sheet = await dialog(canvasElement)
    await userEvent.click(sheet.getByRole('button', { name: 'Copy link' }))
    await expect(write).toHaveBeenLastCalledWith(`${window.location.origin}/join/K7QX29AB`)
    await expect(sheet.getByRole('status')).toHaveTextContent('Copied.')
    await userEvent.click(sheet.getByRole('button', { name: 'Copy code' }))
    await expect(write).toHaveBeenLastCalledWith('K7QX-29AB')
  },
}

export const CopyFails: Story = {
  play: async ({ canvasElement }) => {
    spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    const sheet = await dialog(canvasElement)
    await userEvent.click(sheet.getByRole('button', { name: 'Copy link' }))
    await expect(sheet.getByRole('status')).toHaveTextContent('Couldn’t copy. Select the text instead.')
  },
}

/** Reset asks first; once confirmed the sheet shows the new code. */
export const ResetConfirm: Story = {
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('games'), 'update')
    const sheet = await dialog(canvasElement)
    await userEvent.click(sheet.getByRole('button', { name: 'Reset code' }))
    const confirm = within(await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Reset the invite code?' }))
    await expect(update).not.toHaveBeenCalled()
    await userEvent.click(confirm.getByRole('button', { name: 'Reset' }))
    await expect(update).toHaveBeenCalledWith(crookhollow.id, { invite_code: expect.stringMatching(/^[A-Z2-9]{8}$/) })
    await waitFor(() => expect(sheet.getByTestId('invite-code')).not.toHaveTextContent('K7QX-29AB'))
    await expect(useGamesStore().byId(crookhollow.id)?.inviteCode).not.toBe(crookhollow.inviteCode)
  },
}

export const ResetCancel: Story = {
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('games'), 'update')
    const sheet = await dialog(canvasElement)
    await userEvent.click(sheet.getByRole('button', { name: 'Reset code' }))
    const confirm = within(await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Reset the invite code?' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(update).not.toHaveBeenCalled()
    await expect(sheet.getByTestId('invite-code')).toHaveTextContent('K7QX-29AB')
  },
}

export const ResetFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('games'), 'update').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    const sheet = await dialog(canvasElement)
    await userEvent.click(sheet.getByRole('button', { name: 'Reset code' }))
    const confirm = within(await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Reset the invite code?' }))
    await userEvent.click(confirm.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(useToastsStore().items.map(t => t.text)).toContain('Couldn’t reset the code. Try again.'))
    await expect(sheet.getByTestId('invite-code')).toHaveTextContent('K7QX-29AB')
  },
}
