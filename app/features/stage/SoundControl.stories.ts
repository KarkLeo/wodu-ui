import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor as waitForDefault, within } from 'storybook/test'
import SoundControl from './SoundControl.vue'
import { crookhollow, CROOKHOLLOW_META, PARTY, sage } from '@/stories/fixtures'
import { withMediaPrefs } from '@/stories/playback'
import { atRoute, withGameTable, withOfflineMode, withStores } from '@/stories/state'
import { useMediaPrefsStore } from '@/stores/mediaPrefs'
import { sceneAudioCalls } from '../../../.storybook/mocks/sceneAudioInstance'
import { signInMock } from '../../../.storybook/mocks/pb'

// A slow runner takes longer than the default second for a layer, a fade or a prompt to appear.
const waitFor: typeof waitForDefault = (callback, options) => waitForDefault(callback, { timeout: 10000, ...options })

const meta = {
  title: 'Features/Stage/SoundControl',
  component: SoundControl,
  globals: { viewport: { value: 'phone', isRotated: false } },
  decorators: [
    (story) => ({ components: { story }, template: '<div style="width: 280px; padding: 16px"><story /></div>' }),
    withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META),
    withMediaPrefs(),
  ],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  beforeEach() {
    signInMock()
  },
} satisfies Meta<typeof SoundControl>

export default meta
type Story = StoryObj<typeof meta>

/** Sound not chosen yet: muted, the volume cannot be moved, the scene background is on. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const group = await canvas.findByRole('group', { name: 'Sound' })
    await expect(group).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false')
    await expect(canvas.getByRole('switch', { name: 'Scene background' })).toBeChecked()
  },
}

/** Sound on, a volume of the player's own. */
export const SoundOn: Story = {
  decorators: [withMediaPrefs({ sound: 'on', volume: 0.4 })],
}

/** The mute button writes the choice (turning on is the click that unlocks audio), the slider the volume, the switch the background. */
export const TogglesAndVolume: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const prefs = useMediaPrefsStore()
    const mute = await canvas.findByRole('button', { name: 'Sound' })
    await userEvent.click(mute)
    await expect(prefs.sound).toBe('on')
    await expect(mute).toHaveAttribute('aria-pressed', 'true')
    await expect(sceneAudioCalls.filter(c => c.method === 'unlock')).toHaveLength(1)

    const volume = canvas.getByRole('slider', { name: 'Volume' })
    await expect(volume).toBeEnabled()
    volume.focus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    await waitFor(() => expect(prefs.volume).toBeCloseTo(0.5))

    const background = canvas.getByRole('switch', { name: 'Scene background' })
    await userEvent.click(background)
    await expect(prefs.background).toBe(false)
    await expect(background).not.toBeChecked()

    await userEvent.click(mute)
    await expect(prefs.sound).toBe('off')
    await expect(mute).toHaveAttribute('aria-pressed', 'false')
  },
}

/** While sound is not on the volume cannot be changed, whether it was never chosen or turned off. */
export const SliderDisabledWhileOff: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const prefs = useMediaPrefsStore()
    const volume = await canvas.findByRole('slider', { name: 'Volume' })
    await expect(volume).toHaveAttribute('data-disabled')
    prefs.sound = 'on'
    await waitFor(() => expect(volume).not.toHaveAttribute('data-disabled'))
    prefs.sound = 'off'
    await waitFor(() => expect(volume).toHaveAttribute('data-disabled'))
  },
}

/** The offline table has no scene to play, so it has no control. */
export const AbsentOffline: Story = {
  decorators: [withOfflineMode, withStores({ characters: [sage] })],
  loaders: [atRoute('/offline')],
  play: async ({ canvasElement }) => {
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(within(canvasElement).queryByRole('group', { name: 'Sound' })).toBeNull()
  },
}

/** Nor has the free-characters table, outside any game. */
export const AbsentOutsideGames: Story = {
  decorators: [withStores({ characters: [sage] })],
  loaders: [atRoute(`/party/${sage.id}`)],
  play: async ({ canvasElement }) => {
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(within(canvasElement).queryByRole('group', { name: 'Sound' })).toBeNull()
  },
}
