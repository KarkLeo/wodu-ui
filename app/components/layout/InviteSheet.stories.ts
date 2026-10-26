import { computed } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, spyOn, userEvent, within } from 'storybook/test'
import InviteSheet from './InviteSheet.vue'
import { crookhollow, olden, PARTY, CROOKHOLLOW_META, OLDEN_META } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'
import { useGamesStore } from '@/stores/games'

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

/** The sheet players open from the game menu: the code and link to copy, no reset. Behaviour: InvitePanel stories. */
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
