import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import BringCharacterSheet from './BringCharacterSheet.vue'
import { brann, crookhollow, draftGear, mirel, oda, PARTY, sage, wren, CROOKHOLLOW_META } from '@/stories/fixtures'
import { withGameTable } from '@/stories/state'
import { useCharactersStore } from '@/stores/characters'
import { pb } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Layout/BringCharacterSheet',
  component: BringCharacterSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { gameId: crookhollow.id, open: true, 'onUpdate:open': fn(), onBrought: fn() },
  // Oda and Sage are mine and free; Brann is mine but already here; Wren and Mirel are other players'.
  decorators: [withGameTable(crookhollow, [...PARTY, sage, draftGear], CROOKHOLLOW_META)],
} satisfies Meta<typeof BringCharacterSheet>

export default meta
type Story = StoryObj<typeof meta>

const dialog = (canvasElement: HTMLElement) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name: 'Bring one of mine' }).then(d => within(d))

/** Only my finished characters that are in no game. */
export const WithCharacters: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    const names = sheet.getAllByRole('button', { name: /./ })
      .filter(b => b.classList.contains('gs-row'))
      .map(b => b.textContent ?? '')
    await expect(names).toHaveLength(2)
    await expect(names.join()).toContain(oda.name)
    await expect(names.join()).toContain(sage.name)
    for (const other of [brann, wren, mirel]) await expect(names.join()).not.toContain(other.name)
  },
}

export const Brings: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    const update = spyOn(pb.collection('characters'), 'update')
    const sheet = await dialog(canvasElement)
    await userEvent.click(sheet.getByRole('button', { name: new RegExp(sage.name) }))
    await waitFor(() => expect(args.onBrought).toHaveBeenCalledWith(sage.id))
    await expect(update).toHaveBeenCalledWith(sage.id, { game: crookhollow.id })
    await expect(useCharactersStore().metaOf(sage.id)?.game).toBe(crookhollow.id)
    await expect(args['onUpdate:open']).toHaveBeenCalledWith(false)
  },
}

/** Every character of mine is already in a game. */
export const Empty: Story = {
  decorators: [withGameTable(crookhollow, [brann, wren], CROOKHOLLOW_META)],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(sheet.getByText('None of your characters is free right now.')).toBeVisible()
    await expect(sheet.queryAllByRole('listitem')).toHaveLength(0)
  },
}
