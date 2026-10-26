import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import StatusHeader from './StatusHeader.vue'
import { brann, wren, oda, PARTY } from '@/stories/fixtures'
import { withStores } from '@/stories/state'
import { asTeammate, expectNoEditControls, sheetFor, TEAMMATE_NAME } from '@/stories/readonly'

const meta = {
  title: 'Panels/StatusHeader',
  component: StatusHeader,
  globals: { viewport: { value: 'phone', isRotated: false } },
  decorators: [withStores({ characters: PARTY })],
} satisfies Meta<typeof StatusHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Healthy: Story = {
  args: { id: brann.id },
}

export const Wounded: Story = {
  args: { id: wren.id },
}

export const ReadyToLevelUp: Story = {
  args: { id: oda.id },
}

export const Compact: Story = {
  args: { id: brann.id, compact: true },
}

/** Seva's character: whose it is, values and breakdowns only — no HP/XP/coin controls, no level-up, no dice. */
export const ReadOnly: Story = {
  args: { id: oda.id },
  decorators: [sheetFor(oda.id), asTeammate(PARTY)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(`${TEAMMATE_NAME}’s character`)).toBeVisible()
    await expect(canvas.getByText(oda.name)).toBeVisible()
    await expectNoEditControls(canvasElement)
    await expect(canvas.getByText('Coins')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /Coins/ })).toBeNull()
    // The damage and armor chips stay popover triggers: their popovers show breakdowns only.
    const page = within(canvasElement.ownerDocument.body)
    for (const name of [/Damage/, /Armor/]) {
      await userEvent.click(canvas.getByRole('button', { name }))
      const dialog = await page.findByRole('dialog')
      await expectNoEditControls(dialog)
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(page.queryByRole('dialog')).toBeNull())
    }
  },
}

export const ReadOnlyCompact: Story = {
  args: { id: oda.id, compact: true },
  decorators: [sheetFor(oda.id), asTeammate(PARTY)],
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(oda.name)).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}

/** The owner is not among the loaded members: a neutral marker, never "—’s character". */
export const ReadOnlyUnknownOwner: Story = {
  args: { id: oda.id },
  decorators: [sheetFor(oda.id), asTeammate(PARTY, [])],
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('Someone else’s character')).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}
