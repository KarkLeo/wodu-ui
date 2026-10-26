import { onUnmounted } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import PanelFooter from './PanelFooter.vue'
import { crookhollow, CROOKHOLLOW_META, PARTY, sage } from '@/stories/fixtures'
import { atRoute, withGameTable, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { currentLocale } from '@/locales'
import { mode } from '@/transport/mode'
import { clearPbRequests, pbRequests, signInMock } from '../../../.storybook/mocks/pb'

// Sets the mode directly, as the PlayersPanel stories do, and restores it for the next story.
const offlineMode: Decorator = (story) => ({
  components: { story },
  setup() {
    const previous = mode.value
    mode.value = 'offline'
    onUnmounted(() => { mode.value = previous })
  },
  template: '<story />',
})

const meta = {
  title: 'Layout/PanelFooter',
  component: PanelFooter,
  globals: { viewport: { value: 'phone', isRotated: false } },
  // The bottom of the players panel: the same column width and flex column as its .gl-panel-foot.
  render: () => ({
    components: { PanelFooter },
    template: `<div style="width: 280px; padding: 12px 16px; display: flex; flex-direction: column;
      align-items: center; gap: 10px"><PanelFooter /></div>`,
  }),
  beforeEach() {
    signInMock()
    clearPbRequests()
  },
} satisfies Meta<typeof PanelFooter>

export default meta
type Story = StoryObj<typeof meta>

/** At a game's table "Home" goes to the games. Online the language lives in the profile, not here. */
export const InGame: Story = {
  decorators: [withGameTable(crookhollow, [...PARTY, sage], CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/^v\d+\.\d+\.\d+ · /)).toBeVisible()
    await expect(canvas.queryByRole('group', { name: 'Language' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Home' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
  },
}

/** At the free-characters table "Home" goes to the characters. */
export const FreeTable: Story = {
  decorators: [withStores({ characters: [sage] })],
  loaders: [atRoute(`/party/${sage.id}`)],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('group', { name: 'Language' })).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Home' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/characters'))
  },
}

/** Offline "Home" goes to the landing, and the language buttons stay (there is no profile); nothing reaches the server. */
export const Offline: Story = {
  decorators: [offlineMode, withStores({ characters: [sage] })],
  loaders: [atRoute('/offline')],
  parameters: { navigationNotice: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const ru = canvas.getByRole('button', { name: 'RU' })
    await userEvent.click(ru)
    await expect(currentLocale.value).toBe('ru')
    await expect(ru).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(canvas.getByRole('button', { name: 'EN' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Home' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/'))
    await expect(pbRequests()).toEqual([])
  },
}
