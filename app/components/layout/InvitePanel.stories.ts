import { computed } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import InvitePanel from './InvitePanel.vue'
import { crookhollow, olden, PARTY, CROOKHOLLOW_META, OLDEN_META } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'
import { useGamesStore } from '@/stores/games'
import { useToastsStore } from '@/stores/toasts'
import { pb } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Layout/InvitePanel',
  component: InvitePanel,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { game: crookhollow },
  decorators: [withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)],
  // The game comes from the store, so a reset code shows up in the panel.
  render: (args) => ({
    components: { InvitePanel },
    setup() {
      const games = useGamesStore()
      return { game: computed(() => games.byId(args.game.id)) }
    },
    template: '<div style="max-width: 420px"><InvitePanel v-if="game" :game="game" /></div>',
  }),
} satisfies Meta<typeof InvitePanel>

export default meta
type Story = StoryObj<typeof meta>

const confirmDialog = (canvasElement: HTMLElement) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Reset the invite code?' }).then(d => within(d))

/** The master sees the code, the link, the copy buttons and "Reset code". */
export const AsMaster: Story = {
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement)
    await expect(panel.getByTestId('invite-code')).toHaveTextContent('K7QX-29AB')
    await expect(panel.getByTestId('invite-link')).toHaveTextContent(/\/join\/K7QX29AB$/)
    await expect(panel.getByRole('button', { name: 'Reset code' })).toBeVisible()
  },
}

/** Read-only for a player: copy, but no reset. */
export const AsPlayer: Story = {
  args: { game: olden },
  decorators: [withGameTable(olden, PARTY, OLDEN_META)],
  play: async ({ canvasElement }) => {
    const panel = within(canvasElement)
    await expect(panel.getByTestId('invite-code')).toHaveTextContent('M4RT-8WZN')
    await expect(panel.getByRole('button', { name: 'Copy link' })).toBeVisible()
    await expect(panel.queryByRole('button', { name: 'Reset code' })).toBeNull()
  },
}

export const CopyLinkAndCode: Story = {
  play: async ({ canvasElement }) => {
    const write = spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    const panel = within(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Copy link' }))
    await expect(write).toHaveBeenLastCalledWith(`${window.location.origin}/join/K7QX29AB`)
    await expect(panel.getByRole('status')).toHaveTextContent('Copied.')
    await userEvent.click(panel.getByRole('button', { name: 'Copy code' }))
    await expect(write).toHaveBeenLastCalledWith('K7QX-29AB')
  },
}

export const CopyFails: Story = {
  play: async ({ canvasElement }) => {
    spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    const panel = within(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Copy link' }))
    await expect(panel.getByRole('status')).toHaveTextContent('Couldn’t copy. Select the text instead.')
  },
}

/** Reset asks first; once confirmed the panel shows the new code. */
export const ResetConfirm: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('games'), 'update')
    const panel = within(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Reset code' }))
    const confirm = await confirmDialog(canvasElement)
    await expect(update).not.toHaveBeenCalled()
    await userEvent.click(confirm.getByRole('button', { name: 'Reset' }))
    await expect(update).toHaveBeenCalledWith(crookhollow.id, { invite_code: expect.stringMatching(/^[A-Z2-9]{8}$/) })
    await waitFor(() => expect(panel.getByTestId('invite-code')).not.toHaveTextContent('K7QX-29AB'))
    await expect(useGamesStore().byId(crookhollow.id)?.inviteCode).not.toBe(crookhollow.inviteCode)
  },
}

export const ResetCancel: Story = {
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('games'), 'update')
    const panel = within(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Reset code' }))
    const confirm = await confirmDialog(canvasElement)
    await userEvent.click(confirm.getByRole('button', { name: 'Cancel' }))
    await expect(update).not.toHaveBeenCalled()
    await expect(panel.getByTestId('invite-code')).toHaveTextContent('K7QX-29AB')
  },
}

export const ResetFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('games'), 'update').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    const panel = within(canvasElement)
    await userEvent.click(panel.getByRole('button', { name: 'Reset code' }))
    const confirm = await confirmDialog(canvasElement)
    await userEvent.click(confirm.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(useToastsStore().items.map(t => t.text)).toContain('Couldn’t reset the code. Try again.'))
    await expect(panel.getByTestId('invite-code')).toHaveTextContent('K7QX-29AB')
  },
}
