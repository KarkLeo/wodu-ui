import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { onUnmounted } from 'vue'
import type { Decorator } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import LandingView from './LandingView.vue'
import { atRoute, DESKTOP_VIEWPORT } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { currentLocale, t } from '@/locales'
import { mode } from '@/transport/mode'
import { authStore, clearPbRequests, pb, pbRequests, signInMock } from '../../../.storybook/mocks/pb'

const signedIn: Decorator = (story) => ({
  components: { story },
  setup() {
    signInMock()
  },
  template: '<story />',
})

// Opened cold at /, the app starts offline so the landing never needs the server; set directly, restored after.
const coldStart: Decorator = (story) => ({
  components: { story },
  setup() {
    const previous = mode.value
    mode.value = 'offline'
    onUnmounted(() => { mode.value = previous })
  },
  template: '<story />',
})

const meta = {
  title: 'Screens/Landing',
  component: LandingView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  loaders: [atRoute('/')],
  beforeEach() {
    authStore.clear()
    clearPbRequests()
  },
} satisfies Meta<typeof LandingView>

export default meta
type Story = StoryObj<typeof meta>

/** Title, the sign-in screen's tagline, the two ways in and the language buttons. */
export const Phone: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'World of Dungeons' })).toBeVisible()
    await expect(canvas.getByText('character sheet for the table')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Play offline, no account' })).toBeVisible()
    await expect(canvas.getByRole('group', { name: 'Language' })).toBeVisible()
  },
}

export const Desktop: Story = {
  globals: DESKTOP_VIEWPORT,
}

/** "Sign in" opens the games; the account area shows the sign-in screen there and keeps the address. */
export const SignInOpensGames: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
  },
}

export const PlayOfflineOpensOfflineTable: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Play offline, no account' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/offline'))
  },
}

/** The language switches on the spot; signed out, nothing goes to the server. */
export const SwitchesLanguage: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'RU' }))
    await expect(currentLocale.value).toBe('ru')
    await expect(canvas.getByRole('button', { name: 'RU' })).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByRole('button', { name: 'Войти' })).toBeVisible()
    await expect(pbRequests()).toEqual([])
  },
}

/** Signed in, the way in is the cabinet itself. */
export const SignedIn: Story = {
  decorators: [signedIn],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Sign in' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Open cabinet' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
  },
}

/** Signed in, the language goes to the profile even on a cold start at /, which runs offline. */
export const SignedInLanguageSavesProfile: Story = {
  tags: ['no-visual'],
  decorators: [coldStart, signedIn],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('users'), 'update')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'UK' }))
    await expect(currentLocale.value).toBe('uk')
    await expect(update).toHaveBeenCalledWith('user-mock', { language: 'uk' })
    await expect(within(canvasElement).getByRole('button', { name: t('landing.openCabinet') })).toBeVisible()
  },
}
