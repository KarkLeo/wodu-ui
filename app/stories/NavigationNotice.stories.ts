import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, waitFor, within } from 'storybook/test'
import { atRoute } from './state'
import { storyRouter } from './router'

const meta = {
  title: 'Storybook/NavigationNotice',
  tags: ['!autodocs', 'no-visual'],
  render: () => ({ template: '<p>A screen</p>' }),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const notice = (el: HTMLElement) => within(el.ownerDocument.body).queryByText(/The app would leave this screen/)
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

/** A story at a route of its own; the next story in this file runs right after it. */
export const AtARoute: Story = {
  loaders: [atRoute('/party/story-brann')],
  play: async ({ canvasElement }) => {
    await pause(50)
    await expect(notice(canvasElement)).toBeNull()
  },
}

/** With no route of its own it starts clean: it does not inherit the last story's route, or report it as a navigation. */
export const NoRouteOfItsOwn: Story = {
  play: async ({ canvasElement }) => {
    await pause(50)
    await expect(storyRouter.currentRoute.value.path).toBe('/')
    await expect(notice(canvasElement)).toBeNull()
  },
}

/** A view that really goes to another screen still says so. */
export const RealNavigationShowsIt: Story = {
  loaders: [atRoute('/games')],
  play: async ({ canvasElement }) => {
    await pause(50)
    await storyRouter.push('/party/story-brann')
    await waitFor(() => expect(notice(canvasElement)).not.toBeNull())
  },
}
