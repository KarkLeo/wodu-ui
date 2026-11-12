import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, waitFor, within } from 'storybook/test'
import { ref } from 'vue'
import Thumbnail from './Thumbnail.vue'

const meta = {
  title: 'UI/Thumbnail',
  component: Thumbnail,
  parameters: { layout: 'centered' },
  args: { aspect: '4 / 3', width: '160px' },
} satisfies Meta<typeof Thumbnail>

export default meta
type Story = StoryObj<typeof meta>

/** A real PNG of the given size as a blob address; `done` revokes it. */
async function picture(width: number, height: number): Promise<{ url: string; done: () => void }> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'saddlebrown'
  ctx.fillRect(0, 0, width, height)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  const url = URL.createObjectURL(blob!)
  return { url, done: () => URL.revokeObjectURL(url) }
}

const frame = (el: HTMLElement) => el.querySelector('.thumb') as HTMLElement

/** A wide picture fills a 4:3 frame, cropped by `object-fit: cover`. */
export const Loaded: Story = {
  loaders: [async () => ({ pic: await picture(800, 200) })],
  render: (args, { loaded }) => ({
    components: { Thumbnail },
    setup: () => ({ args, url: (loaded as { pic: { url: string } }).pic.url }),
    template: '<Thumbnail v-bind="args" :src="url" alt="The bridge" />',
  }),
  play: async ({ canvasElement, loaded }) => {
    try {
      const img = within(canvasElement).getByRole('img', { name: 'The bridge' }) as HTMLImageElement
      await waitFor(() => expect(img.complete && img.naturalWidth).toBe(800))
      await expect(frame(canvasElement).dataset.state).toBe('loaded')
      await expect(getComputedStyle(img).objectFit).toBe('cover')
      const box = frame(canvasElement).getBoundingClientRect()
      const rect = img.getBoundingClientRect()
      await expect(Math.abs(rect.width - box.width)).toBeLessThan(1)
      await expect(Math.abs(rect.height - box.height)).toBeLessThan(1)
      await expect(Math.abs(box.width / box.height - 4 / 3)).toBeLessThan(0.02)
    } finally {
      (loaded as { pic: { done: () => void } }).pic.done()
    }
  },
}

/** No address: the dashed frame with the picture mark, and no `<img>`. */
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    await expect(frame(canvasElement).dataset.state).toBe('empty')
    await expect(canvasElement.querySelector('img')).toBeNull()
    await expect(frame(canvasElement)).toHaveClass('is-empty')
  },
}

/** An address that fails to load shows the failed state, never a broken-image icon, and a new address tries again. */
export const FailedThenNewSource: Story = {
  render: (args) => ({
    components: { Thumbnail },
    setup() {
      const src = ref<string | null>('about:blank#not-an-image')
      return { args, src }
    },
    template: '<div><Thumbnail v-bind="args" :src="src" /><button type="button" @click="src = \'data:image/gif;base64,R0lGODlhAQABAAAAACw=\'">Next</button></div>',
  }),
  play: async ({ canvasElement }) => {
    const img = canvasElement.querySelector('img')!
    img.dispatchEvent(new Event('error'))
    await waitFor(() => expect(frame(canvasElement).dataset.state).toBe('failed'))
    await expect(canvasElement.querySelector('img')).toBeNull()
    await expect(frame(canvasElement)).toHaveClass('is-empty')
    within(canvasElement).getByRole('button', { name: 'Next' }).click()
    await waitFor(() => expect(frame(canvasElement).dataset.state).toBe('loaded'))
    await expect(canvasElement.querySelector('img')).not.toBeNull()
  },
}

/** Without an aspect the frame takes its width and height. */
export const FixedSize: Story = {
  args: { aspect: undefined, width: '60px', height: '38px' },
  play: async ({ canvasElement }) => {
    const box = frame(canvasElement).getBoundingClientRect()
    await expect(Math.round(box.width)).toBe(60)
    await expect(Math.round(box.height)).toBe(38)
  },
}
