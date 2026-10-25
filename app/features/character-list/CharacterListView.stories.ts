import type { Meta, StoryObj } from '@storybook/vue3-vite'
import CharacterListView from './CharacterListView.vue'
import { draftIdentity, draftTraining, PARTY } from '@/stories/fixtures'
import { atRoute, withStores } from '@/stories/state'

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
