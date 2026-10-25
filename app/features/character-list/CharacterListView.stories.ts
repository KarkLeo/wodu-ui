import { onUnmounted } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import CharacterListView from './CharacterListView.vue'
import { draftIdentity, draftTraining, PARTY } from '@/stories/fixtures'
import { atRoute, withStores } from '@/stories/state'
import { bootstrapStatus } from '@/transport/bootstrap'
import { mode } from '@/transport/mode'
import { t } from '@/locales'

const meta = {
  title: 'Screens/CharacterList',
  component: CharacterListView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  loaders: [atRoute('/')],
} satisfies Meta<typeof CharacterListView>

export default meta
type Story = StoryObj<typeof meta>

export const PartyWithDrafts: Story = {
  decorators: [withStores({ characters: [...PARTY, draftTraining, draftIdentity] })],
}

export const Empty: Story = {
  decorators: [withStores({ characters: [] })],
}

// Listed before withStores so that it runs after it and overrides the 'ready' status withStores sets.
// Sets the mode directly rather than through setMode(), so nothing is persisted.
const onlineLoading: Decorator = (story) => ({
  components: { story },
  setup() {
    const previous = { mode: mode.value, status: bootstrapStatus.value }
    mode.value = 'online'
    bootstrapStatus.value = 'loading'
    onUnmounted(() => {
      mode.value = previous.mode
      bootstrapStatus.value = previous.status
    })
  },
  template: '<story />',
})

/** Online data has not arrived yet (e.g. right after switching to Online): no empty state yet. */
export const LoadingOnline: Story = {
  decorators: [onlineLoading, withStores({ characters: [] })],
  play: async ({ canvasElement }) => {
    const view = within(canvasElement)
    await expect(await view.findByRole('status')).toHaveTextContent(t('characterList.loading'))
    await expect(view.queryByText(t('characterList.empty.title'))).not.toBeInTheDocument()
  },
}
