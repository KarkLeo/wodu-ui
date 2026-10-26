import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, within } from 'storybook/test'
import MembersSheet from './MembersSheet.vue'
import { crookhollow, olden, PARTY, CROOKHOLLOW_META, OLDEN_META } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'

// The sheet players open from the game menu; the master manages members on the settings screen.
// Behaviour (remove, make master): MembersList stories.
const meta = {
  title: 'Layout/MembersSheet',
  component: MembersSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { game: olden, open: true, 'onUpdate:open': fn() },
  decorators: [withGameTable(olden, PARTY, OLDEN_META)],
} satisfies Meta<typeof MembersSheet>

export default meta
type Story = StoryObj<typeof meta>

const dialog = (canvasElement: HTMLElement) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Members' }).then(d => within(d))

/** A player sees the members with the master marked, and no buttons but the close. */
export const AsPlayer: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    const rows = sheet.getAllByRole('listitem')
    await expect(rows).toHaveLength(3)
    await expect(rows[0]).toHaveTextContent(/Seva.*master/)
    await expect(sheet.queryByRole('button', { name: /^Remove/ })).toBeNull()
    await expect(sheet.queryByRole('button', { name: /the master$/ })).toBeNull()
  },
}

/** The same sheet for the master still carries the master's controls. */
export const AsMaster: Story = {
  args: { game: crookhollow },
  decorators: [withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(sheet.getAllByRole('listitem')[0]).toHaveTextContent(/Anna.*master.*you/)
    await expect(sheet.getByRole('button', { name: 'Remove Kostya' })).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Make Kostya the master' })).toBeVisible()
  },
}
