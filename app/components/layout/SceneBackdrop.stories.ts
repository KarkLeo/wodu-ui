import { ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import SceneBackdrop from './SceneBackdrop.vue'
import { colourPicture, controlDecode } from '@/stories/playback'

const meta = {
  title: 'Layout/SceneBackdrop',
  component: SceneBackdrop,
  tags: ['no-visual'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SceneBackdrop>

export default meta
type Story = StoryObj<typeof meta>

const RED = colourPicture('crimson')
const BLUE = colourPicture('royalblue')
const GREEN = colourPicture('seagreen')

// The backdrop fills its parent; the buttons stand in for the table's stage changes.
function harness(first: string | null = null) {
  return () => ({
    components: { SceneBackdrop },
    setup() {
      const url = ref<string | null>(first)
      return { url, RED, BLUE, GREEN }
    },
    template: `
      <div style="position: relative; height: 240px; overflow: hidden">
        <SceneBackdrop :url="url" />
        <div style="position: relative; z-index: 1; display: flex; gap: 8px; padding: 12px">
          <button type="button" @click="url = RED">Red</button>
          <button type="button" @click="url = BLUE">Blue</button>
          <button type="button" @click="url = GREEN">Green</button>
          <button type="button" @click="url = null">Default</button>
        </div>
      </div>`,
  })
}

const layers = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('[data-layer]'))
const shown = (el: HTMLElement | undefined) => el?.style.backgroundImage ?? ''
const base = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-layer="base"]')!
const incoming = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-layer="incoming"]')

/** The picture with nothing asked for: the bundled default. */
export const NullShowsDefault: Story = {
  args: { url: null },
  render: harness(),
  play: async ({ canvasElement }) => {
    const decode = controlDecode(true)
    try {
      await expect(layers(canvasElement)).toHaveLength(1)
      await expect(shown(base(canvasElement))).toContain('bg')
      await expect(shown(base(canvasElement))).not.toContain('data:')
      const canvas = within(canvasElement)
      await userEvent.click(canvas.getByRole('button', { name: 'Red' }))
      await waitFor(() => expect(shown(base(canvasElement))).toBe(`url("${RED}")`), { timeout: 4000 })
      // Back to null: the default returns, not a blank.
      await userEvent.click(canvas.getByRole('button', { name: 'Default' }))
      await waitFor(() => expect(shown(base(canvasElement))).not.toContain('data:'), { timeout: 4000 })
      await expect(shown(base(canvasElement))).toContain('bg')
    } finally {
      decode.restore()
    }
  },
}

/** The new picture appears only once it has decoded, fades in over the old one, and the old one is then gone. */
export const SwitchCrossfades: Story = {
  args: { url: null },
  render: harness(),
  play: async ({ canvasElement }) => {
    const decode = controlDecode()
    try {
      const canvas = within(canvasElement)
      const original = shown(base(canvasElement))
      await userEvent.click(canvas.getByRole('button', { name: 'Blue' }))
      await waitFor(() => expect(decode.waiting(BLUE)).toBe(true))
      // Still decoding: nothing of the new picture is on screen.
      await expect(incoming(canvasElement)).toBeNull()
      await expect(shown(base(canvasElement))).toBe(original)
      decode.release(BLUE)
      await waitFor(() => expect(incoming(canvasElement)).not.toBeNull())
      await expect(shown(incoming(canvasElement)!)).toBe(`url("${BLUE}")`)
      // Under way: both layers exist while it fades.
      await expect(layers(canvasElement)).toHaveLength(2)
      await waitFor(() => expect(incoming(canvasElement)).toHaveClass('is-visible'))
      // Done: the new picture is the only layer.
      await waitFor(() => expect(incoming(canvasElement)).toBeNull(), { timeout: 4000 })
      await expect(layers(canvasElement)).toHaveLength(1)
      await expect(shown(base(canvasElement))).toBe(`url("${BLUE}")`)
    } finally {
      decode.restore()
    }
  },
}

/** A picture that cannot be decoded changes nothing on screen. */
export const FailedImageKeepsCurrent: Story = {
  args: { url: null },
  render: harness(),
  play: async ({ canvasElement }) => {
    const decode = controlDecode()
    try {
      const canvas = within(canvasElement)
      const original = shown(base(canvasElement))
      await userEvent.click(canvas.getByRole('button', { name: 'Red' }))
      await waitFor(() => expect(decode.waiting(RED)).toBe(true))
      decode.fail(RED)
      await new Promise(resolve => setTimeout(resolve, 300))
      await expect(incoming(canvasElement)).toBeNull()
      await expect(shown(base(canvasElement))).toBe(original)
      // The next picture still works after a failure.
      await userEvent.click(canvas.getByRole('button', { name: 'Green' }))
      await waitFor(() => expect(decode.waiting(GREEN)).toBe(true))
      decode.release(GREEN)
      await waitFor(() => expect(shown(base(canvasElement))).toBe(`url("${GREEN}")`), { timeout: 4000 })
    } finally {
      decode.restore()
    }
  },
}

/** Two pictures asked for in turn: the one that finishes decoding late, after the newer was asked for, never appears. */
export const LatestWins: Story = {
  args: { url: null },
  render: harness(),
  play: async ({ canvasElement }) => {
    const decode = controlDecode()
    try {
      const canvas = within(canvasElement)
      await userEvent.click(canvas.getByRole('button', { name: 'Red' }))
      await waitFor(() => expect(decode.waiting(RED)).toBe(true))
      await userEvent.click(canvas.getByRole('button', { name: 'Blue' }))
      await waitFor(() => expect(decode.waiting(BLUE)).toBe(true))
      decode.release(BLUE)
      await waitFor(() => expect(shown(incoming(canvasElement) ?? undefined)).toBe(`url("${BLUE}")`))
      // The older request decodes only now.
      decode.release(RED)
      await new Promise(resolve => setTimeout(resolve, 200))
      for (const layer of layers(canvasElement)) await expect(shown(layer)).not.toBe(`url("${RED}")`)
      await waitFor(() => expect(shown(base(canvasElement))).toBe(`url("${BLUE}")`), { timeout: 4000 })
      await expect(layers(canvasElement)).toHaveLength(1)
    } finally {
      decode.restore()
    }
  },
}

interface Frame { incoming: number; base: number; shown: string; coming: string }

/** One reading per animation frame of both layers, until stopped. */
function recordFrames(root: HTMLElement) {
  const frames: Frame[] = []
  let running = true
  const read = () => {
    if (!running) return
    const el = incoming(root)
    frames.push({
      incoming: el ? Number(getComputedStyle(el).opacity) : 0,
      base: Number(getComputedStyle(base(root)).opacity),
      shown: shown(base(root)),
      coming: shown(el ?? undefined),
    })
    requestAnimationFrame(read)
  }
  read()
  return { stop() { running = false; return frames } }
}

// One animation step is a frame's share of the 2 s fade (about 0.01 at 60 fps); a slow frame may take a few.
const MAX_STEP = 0.1

// How much of each picture the eye gets: the incoming layer covers the base by its opacity. Handing the
// finished fade over to the base layer keeps every weight, so only a real jump shows as a step.
function weights(f: Frame): Map<string, number> {
  const w = new Map<string, number>([[f.shown, 1]])
  if (f.coming) {
    w.set(f.coming, (w.get(f.coming) ?? 0) + f.incoming)
    w.set(f.shown, (w.get(f.shown) ?? 0) - f.incoming)
  }
  return w
}

async function expectNoCut(frames: Frame[]) {
  await expect(frames.length).toBeGreaterThan(20)
  for (let i = 1; i < frames.length; i++) {
    const before = weights(frames[i - 1]!)
    const after = weights(frames[i]!)
    for (const picture of new Set([...before.keys(), ...after.keys()])) {
      await expect(Math.abs((after.get(picture) ?? 0) - (before.get(picture) ?? 0))).toBeLessThan(MAX_STEP)
    }
    await expect(frames[i]!.base).toBe(1)
  }
}

const twoFrames = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

/** The pictures that were ever fully shown (the base layer), in order. */
const sequence = (frames: Frame[]) => frames.map(f => f.shown).filter((v, i, all) => i === 0 || v !== all[i - 1])

const midFade = (root: HTMLElement) => waitFor(() => {
  const opacity = Number(getComputedStyle(incoming(root)!).opacity)
  expect(opacity).toBeGreaterThan(0.35)
  expect(opacity).toBeLessThan(0.75)
}, { timeout: 3000, interval: 20 })

const settled = (root: HTMLElement, picture: string) => waitFor(() => {
  expect(incoming(root)).toBeNull()
  expect(shown(base(root))).toBe(picture)
}, { timeout: 6000 })

/**
 * A fade is never interrupted: a new request in the middle of one waits, and when the fade has ended the
 * backdrop fades on from what is then shown. A to B with C asked for mid-fade shows A, B, C, and no layer
 * ever jumps.
 */
export const NewRequestWaitsForTheFade: Story = {
  args: { url: null },
  render: harness(),
  play: async ({ canvasElement }) => {
    const decode = controlDecode(true)
    try {
      const canvas = within(canvasElement)
      const original = shown(base(canvasElement))
      const recording = recordFrames(canvasElement)
      await userEvent.click(canvas.getByRole('button', { name: 'Blue' }))
      await waitFor(() => expect(incoming(canvasElement)).not.toBeNull())
      await midFade(canvasElement)
      await userEvent.click(canvas.getByRole('button', { name: 'Green' }))
      // The fade to Blue goes on: Green is not on screen yet.
      await expect(shown(incoming(canvasElement)!)).toBe(`url("${BLUE}")`)
      await settled(canvasElement, `url("${GREEN}")`)
      await twoFrames()
      const frames = recording.stop()
      await expectNoCut(frames)
      await expect(sequence(frames)).toEqual([original, `url("${BLUE}")`, `url("${GREEN}")`])
    } finally {
      decode.restore()
    }
  },
}

/** Back to the picture that was showing, mid-fade to another: the fade to it completes, then it fades back. */
export const BackToTheBaseDuringAFade: Story = {
  args: { url: null },
  render: harness(),
  play: async ({ canvasElement }) => {
    const decode = controlDecode(true)
    try {
      const canvas = within(canvasElement)
      const original = shown(base(canvasElement))
      const recording = recordFrames(canvasElement)
      await userEvent.click(canvas.getByRole('button', { name: 'Blue' }))
      await waitFor(() => expect(incoming(canvasElement)).not.toBeNull())
      await midFade(canvasElement)
      await userEvent.click(canvas.getByRole('button', { name: 'Default' }))
      await waitFor(() => expect(shown(base(canvasElement))).toBe(`url("${BLUE}")`), { timeout: 4000 })
      await settled(canvasElement, original)
      await twoFrames()
      const frames = recording.stop()
      await expectNoCut(frames)
      await expect(sequence(frames)).toEqual([original, `url("${BLUE}")`, original])
    } finally {
      decode.restore()
    }
  },
}

/** C, then D, asked for mid-fade: C is never shown and its load is cancelled; the pictures shown are A, B, D. */
export const SupersededTargetIsNeverShown: Story = {
  args: { url: null },
  render: harness(),
  play: async ({ canvasElement }) => {
    const decode = controlDecode()
    try {
      const canvas = within(canvasElement)
      const original = shown(base(canvasElement))
      const recording = recordFrames(canvasElement)
      await userEvent.click(canvas.getByRole('button', { name: 'Blue' }))
      await waitFor(() => expect(decode.waiting(BLUE)).toBe(true))
      decode.release(BLUE)
      await waitFor(() => expect(incoming(canvasElement)).not.toBeNull())
      await midFade(canvasElement)
      // Red is asked for mid-fade and is still loading when Green replaces it.
      await userEvent.click(canvas.getByRole('button', { name: 'Red' }))
      await waitFor(() => expect(decode.waiting(RED)).toBe(true))
      await userEvent.click(canvas.getByRole('button', { name: 'Green' }))
      await waitFor(() => expect(decode.waiting(GREEN)).toBe(true))
      await expect(decode.images.filter(img => img.getAttribute('src') === RED)).toHaveLength(0)
      decode.release(GREEN)
      await waitFor(() => expect(shown(base(canvasElement))).toBe(`url("${BLUE}")`), { timeout: 4000 })
      await settled(canvasElement, `url("${GREEN}")`)
      decode.release(RED)
      await twoFrames()
      const frames = recording.stop()
      await expectNoCut(frames)
      await expect(sequence(frames)).toEqual([original, `url("${BLUE}")`, `url("${GREEN}")`])
    } finally {
      decode.restore()
    }
  },
}

/** A picture still loading when a newer one is asked for, or when the backdrop goes, has its download cancelled. */
export const StaleLoadsAreCancelled: Story = {
  args: { url: null },
  render: () => ({
    components: { SceneBackdrop },
    setup() {
      const url = ref<string | null>(null)
      const shownOn = ref(true)
      return { url, shownOn, RED, BLUE }
    },
    template: `
      <div style="position: relative; height: 240px; overflow: hidden">
        <SceneBackdrop v-if="shownOn" :url="url" />
        <div style="position: relative; z-index: 1; display: flex; gap: 8px; padding: 12px">
          <button type="button" @click="url = RED">Red</button>
          <button type="button" @click="url = BLUE">Blue</button>
          <button type="button" @click="url = null">Default</button>
          <button type="button" @click="shownOn = false">Remove</button>
        </div>
      </div>`,
  }),
  play: async ({ canvasElement }) => {
    const decode = controlDecode()
    try {
      const canvas = within(canvasElement)
      const loading = (src: string) => decode.images.filter(img => img.getAttribute('src') === src)
      // Superseded by a newer request.
      await userEvent.click(canvas.getByRole('button', { name: 'Red' }))
      await waitFor(() => expect(decode.waiting(RED)).toBe(true))
      await userEvent.click(canvas.getByRole('button', { name: 'Blue' }))
      await waitFor(() => expect(decode.waiting(BLUE)).toBe(true))
      await expect(loading(RED)).toHaveLength(0)
      await expect(loading(BLUE)).toHaveLength(1)
      // Turned off (the picture is asked back to the default).
      await userEvent.click(canvas.getByRole('button', { name: 'Default' }))
      await waitFor(() => expect(loading(BLUE)).toHaveLength(0))
      // Gone with the component.
      await userEvent.click(canvas.getByRole('button', { name: 'Red' }))
      await waitFor(() => expect(loading(RED)).toHaveLength(1))
      await userEvent.click(canvas.getByRole('button', { name: 'Remove' }))
      await waitFor(() => expect(loading(RED)).toHaveLength(0))
    } finally {
      decode.restore()
    }
  },
}
