import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import ImageTile from './ImageTile.vue'
import { BRIDGE, MAP } from '@/stories/images'

const meta = {
  title: 'Features/Stage/ImageTile',
  component: ImageTile,
  parameters: { layout: 'centered' },
  args: { image: BRIDGE, selected: false, shown: false, position: 1, total: 3, onSelect: fn() },
  render: (args) => ({
    components: { ImageTile },
    setup: () => ({ args }),
    template: '<div role="radiogroup" aria-label="Images" style="width: 130px"><ImageTile v-bind="args" /></div>',
  }),
} satisfies Meta<typeof ImageTile>

export default meta
type Story = StoryObj<typeof meta>

/** The picture (here the empty frame: no server answers), the caption under it, nothing selected. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const tile = within(canvasElement).getByRole('radio', { name: /The old bridge at dusk/ })
    await expect(tile).not.toBeChecked()
    await expect(tile).not.toHaveAttribute('aria-current')
    await userEvent.click(tile)
    await expect(args.onSelect).toHaveBeenCalledTimes(1)
  },
}

export const Selected: Story = {
  args: { selected: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('radio')).toBeChecked()
  },
}

/** The shown image carries a visible mark and says so to assistive tech. */
export const Shown: Story = {
  args: { shown: true },
  play: async ({ canvasElement }) => {
    const tile = within(canvasElement).getByRole('radio')
    await expect(tile).toHaveAttribute('aria-current', 'true')
    await expect(within(tile).getByText('Shown')).toBeVisible()
  },
}

/** An image without a caption says so, muted. */
export const NoCaption: Story = {
  args: { image: MAP },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No caption')).toBeVisible()
  },
}

/** A caption of 120 characters stays on one line, ending in an ellipsis. */
export const LongCaption: Story = {
  args: { image: { ...BRIDGE, caption: 'The old bridge at dusk, with the toll keeper waiting at the far end of it, lantern lit and a hand on his belt' }, shown: true },
  play: async ({ canvasElement }) => {
    const caption = canvasElement.querySelector('.it-caption') as HTMLElement
    await expect(caption.scrollWidth).toBeGreaterThan(caption.clientWidth)
    await expect(caption.getBoundingClientRect().height).toBeLessThan(24)
    const tile = within(canvasElement).getByRole('radio')
    await expect(tile.scrollWidth).toBeLessThanOrEqual(tile.clientWidth)
  },
}

/** The thumbnail has a fixed 4:3 frame whatever the picture inside it. */
export const FixedFrame: Story = {
  play: async ({ canvasElement }) => {
    const pic = canvasElement.querySelector('.thumb') as HTMLElement
    const box = pic.getBoundingClientRect()
    await expect(Math.abs(box.width / box.height - 4 / 3)).toBeLessThan(0.02)
  },
}
