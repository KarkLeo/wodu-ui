import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import SceneRow from './SceneRow.vue'
import { SCENES } from '@/stories/scenes'

const [tavern, forest, rain] = SCENES as [typeof SCENES[number], typeof SCENES[number], typeof SCENES[number]]

const meta = {
  title: 'Features/Stage/SceneRow',
  component: SceneRow,
  args: {
    scene: tavern,
    active: false,
    busy: false,
    'onTurn-on': fn(),
    'onTurn-off': fn(),
    onEdit: fn(),
    onDelete: fn(),
  },
  decorators: [() => ({ template: '<ul style="list-style: none; margin: 0; padding: 0; width: min(420px, 100vw - 32px)"><story /></ul>' })],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SceneRow>

export default meta
type Story = StoryObj<typeof meta>

/** A scene with a picture and a sound: the thumbnail comes from the server at the list size. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Tavern')).toBeVisible()
    const img = canvasElement.querySelector('img')!
    await expect(img.getAttribute('src')).toContain('/api/files/scenes/story-scene-tavern/image.jpg?thumb=176x112')
    await expect(canvas.getByRole('img', { name: 'Has a sound' })).toBeVisible()
    await expect(canvasElement.querySelector('li')).not.toHaveAttribute('aria-current')
    await userEvent.click(canvas.getByRole('button', { name: 'Turn on' }))
    await expect(args['onTurn-on']).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Tavern' }))
    await expect(args.onEdit).toHaveBeenCalledTimes(1)
    await userEvent.click(canvas.getByRole('button', { name: 'Delete Tavern' }))
    await expect(args.onDelete).toHaveBeenCalledTimes(1)
  },
}

/** No picture: a neutral placeholder, no image request. */
export const NoImage: Story = {
  args: { scene: rain },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('img')).toBeNull()
    await expect(canvasElement.querySelector('.sr-thumb.is-empty')).not.toBeNull()
    await expect(within(canvasElement).getByRole('img', { name: 'Has a sound' })).toBeVisible()
  },
}

/** No sound: no music mark. */
export const NoSound: Story = {
  args: { scene: forest },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('img', { name: 'Has a sound' })).toBeNull()
    await expect(canvasElement.querySelector('img')!.getAttribute('src')).toContain('/image.png?thumb=176x112')
  },
}

/** The scene on at the table: marked, selected, and its button turns it off. */
export const Active: Story = {
  args: { active: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvasElement.querySelector('li')).toHaveAttribute('aria-current', 'true')
    await expect(canvas.getByText('On')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Turn on' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Turn off' }))
    await expect(args['onTurn-off']).toHaveBeenCalledTimes(1)
  },
}

/** While a change for this row is on its way, none of its buttons answers. */
export const Busy: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    for (const button of within(canvasElement).getAllByRole('button')) await expect(button).toBeDisabled()
  },
}

/** A picture that does not load falls back to the placeholder. */
export const BrokenThumbnail: Story = {
  args: { scene: { ...tavern, image: 'gone.jpg' } },
  play: async ({ canvasElement }) => {
    const img = canvasElement.querySelector('img')!
    img.dispatchEvent(new Event('error'))
    await expect(await within(canvasElement).findByText('Tavern')).toBeVisible()
    await expect(canvasElement.querySelector('img')).toBeNull()
    await expect(canvasElement.querySelector('.sr-thumb.is-empty')).not.toBeNull()
  },
}

/** An 80-character name takes one line and ends in an ellipsis; the buttons keep their places. */
export const LongName: Story = {
  args: { scene: { ...tavern, name: 'The long and winding road through the Mourning Marshes toward the drowned bell tower' }, active: true },
  decorators: [() => ({ template: '<ul style="list-style: none; margin: 0; padding: 0; width: 360px"><story /></ul>' })],
  play: async ({ canvasElement }) => {
    const name = canvasElement.querySelector<HTMLElement>('.sr-name')!
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
    await expect(getComputedStyle(name).textOverflow).toBe('ellipsis')
    const row = canvasElement.querySelector('li')!.getBoundingClientRect()
    for (const button of within(canvasElement).getAllByRole('button')) {
      const box = button.getBoundingClientRect()
      await expect(box.right).toBeLessThanOrEqual(row.right + 0.5)
      await expect(box.width).toBeGreaterThan(20)
    }
  },
}
