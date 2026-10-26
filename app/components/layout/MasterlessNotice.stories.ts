import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import MasterlessNotice from './MasterlessNotice.vue'
import { MEMBERS, olden, OLDEN_META, wren } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'
import { useGamesStore } from '@/stores/games'
import { useToastsStore } from '@/stores/toasts'
import { pb } from '../../../.storybook/mocks/pb'

const masterless = { ...olden, master: '' }

const meta = {
  title: 'Layout/MasterlessNotice',
  component: MasterlessNotice,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { game: masterless },
  decorators: [withGameTable(masterless, [wren], OLDEN_META, MEMBERS.filter(m => m.user !== 'user-seva'))],
} satisfies Meta<typeof MasterlessNotice>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)
const toasts = () => useToastsStore().items.map(t => t.text)

async function claim(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Become master' }))
  const dialog = within(await body(canvasElement).findByRole('dialog', { name: 'Become the master?' }))
  await userEvent.click(dialog.getByRole('button', { name: 'Become master' }))
}

export const Default: Story = {}

export const Claim: Story = {
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('games'), 'update')
    await claim(canvasElement)
    await expect(update).toHaveBeenCalledWith(olden.id, { master: 'user-mock' })
    await waitFor(() => expect(useGamesStore().byId(olden.id)?.master).toBe('user-mock'))
    await expect(toasts()).toEqual([])
  },
}

export const ClaimCancel: Story = {
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('games'), 'update')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Become master' }))
    const dialog = within(await body(canvasElement).findByRole('dialog', { name: 'Become the master?' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    await expect(update).not.toHaveBeenCalled()
  },
}

/** Review focus 2: the read-back shows another master, so this claim lost. */
export const ClaimTaken: Story = {
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('games'), 'getOne').mockResolvedValueOnce({
      id: olden.id, name: olden.name, master: 'user-kostya', invite_code: olden.inviteCode,
    } as never)
    await claim(canvasElement)
    await waitFor(() => expect(toasts()).toEqual(['Another player became the master first.']))
    await expect(useGamesStore().byId(olden.id)?.master).toBe('user-kostya')
  },
}

export const ClaimFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('games'), 'update').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    await claim(canvasElement)
    await waitFor(() => expect(toasts()).toEqual(['Couldn’t become the master. Try again.']))
    await expect(useGamesStore().byId(olden.id)?.master).toBe('')
  },
}
