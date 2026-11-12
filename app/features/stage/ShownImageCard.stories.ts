import { ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import ShownImageCard from './ShownImageCard.vue'
import { drawPicture, holdImages, LONG_CAPTION, PORTRAIT, TINY_ICON, WIDE_MAP } from '@/stories/pictures'

const meta = {
  title: 'Features/Stage/ShownImageCard',
  component: ShownImageCard,
  tags: ['no-visual'],
  parameters: { layout: 'centered' },
  args: { url: '', caption: 'The old bridge at dusk', onOpen: fn() },
  decorators: [(story) => ({
    components: { story },
    template: '<div style="width: min(440px, 100vw - 32px); height: 640px; background: var(--vtt-bg-elevated); border-radius: var(--r-lg); overflow: hidden"><story /></div>',
  })],
} satisfies Meta<typeof ShownImageCard>

export default meta
type Story = StoryObj<typeof meta>

const imageIn = (el: HTMLElement) => el.querySelector<HTMLImageElement>('.sic-img')!
// Loaded and shown: the card keeps a picture hidden behind its loading note until the picture has arrived.
const loaded = (el: HTMLElement) => waitFor(() => expect(imageIn(el).complete && imageIn(el).naturalWidth > 0 && !imageIn(el).classList.contains('is-pending')).toBe(true))

/** A tall portrait: the whole picture, never cropped, and the card does not outgrow its column. */
export const Portrait: Story = {
  args: { url: drawPicture(PORTRAIT.width, PORTRAIT.height) },
  play: async ({ canvasElement }) => {
    await loaded(canvasElement)
    const img = imageIn(canvasElement)
    const box = img.getBoundingClientRect()
    await expect(img.naturalWidth / img.naturalHeight).toBeCloseTo(PORTRAIT.width / PORTRAIT.height, 5)
    await expect(getComputedStyle(img).objectFit).toBe('contain')
    await expect(box.height).toBeLessThanOrEqual(520.5)
    const column = canvasElement.querySelector('.sic')!.getBoundingClientRect()
    await expect(box.bottom).toBeLessThanOrEqual(column.bottom + 1)
  },
}

export const WideMap: Story = {
  args: { url: drawPicture(WIDE_MAP.width, WIDE_MAP.height), caption: null },
  play: async ({ canvasElement }) => {
    await loaded(canvasElement)
    const box = imageIn(canvasElement).getBoundingClientRect()
    await expect(box.width).toBeLessThanOrEqual(440)
    await expect(canvasElement.querySelector('.sic-caption')).toBeNull()
  },
}

export const TinyIcon: Story = {
  args: { url: drawPicture(TINY_ICON.width, TINY_ICON.height), caption: 'A silver key' },
  play: async ({ canvasElement }) => {
    await loaded(canvasElement)
    await expect(within(canvasElement).getByText('A silver key')).toBeVisible()
    // Natural size, not stretched to the card's width.
    const box = imageIn(canvasElement).getBoundingClientRect()
    await expect(Math.round(box.width)).toBe(TINY_ICON.width)
    await expect(Math.round(box.height)).toBe(TINY_ICON.height)
  },
}

/** 120 characters wrap under the picture, and a word with no break in it stays inside the card. */
export const LongCaption: Story = {
  args: { url: drawPicture(WIDE_MAP.width, WIDE_MAP.height), caption: `${LONG_CAPTION.slice(0, 60)} ${'W'.repeat(55)}` },
  play: async ({ canvasElement }) => {
    await loaded(canvasElement)
    const caption = canvasElement.querySelector<HTMLElement>('.sic-caption')!
    await expect(caption.scrollWidth).toBeLessThanOrEqual(caption.clientWidth)
  },
}

/** The picture is a button; with a caption it is named after it, and a click asks to open the large view. */
export const OpensByClick: Story = {
  args: { url: drawPicture(PORTRAIT.width, PORTRAIT.height) },
  play: async ({ canvasElement, args }) => {
    const open = within(canvasElement).getByRole('button', { name: 'Open: The old bridge at dusk' })
    await userEvent.click(open)
    await expect(args.onOpen).toHaveBeenCalledTimes(1)
  },
}

export const WithoutCaptionHasAGenericName: Story = {
  args: { url: drawPicture(WIDE_MAP.width, WIDE_MAP.height), caption: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Open the shown image' })).toBeVisible()
  },
}

/** A picture that cannot load shows a note, not a broken-image icon; the caption stays. */
export const ImageFailsToLoad: Story = {
  args: { url: 'data:image/png;base64,AAAA' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('The image could not be loaded.')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: /^Open/ })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(canvas.getByText('The old bridge at dusk')).toBeVisible()
  },
}

let hold: ReturnType<typeof holdImages> | undefined

/** Until the picture is there the card shows a quiet note in a frame of some height, not a thin empty button. */
export const LoadingState: Story = {
  args: { url: drawPicture(PORTRAIT.width, PORTRAIT.height) },
  beforeEach: () => {
    hold = holdImages()
    return () => hold?.restore()
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const open = canvas.getByRole('button', { name: 'Open: The old bridge at dusk' })
    await expect(canvas.getByText('Loading the image…')).toBeVisible()
    await expect(open.getBoundingClientRect().height).toBeGreaterThanOrEqual(96)
    await expect(imageIn(canvasElement)).toHaveClass('is-pending')
    hold!.release()
    await loaded(canvasElement)
    await waitFor(() => expect(canvas.queryByText('Loading the image…')).toBeNull())
    await expect(imageIn(canvasElement)).not.toHaveClass('is-pending')
  },
}

/** Another picture while one is shown: the old one is not left under the new caption while the new one loads. */
export const ReplacementDoesNotShowTheOldPicture: Story = {
  args: { url: drawPicture(WIDE_MAP.width, WIDE_MAP.height) },
  render: (args) => ({
    components: { ShownImageCard },
    setup() {
      const shown = ref({ url: args.url, caption: args.caption })
      const replace = () => { shown.value = { url: drawPicture(PORTRAIT.width, PORTRAIT.height, 'ogre'), caption: 'Brakk the ogre' } }
      return { shown, replace }
    },
    template: '<button type="button" @click="replace">Replace</button><ShownImageCard :url="shown.url" :caption="shown.caption" />',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await loaded(canvasElement)
    const first = imageIn(canvasElement)
    hold = holdImages()
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Replace' }))
      await expect(await canvas.findByText('Brakk the ogre')).toBeVisible()
      // A new element for the new picture, hidden until it has loaded; the old picture is gone.
      await waitFor(() => expect(imageIn(canvasElement)).not.toBe(first))
      await expect(first.isConnected).toBe(false)
      await expect(imageIn(canvasElement)).toHaveClass('is-pending')
      await expect(canvas.getByText('Loading the image…')).toBeVisible()
      hold.release()
      await loaded(canvasElement)
      await expect(imageIn(canvasElement).naturalHeight).toBe(PORTRAIT.height)
    } finally {
      hold.restore()
    }
  },
}
