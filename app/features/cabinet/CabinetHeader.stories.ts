import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import CabinetHeader from './CabinetHeader.vue'
import { atRoute, DESKTOP_VIEWPORT } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { signInMock } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Screens/Cabinet/CabinetHeader',
  component: CabinetHeader,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  loaders: [atRoute('/games')],
  beforeEach() {
    signInMock()
  },
} satisfies Meta<typeof CabinetHeader>

export default meta
type Story = StoryObj<typeof meta>

const nav = (canvasElement: HTMLElement) => within(within(canvasElement).getByRole('navigation', { name: 'Cabinet' }))

/** The open page is marked; the offline table sits apart from the cabinet links, the avatar opens the profile. */
export const GamesActive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('World of Dungeons')).toBeVisible()
    await expect(nav(canvasElement).getByRole('link', { name: 'Games' })).toHaveAttribute('aria-current', 'page')
    await expect(nav(canvasElement).getByRole('link', { name: 'Characters' })).not.toHaveAttribute('aria-current')
    await expect(nav(canvasElement).queryByRole('link', { name: 'Offline table' })).toBeNull()
    await expect(canvas.getByRole('link', { name: 'Offline table' })).toBeVisible()
    const profile = canvas.getByRole('link', { name: 'Profile' })
    await expect(profile).toHaveTextContent('A')
    await expect(profile).not.toHaveAttribute('aria-current')
  },
}

export const CharactersActive: Story = {
  loaders: [atRoute('/characters')],
  play: async ({ canvasElement }) => {
    await expect(nav(canvasElement).getByRole('link', { name: 'Characters' })).toHaveAttribute('aria-current', 'page')
    await expect(nav(canvasElement).getByRole('link', { name: 'Games' })).not.toHaveAttribute('aria-current')
  },
}

export const ProfileActive: Story = {
  loaders: [atRoute('/profile')],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page')
    await expect(nav(canvasElement).getByRole('link', { name: 'Games' })).not.toHaveAttribute('aria-current')
    await expect(nav(canvasElement).getByRole('link', { name: 'Characters' })).not.toHaveAttribute('aria-current')
  },
}

/** One row on desktop: brand, links, the offline table, the avatar. */
export const Desktop: Story = {
  globals: DESKTOP_VIEWPORT,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const brand = canvas.getByText('World of Dungeons').getBoundingClientRect()
    const avatar = canvas.getByRole('link', { name: 'Profile' }).getBoundingClientRect()
    const games = nav(canvasElement).getByRole('link', { name: 'Games' }).getBoundingClientRect()
    await expect(Math.abs(games.top - brand.top)).toBeLessThan(20)
    await expect(Math.abs(avatar.top - brand.top)).toBeLessThan(20)
  },
}

/** Phone: the brand and the avatar on top, the links in a second row. */
export const PhoneWraps: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const brand = canvas.getByText('World of Dungeons').getBoundingClientRect()
    const games = nav(canvasElement).getByRole('link', { name: 'Games' }).getBoundingClientRect()
    const offline = canvas.getByRole('link', { name: 'Offline table' }).getBoundingClientRect()
    await expect(games.top).toBeGreaterThan(brand.bottom)
    await expect(Math.abs(offline.top - games.top)).toBeLessThan(20)
  },
}

export const LinksNavigate: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(nav(canvasElement).getByRole('link', { name: 'Characters' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/characters'))
    await userEvent.click(canvas.getByRole('link', { name: 'Profile' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/profile'))
    await userEvent.click(nav(canvasElement).getByRole('link', { name: 'Games' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
    await userEvent.click(canvas.getByRole('link', { name: 'Offline table' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/offline'))
  },
}
