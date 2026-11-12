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

/**
 * A new picture while a fade is under way: the layer that shows more stays as the base and the new picture fades
 * in over it. Early in the fade the old picture stays (the half-faded one never jumps to full); late, the nearly
 * shown one does.
 */
export const InterruptedFadeKeepsWhatShows: Story = {
  args: { url: null },
  render: harness(),
  play: async ({ canvasElement }) => {
    const decode = controlDecode()
    try {
      const canvas = within(canvasElement)
      const original = shown(base(canvasElement))
      // Early: Blue has only just started to fade in when Red is asked for.
      await userEvent.click(canvas.getByRole('button', { name: 'Blue' }))
      await waitFor(() => expect(decode.waiting(BLUE)).toBe(true))
      decode.release(BLUE)
      await waitFor(() => expect(incoming(canvasElement)).toHaveClass('is-visible'))
      await userEvent.click(canvas.getByRole('button', { name: 'Red' }))
      await waitFor(() => expect(decode.waiting(RED)).toBe(true))
      decode.release(RED)
      await waitFor(() => expect(shown(incoming(canvasElement) ?? undefined)).toBe(`url("${RED}")`))
      await expect(shown(base(canvasElement))).toBe(original)
      await waitFor(() => expect(shown(base(canvasElement))).toBe(`url("${RED}")`), { timeout: 4000 })
      await expect(layers(canvasElement)).toHaveLength(1)
      // Late: Green is nearly in when Blue is asked for, so Green stays under it.
      await userEvent.click(canvas.getByRole('button', { name: 'Green' }))
      await waitFor(() => expect(decode.waiting(GREEN)).toBe(true))
      decode.release(GREEN)
      await waitFor(() => expect(incoming(canvasElement)).toHaveClass('is-visible'))
      await waitFor(() => expect(Number(getComputedStyle(incoming(canvasElement)!).opacity)).toBeGreaterThan(0.6), { timeout: 3000 })
      await userEvent.click(canvas.getByRole('button', { name: 'Blue' }))
      await waitFor(() => expect(decode.waiting(BLUE)).toBe(true))
      decode.release(BLUE)
      await waitFor(() => expect(shown(incoming(canvasElement) ?? undefined)).toBe(`url("${BLUE}")`))
      await expect(shown(base(canvasElement))).toBe(`url("${GREEN}")`)
    } finally {
      decode.restore()
    }
  },
}
