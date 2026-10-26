import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import LandingView from './LandingView.vue'
import { atRoute, DESKTOP_VIEWPORT } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { currentLocale } from '@/locales'
import { authStore, clearPbRequests, pbRequests } from '../../../.storybook/mocks/pb'

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
