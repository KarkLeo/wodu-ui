import { ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import ShownImageReveal from './ShownImageReveal.vue'
import { drawPicture, holdImages, LONG_CAPTION, PORTRAIT, servePictures, TINY_ICON, WIDE_MAP } from '@/stories/pictures'

const meta = {
  title: 'Features/Stage/ShownImageReveal',
  component: ShownImageReveal,
  tags: ['no-visual'],
  parameters: { layout: 'fullscreen' },
  args: { open: true, image: null },
  render: (args) => ({
    components: { ShownImageReveal },
    setup() {
      const open = ref(args.open)
      return { args, open }
    },
    template: '<button type="button" data-shown-image-open @click="open = true">Card</button><ShownImageReveal v-model:open="open" :image="args.image" /><p>{{ open ? "open" : "closed" }}</p>',
  }),
} satisfies Meta<typeof ShownImageReveal>

export default meta
type Story = StoryObj<typeof meta>

let hold: ReturnType<typeof holdImages> | undefined

const body = (el: HTMLElement) => within(el.ownerDocument.body)

type SetViewport = (width: number, height: number) => Promise<void>
const setViewport = (globalThis as { __setStoryViewport?: SetViewport }).__setStoryViewport

const SIZES = { phone: [375, 667], landscape: [667, 375], desktop: [1280, 720] } as const

async function inDialog(
  canvasElement: HTMLElement,
  size: readonly [number, number],
  natural: { width: number; height: number },
  check?: (img: HTMLImageElement) => Promise<void> | void,
) {
  // Only the test runner can resize the browser; in Storybook itself the viewport toolbar does that.
  if (setViewport) await setViewport(...size)
  try {
    const img = await waitFor(() => {
      const el = canvasElement.ownerDocument.querySelector<HTMLImageElement>('.sir-img')
      if (!el || !el.complete || el.naturalWidth === 0 || el.classList.contains('is-pending')) throw new Error('not loaded')
      return el
    })
    const box = img.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    await expect(box.left).toBeGreaterThanOrEqual(0)
    await expect(box.top).toBeGreaterThanOrEqual(0)
    await expect(box.right).toBeLessThanOrEqual(vw)
    await expect(box.bottom).toBeLessThanOrEqual(vh)
    // Never upscaled.
    await expect(box.width).toBeLessThanOrEqual(natural.width + 0.5)
    await expect(box.height).toBeLessThanOrEqual(natural.height + 0.5)
    // Never cropped: the box keeps the picture's own ratio.
    await expect(Math.abs(box.width / box.height - natural.width / natural.height)).toBeLessThan(0.02 * (natural.width / natural.height) + 0.02)
    // The close button and the caption stay on screen.
    const panel = canvasElement.ownerDocument.querySelector('.sir-panel')!.getBoundingClientRect()
    await expect(panel.top).toBeGreaterThanOrEqual(0)
    await expect(panel.bottom).toBeLessThanOrEqual(vh + 0.5)
    const close = body(canvasElement).getByRole('button', { name: 'Close' }).getBoundingClientRect()
    await expect(close.top).toBeGreaterThanOrEqual(0)
    await expect(close.right).toBeLessThanOrEqual(vw)
    await check?.(img)
  } finally {
    if (setViewport) await setViewport(1280, 720)
  }
}

const portrait = { url: drawPicture(PORTRAIT.width, PORTRAIT.height), caption: 'Brakk the ogre, scarred and sullen' }
const wide = { url: drawPicture(WIDE_MAP.width, WIDE_MAP.height), caption: 'The marsh road' }
const tiny = { url: drawPicture(TINY_ICON.width, TINY_ICON.height), caption: 'A silver key' }

export const PortraitPhone: Story = { args: { image: portrait }, play: ({ canvasElement }) => inDialog(canvasElement, SIZES.phone, PORTRAIT) }
export const PortraitLandscapePhone: Story = { args: { image: portrait }, play: ({ canvasElement }) => inDialog(canvasElement, SIZES.landscape, PORTRAIT) }
export const PortraitDesktop: Story = { args: { image: portrait }, play: ({ canvasElement }) => inDialog(canvasElement, SIZES.desktop, PORTRAIT) }
export const WideMapPhone: Story = { args: { image: wide }, play: ({ canvasElement }) => inDialog(canvasElement, SIZES.phone, WIDE_MAP) }
export const WideMapLandscapePhone: Story = { args: { image: wide }, play: ({ canvasElement }) => inDialog(canvasElement, SIZES.landscape, WIDE_MAP) }
export const WideMapDesktop: Story = { args: { image: wide }, play: ({ canvasElement }) => inDialog(canvasElement, SIZES.desktop, WIDE_MAP) }

/** A 48 px icon stays 48 px, on every screen. */
export const TinyIconPhone: Story = {
  args: { image: tiny },
  play: ({ canvasElement }) => inDialog(canvasElement, SIZES.phone, TINY_ICON, async (img) => {
    await expect(Math.round(img.getBoundingClientRect().width)).toBe(TINY_ICON.width)
  }),
}
export const TinyIconDesktop: Story = {
  args: { image: tiny },
  play: ({ canvasElement }) => inDialog(canvasElement, SIZES.desktop, TINY_ICON, async (img) => {
    await expect(Math.round(img.getBoundingClientRect().width)).toBe(TINY_ICON.width)
  }),
}

/** 120 characters under a portrait on a landscape phone: the close button is reachable and the dialog fits the screen. */
export const LongCaption: Story = {
  args: { image: { url: portrait.url, caption: LONG_CAPTION } },
  play: async ({ canvasElement }) => {
    await inDialog(canvasElement, SIZES.landscape, PORTRAIT)
    await inDialog(canvasElement, SIZES.phone, PORTRAIT)
    await waitFor(() => expect(body(canvasElement).getByRole('dialog', { name: LONG_CAPTION })).toBeVisible())
  },
}

export const NamedAfterTheCaption: Story = {
  args: { image: portrait },
  play: async ({ canvasElement }) => {
    const found = await body(canvasElement).findByRole('dialog', { name: 'Brakk the ogre, scarred and sullen' })
    await waitFor(() => expect(found).toBeVisible())
  },
}

export const GenericNameWithoutACaption: Story = {
  args: { image: { url: wide.url, caption: null } },
  play: async ({ canvasElement }) => {
    const found = await body(canvasElement).findByRole('dialog', { name: 'Shown image' })
    await waitFor(() => expect(found).toBeVisible())
  },
}

/** Esc, the close button and a click outside all close it; focus goes back to the card's picture button. */
export const ClosesThreeWays: Story = {
  args: { image: portrait },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument
    const card = () => within(canvasElement).getByRole('button', { name: 'Card' })
    const dialog = () => body(canvasElement).queryByRole('dialog')
    await waitFor(() => expect(dialog()).not.toBeNull())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(dialog()).toBeNull())
    await waitFor(() => expect(doc.activeElement).toBe(card()))

    await userEvent.click(card())
    await waitFor(() => expect(dialog()).not.toBeNull())
    await userEvent.click(body(canvasElement).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(dialog()).toBeNull())
    await waitFor(() => expect(doc.activeElement).toBe(card()))

    await userEvent.click(card())
    await waitFor(() => expect(dialog()).not.toBeNull())
    await userEvent.click(doc.querySelector('.sir-veil')!)
    await waitFor(() => expect(dialog()).toBeNull())
    await expect(within(canvasElement).getByText('closed')).toBeVisible()
  },
}

/** The dialog shows a quiet loading state, then the picture, with no jump in between. */
export const LoadingState: Story = {
  args: { image: portrait },
  // Restored by the story's own cleanup, so a story that never reaches `play` leaves nothing behind.
  beforeEach: () => {
    hold = holdImages()
    return () => hold?.restore()
  },
  play: async ({ canvasElement }) => {
    try {
      const note = await body(canvasElement).findByText('Loading the image…')
      await waitFor(() => expect(note).toBeVisible())
      await expect(canvasElement.ownerDocument.querySelector('.sir-img.is-pending')).not.toBeNull()
      hold!.release()
      await waitFor(() => expect(body(canvasElement).queryByText('Loading the image…')).toBeNull())
      await waitFor(() => expect(canvasElement.ownerDocument.querySelector('.sir-img.is-pending')).toBeNull())
    } finally {
      hold?.restore()
    }
  },
}

/** A failed picture is not remembered: once it can be fetched, closing and reopening shows it. */
export const ReopeningAfterAFailureShowsThePicture: Story = {
  args: { image: { url: 'http://127.0.0.1:8090/api/files/images/story-retry/image.png', caption: 'Retried' } },
  play: async ({ canvasElement }) => {
    const note = await body(canvasElement).findByText('The image could not be loaded.')
    await waitFor(() => expect(note).toBeVisible())
    await userEvent.click(body(canvasElement).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
    const restore = servePictures({ 'story-retry': portrait.url })
    try {
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Card' }))
      await waitFor(() => expect(canvasElement.ownerDocument.querySelector('.sir-img:not(.is-pending)')).not.toBeNull())
      await expect(body(canvasElement).queryByText('The image could not be loaded.')).toBeNull()
    } finally {
      restore()
    }
  },
}

/** A picture that cannot load shows the note, and the dialog can still be closed. */
export const ImageFailsToLoad: Story = {
  args: { image: { url: 'data:image/png;base64,AAAA', caption: 'Broken' } },
  play: async ({ canvasElement }) => {
    const note = await body(canvasElement).findByText('The image could not be loaded.')
    await waitFor(() => expect(note).toBeVisible())
    await userEvent.click(body(canvasElement).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
  },
}

/**
 * The browser here cannot be switched to reduced motion, so this reads the style sheets: the dialog's animation exists
 * only inside a `no-preference` query, and no rule outside it moves anything.
 */
export const ReducedMotion: Story = {
  args: { image: portrait },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).not.toBeNull())
    const moving: string[] = []
    let guarded = 0
    const visit = (rules: CSSRuleList, inNoPreference: boolean) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule) {
          visit(rule.cssRules, inNoPreference || rule.conditionText.includes('prefers-reduced-motion: no-preference'))
        } else if (rule instanceof CSSStyleRule && /\.sir-/.test(rule.selectorText)) {
          // Read the shorthands: a `var()` inside one leaves its longhands empty.
          const moves = ['animation', 'transition'].some(name => {
            const value = rule.style.getPropertyValue(name)
            return value !== '' && value !== 'none'
          })
          if (moves && inNoPreference) guarded++
          if (moves && !inNoPreference) moving.push(rule.selectorText)
        }
      }
    }
    for (const sheet of Array.from(canvasElement.ownerDocument.styleSheets)) {
      try { visit(sheet.cssRules, false) } catch { /* a cross-origin sheet */ }
    }
    await expect(moving).toEqual([])
    await expect(guarded).toBeGreaterThan(0)
  },
}
