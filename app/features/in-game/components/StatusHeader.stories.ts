import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import StatusHeader from './StatusHeader.vue'
import { brann, wren, oda, PARTY } from '@/stories/fixtures'
import { DESKTOP_VIEWPORT, withStores } from '@/stories/state'
import { useCharactersStore } from '@/stores/characters'
import { asTeammate, expectNoEditControls, sheetFor, TEAMMATE_NAME } from '@/stories/readonly'
import { clearPbRequests, pbRequests } from '../../../../.storybook/mocks/pb'

const meta = {
  title: 'Panels/StatusHeader',
  component: StatusHeader,
  globals: { viewport: { value: 'phone', isRotated: false } },
  decorators: [withStores({ characters: PARTY })],
} satisfies Meta<typeof StatusHeader>

export default meta
type Story = StoryObj<typeof meta>

/** Every dispatch overwrites the whole character on the server. */
const characterWrites = () => pbRequests().filter(r => r === 'characters.update').length
const brannNow = () => useCharactersStore().getById(brann.id)!

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

/** The coin field on a phone (a bottom sheet): one write per edit, none per keystroke, none for a cancelled edit. */
export const CoinsWriteOncePerEdit: Story = {
  args: { id: brann.id },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    clearPbRequests()
    await userEvent.click(canvas.getByRole('button', { name: /Coins/ }))

    await step('Enter writes once', async () => {
      const field = await page.findByRole('spinbutton', { name: 'Coins' })
      await userEvent.clear(field)
      await userEvent.type(field, '123')
      await expect(characterWrites()).toBe(0)
      await userEvent.keyboard('{Enter}')
      await expect(characterWrites()).toBe(1)
      await expect(brannNow().coins).toBe(123)
    })

    await step('Escape closes the sheet and writes nothing', async () => {
      const field = page.getByRole('spinbutton', { name: 'Coins' })
      await userEvent.clear(field)
      await userEvent.type(field, '45')
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(page.queryByRole('dialog')).toBeNull())
      await expect(characterWrites()).toBe(1)
      await expect(brannNow().coins).toBe(123)
    })

    await step('closing the sheet keeps what was typed, with one write', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /Coins/ }))
      const field = await page.findByRole('spinbutton', { name: 'Coins' })
      await userEvent.clear(field)
      await userEvent.type(field, '77')
      await userEvent.click(page.getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(page.queryByRole('dialog')).toBeNull())
      await expect(characterWrites()).toBe(2)
      await expect(brannNow().coins).toBe(77)
    })
  },
}

/** The same in the desktop popover, which a click outside closes. */
export const CoinsWriteOnceInPopover: Story = {
  args: { id: brann.id },
  globals: DESKTOP_VIEWPORT,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    clearPbRequests()
    await userEvent.click(canvas.getByRole('button', { name: /Coins/ }))
    const field = await page.findByRole('spinbutton', { name: 'Coins' })
    await userEvent.clear(field)
    await userEvent.type(field, '55')
    await expect(characterWrites()).toBe(0)
    await userEvent.click(canvasElement.ownerDocument.body)
    await waitFor(() => expect(page.queryByRole('spinbutton', { name: 'Coins' })).toBeNull())
    await expect(characterWrites()).toBe(1)
    await expect(brannNow().coins).toBe(55)
  },
}

/** A typed experience value becomes one GAIN_XP, for the whole difference. */
export const XpWritesOncePerEdit: Story = {
  args: { id: brann.id },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body)
    clearPbRequests()
    await userEvent.click(canvasElement.querySelector<HTMLElement>('.xp-bar-trigger')!)
    const field = await page.findByRole('spinbutton', { name: 'Input' })
    await userEvent.clear(field)
    await userEvent.type(field, '1234')
    await expect(characterWrites()).toBe(0)
    // Enter, not Tab: with Storybook's frozen clock Vue drops a blur that Reka's layer has already seen in capture.
    await userEvent.keyboard('{Enter}')
    await expect(characterWrites()).toBe(1)
    await expect(brannNow().xp).toBe(1234)

    await userEvent.click(page.getByRole('button', { name: '+10' }))
    await expect(characterWrites()).toBe(2)
    await expect(brannNow().xp).toBe(1244)
  },
}

/** Typing an HP amount writes nothing; the submit button writes once. */
export const HpWritesOncePerApply: Story = {
  args: { id: brann.id },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const page = within(canvasElement.ownerDocument.body)
    const before = brannNow().currentHp
    clearPbRequests()
    await userEvent.click(canvas.getByRole('button', { name: /Edit HP/ }))
    const field = await page.findByRole('spinbutton', { name: 'Amount' })
    await userEvent.clear(field)
    await userEvent.type(field, '2')
    await userEvent.tab()
    await expect(characterWrites()).toBe(0)
    await userEvent.click(page.getByRole('button', { name: 'Deal damage' }))
    await expect(characterWrites()).toBe(1)
    await expect(brannNow().currentHp).toBe(before - 2)
  },
}
