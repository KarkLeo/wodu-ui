import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { ClientResponseError } from 'pocketbase'
import CabinetLayout from '@/features/cabinet/CabinetLayout.vue'
import ProfileView from './ProfileView.vue'
import { atRoute, DESKTOP_VIEWPORT } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { currentLocale, t } from '@/locales'
import { listenForInstallPrompt } from '@/pwa/useInstall'
import { authStore, pb, signInMock } from '../../../.storybook/mocks/pb'

// The page as app.vue shows it, under the cabinet header.
const meta = {
  title: 'Screens/Profile/ProfileView',
  component: ProfileView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  loaders: [atRoute('/profile')],
  beforeEach() {
    signInMock()
  },
  render: () => ({
    components: { CabinetLayout, ProfileView },
    template: '<CabinetLayout><ProfileView /></CabinetLayout>',
  }),
} satisfies Meta<typeof ProfileView>

export default meta
type Story = StoryObj<typeof meta>

// Sheets and confirms are portalled to <body>, outside the story canvas.
const screen = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/** A browser that offers installation fires this; stories fake it to show the install row. */
function offerInstall(outcome: 'accepted' | 'dismissed') {
  const prompt = Object.assign(new Event('beforeinstallprompt'), {
    prompt: async () => {},
    userChoice: Promise.resolve({ outcome }),
  })
  window.dispatchEvent(prompt)
}

/**
 * The route open when the session ends. It must already be the landing: on /profile, app.vue would show
 * the sign-in screen for a moment before the navigation.
 */
function pathWhenSignedOut() {
  let path: string | null = null
  const stop = authStore.onChange((token) => {
    if (!token && path === null) path = storyRouter.currentRoute.value.path
  })
  return { path: () => path, stop }
}

/** Name, email, language, version, sign out and delete; no install row unless the browser offers it. */
export const Rows: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByText('Anna')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Change name' })).toBeVisible()
    await expect(canvas.getByText('anna@mail.com')).toBeVisible()
    const language = canvas.getByRole('group', { name: 'Language' })
    await expect(within(language).getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByText(/^v\d+\.\d+\.\d+ · /)).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Install app' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Delete account' })).toBeVisible()
    // The mode follows the address: there is no online/offline switch here either.
    await expect(canvas.queryByRole('radio')).toBeNull()
  },
}

export const Desktop: Story = {
  globals: DESKTOP_VIEWPORT,
}

export const ChangeName: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('users'), 'update')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Change name' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Change name' })
    const field = within(dialog).getByLabelText(/Player name/)
    await userEvent.clear(field)
    await userEvent.type(field, 'Annika')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await expect(update).toHaveBeenCalledWith('user-mock', { name: 'Annika' })
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await expect(within(canvasElement).getByText('Annika')).toBeVisible()
  },
}

/** The language switches at once and is saved to the profile. */
export const LanguageSavesProfile: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('users'), 'update')
    const language = within(within(canvasElement).getByRole('group', { name: 'Language' }))
    await userEvent.click(language.getByRole('button', { name: 'UK' }))
    await expect(currentLocale.value).toBe('uk')
    await expect(update).toHaveBeenCalledWith('user-mock', { language: 'uk' })
    await expect(within(canvasElement).getByRole('heading', { level: 1, name: t('profile.title') })).toBeVisible()
  },
}

/** Shown only when the browser offers installation; gone once the prompt is answered. */
export const Install: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    offerInstall('dismissed')
    const install = await canvas.findByRole('button', { name: 'Install app' })
    await userEvent.click(install)
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Install app' })).toBeNull())
  },
}

/** The browser offers installation once, early, long before the profile opens; the row still shows. */
export const InstallOfferedBeforeOpen: Story = {
  tags: ['no-visual'],
  // Story loaders run after the meta's, before the view renders. The app's PWA plugin listens from startup.
  loaders: [
    async () => {
      listenForInstallPrompt()
      offerInstall('dismissed')
      return {}
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('App')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Install app' }))
    await waitFor(() => expect(canvas.queryByText('App')).toBeNull())
  },
}

export const SignOutCancel: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Sign out' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Sign out of your account?' })
    await expect(dialog).toHaveTextContent('Offline-table characters stay on this device.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await expect(authStore.isValid).toBe(true)
    await expect(storyRouter.currentRoute.value.path).toBe('/profile')
  },
}

/** Signing out lands on the landing, and only then ends the session, so the sign-in screen never flashes. */
export const SignOutConfirm: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    const signedOut = pathWhenSignedOut()
    try {
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Sign out' }))
      const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Sign out of your account?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }))
      await waitFor(() => expect(authStore.isValid).toBe(false))
      await expect(storyRouter.currentRoute.value.path).toBe('/')
      await expect(signedOut.path()).toBe('/')
    } finally {
      signedOut.stop()
    }
  },
}

export const DeleteAccount: Story = {
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    const remove = spyOn(pb, 'send')
    const signedOut = pathWhenSignedOut()
    try {
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Delete account' }))
      const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Delete your account?' })
      await expect(remove).not.toHaveBeenCalled()
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
      await expect(remove).toHaveBeenCalledWith('/api/collections/users/records/user-mock', { method: 'DELETE' })
      await waitFor(() => expect(authStore.isValid).toBe(false))
      await expect(storyRouter.currentRoute.value.path).toBe('/')
      await expect(signedOut.path()).toBe('/')
    } finally {
      signedOut.stop()
    }
  },
}

export const DeleteCancel: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const remove = spyOn(pb, 'send')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Delete account' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Delete your account?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await expect(remove).not.toHaveBeenCalled()
    await expect(authStore.isValid).toBe(true)
  },
}

export const DeleteFails: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb, 'send').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Delete account' }))
    const dialog = await screen(canvasElement).findByRole('dialog', { name: 'Delete your account?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent('Something went wrong. Try again.')
    await expect(authStore.isValid).toBe(true)
  },
}
