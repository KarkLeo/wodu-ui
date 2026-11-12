import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import SoundRow from './SoundRow.vue'
import { SOUNDS } from '@/stories/sounds'

const [hearth, brawl] = SOUNDS as [typeof SOUNDS[number], typeof SOUNDS[number], typeof SOUNDS[number]]

const meta = {
  title: 'Features/Stage/SoundRow',
  component: SoundRow,
  args: {
    sound: brawl,
    playing: false,
    busy: false,
    loopSaving: false,
    loopNextPlay: false,
    onPlay: fn(),
    onStop: fn(),
    'onToggle-loop': fn(),
    onEdit: fn(),
    onDelete: fn(),
  },
  decorators: [() => ({ template: '<ul style="list-style: none; margin: 0; padding: 0; width: min(420px, 100vw - 32px)"><story /></ul>' })],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SoundRow>

export default meta
type Story = StoryObj<typeof meta>

/** A sound at rest: a play button, its name and length, the loop switch, edit and delete. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Tavern brawl')).toBeVisible()
    await expect(canvas.getByText('2:40')).toBeVisible()
    await expect(canvasElement.querySelector('li')).not.toHaveAttribute('aria-current')
    await expect(canvas.queryByText('Plays for everyone')).toBeNull()
    const play = canvas.getByRole('button', { name: 'Play Tavern brawl' })
    await expect(play).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(play)
    await expect(args.onPlay).toHaveBeenCalledTimes(1)
    await expect(canvas.getByRole('switch', { name: 'Loop' })).not.toBeChecked()
    await userEvent.click(canvas.getByRole('switch', { name: 'Loop' }))
    await expect(args['onToggle-loop']).toHaveBeenCalledWith(true)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Tavern brawl' }))
    await expect(args.onEdit).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Delete Tavern brawl' }))
    await expect(args.onDelete).toHaveBeenCalledTimes(1)
  },
}

/** The sound playing at the table: selected, pressed, showing stop, and saying it plays for everyone. */
export const Playing: Story = {
  args: { playing: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvasElement.querySelector('li')).toHaveAttribute('aria-current', 'true')
    await expect(canvas.getByText('Plays for everyone')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Play Tavern brawl' })).toBeNull()
    const stop = canvas.getByRole('button', { name: 'Stop Tavern brawl' })
    await expect(stop).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(stop)
    await expect(args.onStop).toHaveBeenCalledTimes(1)
    await expect(args.onPlay).not.toHaveBeenCalled()
  },
}

/** A looping sound shows its switch on. */
export const Looping: Story = {
  args: { sound: hearth },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('switch', { name: 'Loop' })).toBeChecked()
  },
}

/** A length the browser could not read is a dash. */
export const UnknownDuration: Story = {
  args: { sound: { ...brawl, duration: null } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('—')).toBeVisible()
  },
}

/** The loop of a playing sound changed: it applies from the next play, and the row says so. */
export const LoopFromTheNextPlay: Story = {
  args: { playing: true, loopNextPlay: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('The loop applies from the next play')).toBeVisible()
  },
}

/** While the loop is being saved the switch shows the asked value and does not answer. */
export const SavingTheLoop: Story = {
  args: { loop: true, loopSaving: true },
  play: async ({ canvasElement, args }) => {
    const toggle = within(canvasElement).getByRole('switch', { name: 'Loop' })
    await expect(toggle).toBeChecked()
    await expect(toggle).toBeDisabled()
    await userEvent.click(toggle, { pointerEventsCheck: 0 })
    await expect(args['onToggle-loop']).not.toHaveBeenCalled()
  },
}

/** While a play, stop or delete is on its way, the round button and the row's buttons do not answer. */
export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    for (const button of within(canvasElement).getAllByRole('button')) await expect(button).toBeDisabled()
  },
}

/** An 80-character name takes one line and ends in an ellipsis; the controls keep their places. */
export const LongName: Story = {
  args: { sound: { ...brawl, name: 'The long and winding road through the Mourning Marshes toward the drowned bell tower' }, playing: true },
  decorators: [() => ({ template: '<ul style="list-style: none; margin: 0; padding: 0; width: 360px"><story /></ul>' })],
  play: async ({ canvasElement }) => {
    const name = canvasElement.querySelector<HTMLElement>('.sr-name')!
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
    await expect(getComputedStyle(name).textOverflow).toBe('ellipsis')
    const row = canvasElement.querySelector('li')!.getBoundingClientRect()
    for (const control of within(canvasElement).getAllByRole('button')) {
      const box = control.getBoundingClientRect()
      await expect(box.right).toBeLessThanOrEqual(row.right + 0.5)
      await expect(box.width).toBeGreaterThan(20)
    }
  },
}
