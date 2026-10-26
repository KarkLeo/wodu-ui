import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { toRaw } from 'vue'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import InGameView from './InGameView.vue'
import { brann, wren, mirel, oda, sage, PARTY, crookhollow, CROOKHOLLOW_META } from '@/stories/fixtures'
import { atRoute, DESKTOP_VIEWPORT, withGameTable, withStores } from '@/stories/state'
import { asTeammate, expectNoEditControls, TEAMMATE_NAME } from '@/stories/readonly'
import { useCharactersStore } from '@/stores/characters'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useToastsStore } from '@/stores/toasts'
import { useDiceRoller } from '@/composables/useDiceRoller'
import { pb } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Screens/InGame',
  component: InGameView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  decorators: [withStores({ characters: [...PARTY, sage] })],
} satisfies Meta<typeof InGameView>

export default meta
type Story = StoryObj<typeof meta>

const openTab = (name: string): Story['play'] => async ({ canvasElement }) => {
  const tab = await within(canvasElement).findByRole('tab', { name })
  await userEvent.click(tab)
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}

export const Main: Story = {
  args: { id: brann.id },
  loaders: [atRoute(`/character/${brann.id}`)],
}

export const Wounded: Story = {
  args: { id: wren.id },
  loaders: [atRoute(`/character/${wren.id}`)],
}

export const ReadyToLevelUp: Story = {
  args: { id: oda.id },
  loaders: [atRoute(`/character/${oda.id}`)],
}

export const Inventory: Story = {
  args: { id: brann.id },
  loaders: [atRoute(`/character/${brann.id}`)],
  play: openTab('Inventory'),
}

export const EmptyInventory: Story = {
  args: { id: sage.id },
  loaders: [atRoute(`/character/${sage.id}`)],
  play: openTab('Inventory'),
}

export const Magic: Story = {
  args: { id: mirel.id },
  loaders: [atRoute(`/character/${mirel.id}`)],
  play: openTab('Magic'),
}

export const Notes: Story = {
  args: { id: brann.id },
  loaders: [atRoute(`/character/${brann.id}`)],
  play: openTab('Notes'),
}

// ── Read-only: a teammate's character ──────────────────────────────────────

const teammate = asTeammate([mirel])
const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)
const ownerMarker = `${TEAMMATE_NAME}’s character`

/** Opens an info popover (a bottom sheet on a phone) and checks it only shows. */
async function expectViewOnlyPopover(canvasElement: HTMLElement, trigger: HTMLElement, shows: string) {
  await userEvent.click(trigger)
  const dialog = await body(canvasElement).findByRole('dialog')
  await expect(within(dialog).getAllByText(shows).length).toBeGreaterThan(0)
  await expectNoEditControls(dialog)
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
}

/** Review focus 4: someone else's sheet shows whose it is and offers nothing that edits or rolls. */
export const ReadOnly: Story = {
  args: { id: mirel.id },
  decorators: [teammate],
  loaders: [atRoute(`/character/${mirel.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(ownerMarker)).toBeVisible()
    await expectNoEditControls(canvasElement)
    await expectViewOnlyPopover(canvasElement, canvas.getByRole('button', { name: /^INT/ }), 'Effects')
    await expectViewOnlyPopover(canvasElement, canvas.getByRole('button', { name: /Damage/ }), 'Light weapon')
    await expectViewOnlyPopover(canvasElement, canvas.getByRole('button', { name: /Armor/ }), 'No armor')
  },
}

export const ReadOnlyDesktop: Story = {
  ...ReadOnly,
  globals: DESKTOP_VIEWPORT,
}

/** Every tab of a read-only sheet: values and lists stay, controls go; notes read as text. */
export const ReadOnlyTabs: Story = {
  tags: ['no-visual'],
  args: { id: mirel.id },
  decorators: [teammate],
  loaders: [atRoute(`/character/${mirel.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const name of ['Inventory', 'Magic', 'Notes', 'Main']) {
      const tab = await canvas.findByRole('tab', { name })
      await userEvent.click(tab)
      await expect(tab).toHaveAttribute('aria-selected', 'true')
      await expectNoEditControls(canvasElement)
      if (name === 'Inventory') await expect(canvas.getByText('Quicksilver (dose)')).toBeVisible()
      if (name === 'Magic') await expect(canvas.getByText('Illas of the Sparks')).toBeVisible()
      if (name === 'Notes') await expect(canvas.getByText('No notes yet.')).toBeVisible()
    }
  },
}

/**
 * Review focus 4, second line of defence: even a dispatch or a roll that bypasses the UI is refused
 * for a character the user cannot edit — a toast each, nothing changed, nothing sent.
 */
export const ReadOnlyGuards: Story = {
  tags: ['no-visual'],
  args: { id: mirel.id },
  decorators: [teammate],
  loaders: [atRoute(`/character/${mirel.id}`)],
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(ownerMarker)
    const characters = useCharactersStore()
    const rolls = useRollHistoryStore()
    const toasts = useToastsStore()
    toasts.clearAll()
    const before = structuredClone(toRaw(characters.getById(mirel.id)))
    const rollsBefore = rolls.records.length
    const update = spyOn(pb.collection('characters'), 'update')
    const rollCreate = spyOn(pb.collection('roll_events'), 'create')

    await characters.dispatch(mirel.id, { type: 'GAIN_XP', amount: 50 })
    const record = useDiceRoller().rollStat(mirel.id, mirel.name, 'int', 'INT', 3)

    await expect(record).toBeNull()
    await expect(toasts.items.map(t => t.text)).toEqual(['You can’t change this character.', 'You can’t change this character.'])
    await expect(characters.getById(mirel.id)).toEqual(before)
    await expect(rolls.records).toHaveLength(rollsBefore)
    await expect(update).not.toHaveBeenCalled()
    await expect(rollCreate).not.toHaveBeenCalled()
  },
}

/** The master's view of a player's character at their table: editable, so no marker and dice stay. */
export const MasterSeesPlayer: Story = {
  args: { id: wren.id },
  decorators: [withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)],
  loaders: [atRoute(`/character/${wren.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('button', { name: /^Edit HP/ })).toBeVisible()
    await expect(canvas.queryByText(/’s character$/)).toBeNull()
  },
}
