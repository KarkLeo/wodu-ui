import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor as waitForDefault, within } from 'storybook/test'
import SoundPrompt from './SoundPrompt.vue'
import { crookhollow, CROOKHOLLOW_META, PARTY } from '@/stories/fixtures'
import { withLiveScene, withMediaPrefs } from '@/stories/playback'
import { SCENES, TAVERN } from '@/stories/scenes'
import { atRoute, withGameTable } from '@/stories/state'
import { useMediaPrefsStore } from '@/stores/mediaPrefs'
import { blockedMock, sceneAudioCalls } from '../../../.storybook/mocks/sceneAudioInstance'
import { signInMock } from '../../../.storybook/mocks/pb'

// A slow runner takes longer than the default second for a layer, a fade or a prompt to appear.
const waitFor: typeof waitForDefault = (callback, options) => waitForDefault(callback, { timeout: 10000, ...options })

const FOREST = SCENES[1]!

const meta = {
  title: 'Features/Stage/SoundPrompt',
  component: SoundPrompt,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  decorators: [
    // The prompt is fixed to the page; a table-sized frame keeps it where the app would put it.
    (story) => ({ components: { story }, template: '<div style="min-height: 100dvh"><story /></div>' }),
    withLiveScene(TAVERN),
    withGameTable(crookhollow, PARTY, CROOKHOLLOW_META),
    withMediaPrefs(),
  ],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  beforeEach() {
    signInMock()
  },
} satisfies Meta<typeof SoundPrompt>

export default meta
type Story = StoryObj<typeof meta>

const asked = (canvas: ReturnType<typeof within>) => canvas.queryByText('The table has sound')

/** The master turned on a scene with sound and this device has not chosen: both answers are offered, and each is remembered. */
export const AsksOnce: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const prefs = useMediaPrefsStore()
    await expect(await canvas.findByText('The table has sound')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'No sound' }))
    await expect(prefs.sound).toBe('off')
    await waitFor(() => expect(asked(canvas)).toBeNull())

    prefs.sound = 'unset'
    await expect(await canvas.findByText('The table has sound')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Turn sound on' }))
    await expect(prefs.sound).toBe('on')
    await expect(sceneAudioCalls.filter(c => c.method === 'unlock')).toHaveLength(1)
    await waitFor(() => expect(asked(canvas)).toBeNull())
  },
}

/** Sound is on but the browser holds it until a tap: one button, no way to say no here. */
export const BlockedAsksForATap: Story = {
  decorators: [withMediaPrefs({ sound: 'on', blocked: true })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Sound is paused by the browser')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'No sound' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Turn sound on' }))
    await expect(sceneAudioCalls.filter(c => c.method === 'unlock')).toHaveLength(1)
    await expect(blockedMock.value).toBe(false)
    await waitFor(() => expect(canvas.queryByText('Sound is paused by the browser')).toBeNull())
  },
}

/** A device that said no is never asked again, even when the browser would block. */
export const SilentWhenOff: Story = {
  decorators: [withMediaPrefs({ sound: 'off', blocked: true })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await new Promise(resolve => setTimeout(resolve, 150))
    await expect(canvas.queryByRole('button')).toBeNull()
    await expect(asked(canvas)).toBeNull()
  },
}

/** No scene with a sound, or no scene at all: nothing to ask about. */
export const NoSoundNoPrompt: Story = {
  decorators: [withLiveScene(FOREST)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await new Promise(resolve => setTimeout(resolve, 150))
    await expect(canvas.queryByRole('button')).toBeNull()
  },
}

/** Nothing on stage. */
export const NothingOnStage: Story = {
  decorators: [withLiveScene(null)],
  play: async ({ canvasElement }) => {
    await new Promise(resolve => setTimeout(resolve, 150))
    await expect(within(canvasElement).queryByRole('button')).toBeNull()
  },
}

/** The prompt is a polite live region that is there before it speaks. */
export const IsAPoliteStatus: Story = {
  play: async ({ canvasElement }) => {
    const region = await within(canvasElement).findByRole('status')
    await expect(region).toHaveAttribute('aria-live', 'polite')
    await expect(within(region).getByText('The table has sound')).toBeVisible()
  },
}
