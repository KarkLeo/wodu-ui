import { nextTick, ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor as waitForDefault, within } from 'storybook/test'
import SceneBackdrop from './SceneBackdrop.vue'
import { colourPicture, controlDecode } from '@/stories/playback'

// A slow runner takes longer than the default second for a layer, a fade or a prompt to appear.
const waitFor: typeof waitForDefault = (callback, options) => waitForDefault(callback, { timeout: 10000, ...options })

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

// The backdrop fills its parent; the buttons stand in for the table's stage changes. `fade` replaces the 2 s fade.
function harness(first: string | null = null, fade?: string) {
  return () => ({
    components: { SceneBackdrop },
    setup() {
      const url = ref<string | null>(first)
      const frame = { position: 'relative', height: '240px', overflow: 'hidden', ...(fade ? { '--sb-fade': fade } : {}) }
      return { url, frame, RED, BLUE, GREEN }
    },
    template: `
      <div :style="frame">
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
      await waitFor(() => expect(shown(base(canvasElement))).toBe(`url("${RED}")`), { timeout: 10000 })
      // Back to null: the default returns, not a blank.
      await userEvent.click(canvas.getByRole('button', { name: 'Default' }))
      await waitFor(() => expect(shown(base(canvasElement))).not.toContain('data:'), { timeout: 10000 })
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
      // The app's fade: 2 s, the length of the scene sound's crossfade.
      await expect(getComputedStyle(incoming(canvasElement)!).transitionDuration).toBe('2s')
      // Under way: both layers exist while it fades.
      await expect(layers(canvasElement)).toHaveLength(2)
      await waitFor(() => expect(incoming(canvasElement)).toHaveClass('is-visible'))
      // Done: the new picture is the only layer.
      await waitFor(() => expect(incoming(canvasElement)).toBeNull(), { timeout: 10000 })
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
      await waitFor(() => expect(shown(base(canvasElement))).toBe(`url("${GREEN}")`), { timeout: 10000 })
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
      await waitFor(() => expect(shown(base(canvasElement))).toBe(`url("${BLUE}")`), { timeout: 10000 })
      await expect(layers(canvasElement)).toHaveLength(1)
    } finally {
      decode.restore()
    }
  },
}

// Long enough that no fade can end by itself while a story looks at it: the mid-fade stories step it instead.
const HELD_FADE = '1000s'

/** One reading of both layers, at a point of the stepped fades: fade `n` at fraction `f` is progress `n + f`. */
interface Frame { progress: number; incoming: number; base: number; shown: string; coming: string }

function read(root: HTMLElement, progress: number): Frame {
  const el = incoming(root)
  return {
    progress,
    incoming: el ? Number(getComputedStyle(el).opacity) : 0,
    base: Number(getComputedStyle(base(root)).opacity),
    shown: shown(base(root)),
    coming: shown(el ?? undefined),
  }
}

// The fade eases, so its fastest moment runs at about 2.2 times the average rate; what a step may change depends on
// how much of a fade it covers, so stepping through a fade is not a cut while a change at one point of it (a 40% jump
// with no progress) still fails.
const allowedStep = (progress: number) => progress * 3 + 0.02

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
  for (let i = 1; i < frames.length; i++) {
    const before = weights(frames[i - 1]!)
    const after = weights(frames[i]!)
    const limit = allowedStep(frames[i]!.progress - frames[i - 1]!.progress)
    for (const picture of new Set([...before.keys(), ...after.keys()])) {
      await expect(Math.abs((after.get(picture) ?? 0) - (before.get(picture) ?? 0))).toBeLessThanOrEqual(limit)
    }
    await expect(frames[i]!.base).toBe(1)
  }
}

/** The pictures that were ever fully shown (the base layer), in order. */
const sequence = (frames: Frame[]) => frames.map(f => f.shown).filter((v, i, all) => i === 0 || v !== all[i - 1])

/** The incoming layer's opacity transition, once the fade has begun (the layer waits a frame at opacity 0 first). */
const fadeOf = (root: HTMLElement) => waitFor(() => {
  const el = incoming(root)
  const transition = el?.getAnimations().find((a): a is CSSTransition => a instanceof CSSTransition && a.transitionProperty === 'opacity')
  if (!el || !transition) throw new Error('the fade has not begun')
  return { el, transition }
})

/**
 * Drives fade number `n` through the CSS transition itself: holds it, reads both layers at each chosen fraction,
 * runs `act` at one of them (and reads again, at the same point), then finishes it, so the layer reports its own end,
 * and reads once more after the component has handed the fade over. Nothing waits on the clock.
 */
async function stepFade(
  root: HTMLElement,
  frames: Frame[],
  n: number,
  fractions: number[],
  during?: { at: number; act: (layer: HTMLElement) => Promise<void> },
) {
  const { el, transition } = await fadeOf(root)
  transition.pause()
  // The fade this story set, not the 2 s of the app: it cannot end before the story finishes it.
  await expect(getComputedStyle(el).transitionDuration).toBe(HELD_FADE)
  const total = Number(transition.effect!.getComputedTiming().duration)
  for (const f of fractions) {
    transition.currentTime = f * total
    frames.push(read(root, n + f))
    if (during && during.at === f) {
      await during.act(el)
      frames.push(read(root, n + f))
    }
  }
  transition.finish()
  // The layer's transitionend ends the fade: it is gone, and its picture is the base.
  await waitFor(() => expect(incoming(root) === el).toBe(false))
  frames.push(read(root, n + 1))
}

const settled = (root: HTMLElement, picture: string) => waitFor(() => {
  expect(incoming(root)).toBeNull()
  expect(shown(base(root))).toBe(picture)
})

/**
 * A fade is never interrupted: a new request in the middle of one waits, and when the fade has ended the
 * backdrop fades on from what is then shown. A to B with C asked for mid-fade shows A, B, C, and no layer
 * ever jumps.
 */
export const NewRequestWaitsForTheFade: Story = {
  args: { url: null },
  render: harness(null, HELD_FADE),
  play: async ({ canvasElement }) => {
    const decode = controlDecode(true)
    try {
      const canvas = within(canvasElement)
      const original = shown(base(canvasElement))
      const frames: Frame[] = [read(canvasElement, 0)]
      await userEvent.click(canvas.getByRole('button', { name: 'Blue' }))
      await stepFade(canvasElement, frames, 0, [0, 0.25, 0.5, 0.75, 0.999], {
        at: 0.5,
        act: async (layer) => {
          canvas.getByRole('button', { name: 'Green' }).click()
          await nextTick()
          // The fade to Blue goes on, on the same layer: Green is not on screen yet.
          await expect(incoming(canvasElement)).toBe(layer)
          await expect(shown(layer)).toBe(`url("${BLUE}")`)
        },
      })
      // Blue's fade ended: Green fades in from nothing, over a whole fade of its own.
      await stepFade(canvasElement, frames, 1, [0, 0.5, 0.999])
      await settled(canvasElement, `url("${GREEN}")`)
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
  render: harness(null, HELD_FADE),
  play: async ({ canvasElement }) => {
    const decode = controlDecode(true)
    try {
      const canvas = within(canvasElement)
      const original = shown(base(canvasElement))
      const frames: Frame[] = [read(canvasElement, 0)]
      await userEvent.click(canvas.getByRole('button', { name: 'Blue' }))
      await stepFade(canvasElement, frames, 0, [0, 0.25, 0.5, 0.75, 0.999], {
        at: 0.5,
        act: async (layer) => {
          canvas.getByRole('button', { name: 'Default' }).click()
          await nextTick()
          await expect(incoming(canvasElement)).toBe(layer)
          await expect(shown(layer)).toBe(`url("${BLUE}")`)
        },
      })
      await expect(shown(base(canvasElement))).toBe(`url("${BLUE}")`)
      await stepFade(canvasElement, frames, 1, [0, 0.5, 0.999])
      await settled(canvasElement, original)
      await expectNoCut(frames)
      await expect(sequence(frames)).toEqual([original, `url("${BLUE}")`, original])
    } finally {
      decode.restore()
    }
  },
}

/**
 * C, then D, asked for mid-fade: C is never shown and its load is cancelled, and D, still decoding when the fade to B
 * ends, starts its fade only once it has decoded. The pictures shown are A, B, D.
 */
export const SupersededTargetIsNeverShown: Story = {
  args: { url: null },
  render: harness(null, HELD_FADE),
  play: async ({ canvasElement }) => {
    const decode = controlDecode()
    try {
      const canvas = within(canvasElement)
      const original = shown(base(canvasElement))
      const frames: Frame[] = [read(canvasElement, 0)]
      await userEvent.click(canvas.getByRole('button', { name: 'Blue' }))
      await waitFor(() => expect(decode.waiting(BLUE)).toBe(true))
      decode.release(BLUE)
      // Red is asked for mid-fade and is still loading when Green replaces it.
      await stepFade(canvasElement, frames, 0, [0, 0.25, 0.5, 0.75, 0.999], {
        at: 0.5,
        act: async (layer) => {
          canvas.getByRole('button', { name: 'Red' }).click()
          await nextTick()
          canvas.getByRole('button', { name: 'Green' }).click()
          await nextTick()
          await waitFor(() => expect(decode.waiting(GREEN)).toBe(true))
          // Blue, Red and Green were each asked to decode; Red's download is the one that was stopped.
          await expect(decode.images).toHaveLength(3)
          await expect(decode.images.filter(img => img.getAttribute('src') === RED)).toHaveLength(0)
          await expect(incoming(canvasElement)).toBe(layer)
        },
      })
      // Blue is shown and Green has not decoded: nothing fades in yet.
      await expect(shown(base(canvasElement))).toBe(`url("${BLUE}")`)
      await expect(incoming(canvasElement)).toBeNull()
      frames.push(read(canvasElement, 1))
      decode.release(GREEN)
      await stepFade(canvasElement, frames, 1, [0, 0.5, 0.999])
      await settled(canvasElement, `url("${GREEN}")`)
      // The older request decodes only now, and changes nothing.
      decode.release(RED)
      await nextTick()
      await expect(incoming(canvasElement)).toBeNull()
      frames.push(read(canvasElement, 2))
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
