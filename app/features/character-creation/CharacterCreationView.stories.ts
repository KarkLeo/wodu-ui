import { onUnmounted } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import CharacterCreationView from './CharacterCreationView.vue'
import { useCreationStore } from '@/stores/creation'
import { build, crookhollow, draftGear, draftIdentity, draftTraining, inGame, MEMBERS } from '@/stories/fixtures'
import { storyRouter } from '@/stories/router'
import { atRoute, withStores } from '@/stories/state'
import { bootstrapStatus } from '@/transport/bootstrap'
import { mode } from '@/transport/mode'
import { enterMode } from '@/transport/modeSwitch'
import { OFFLINE_KEYS } from '@/transport/offlineStorage'
import { authStore } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Screens/CharacterCreation',
  component: CharacterCreationView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  loaders: [atRoute('/character/new')],
} satisfies Meta<typeof CharacterCreationView>

export default meta
type Story = StoryObj<typeof meta>

const draftWizard = build('story-draft-wizard', [
  { type: 'SET_NAME', name: 'Ysolde' },
  { type: 'SET_CLASS', classId: 'wizard' },
  {
    type: 'SET_STAT_ROLLS_BATCH',
    rolls: [
      { key: 'str', roll: 5, bonus: 0 },
      { key: 'dex', roll: 8, bonus: 1 },
      { key: 'con', roll: 7, bonus: 1 },
      { key: 'int', roll: 11, bonus: 2 },
      { key: 'wis', roll: 9, bonus: 1 },
      { key: 'cha', roll: 6, bonus: 0 },
    ],
  },
])

const draftHpUnrolled = build('story-draft-hp', [
  { type: 'SET_NAME', name: 'Hallam' },
  { type: 'SET_CLASS', classId: 'cleric' },
  {
    type: 'SET_STAT_ROLLS_BATCH',
    rolls: [
      { key: 'str', roll: 8, bonus: 1 },
      { key: 'dex', roll: 6, bonus: 0 },
      { key: 'con', roll: 9, bonus: 1 },
      { key: 'int', roll: 7, bonus: 1 },
      { key: 'wis', roll: 11, bonus: 2 },
      { key: 'cha', roll: 5, bonus: 0 },
    ],
  },
  { type: 'TOGGLE_ABILITY', id: 'heal' },
])

// On phones the view teleports itself to <body>, outside the story canvas.
const screen = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

export const Identity: Story = {
  decorators: [withStores({ characters: [draftIdentity], creation: { draftId: draftIdentity.id, step: 1 } })],
}

export const IdentityFilled: Story = {
  decorators: [withStores({ characters: [draftTraining], creation: { draftId: draftTraining.id, step: 1 } })],
}

export const Training: Story = {
  decorators: [withStores({ characters: [draftTraining], creation: { draftId: draftTraining.id, step: 2 } })],
}

export const TrainingWizard: Story = {
  decorators: [withStores({ characters: [draftWizard], creation: { draftId: draftWizard.id, step: 2 } })],
}

export const GearBeforeHpRoll: Story = {
  decorators: [withStores({ characters: [draftHpUnrolled], creation: { draftId: draftHpUnrolled.id, step: 3 } })],
}

export const Gear: Story = {
  decorators: [withStores({ characters: [draftGear], creation: { draftId: draftGear.id, step: 3 } })],
}

/** The persisted draftId points at a draft that is gone: the wizard clears it and returns to the list. */
export const StaleDraft: Story = {
  tags: ['no-visual'],
  decorators: [withStores({ characters: [], creation: { draftId: 'story-missing-draft', step: 2 } })],
  play: async () => {
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
    await expect(useCreationStore().draftId).toBeNull()
  },
}

// Listed before withStores so that it runs after it and overrides the 'ready' status withStores sets.
const serverDown: Decorator = (story) => ({
  components: { story },
  setup() {
    const previous = bootstrapStatus.value
    bootstrapStatus.value = 'failed'
    onUnmounted(() => { bootstrapStatus.value = previous })
  },
  template: '<story />',
})

/** The online load failed: the draft is not in the store yet, so the pointer is kept until data arrives. */
export const StaleDraftWhileServerDown: Story = {
  tags: ['no-visual'],
  decorators: [serverDown, withStores({ characters: [], creation: { draftId: 'story-missing-draft', step: 2 } })],
  play: async () => {
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(storyRouter.currentRoute.value.path).toBe('/character/new')
    await expect(useCreationStore().draftId).toBe('story-missing-draft')
    bootstrapStatus.value = 'ready'
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/games'))
    await expect(useCreationStore().draftId).toBeNull()
  },
}

// Listed before withStores so that it runs after it: the online data has not arrived, and this device has
// no offline draft. Leaves signed out, so switching back to online loads nothing.
const onlineLoadingNoOfflineDraft: Decorator = (story) => ({
  components: { story },
  setup() {
    bootstrapStatus.value = 'loading'
    useCreationStore().perMode.offline = { draftId: null, step: 1 }
    onUnmounted(() => {
      authStore.clear()
      enterMode('online')
      for (const key of Object.values(OFFLINE_KEYS)) localStorage.removeItem(key)
    })
  },
  template: '<story />',
})

/**
 * The mode switches before this page unmounts when the address moves to /offline. The wizard opened online
 * must not judge the offline draft pointer, reset it or navigate on its own.
 */
export const SwitchToOfflineLeavesWizardAlone: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [onlineLoadingNoOfflineDraft, withStores({ characters: [], creation: { draftId: 'story-missing-draft', step: 2 } })],
  play: async () => {
    enterMode('offline')
    await expect(mode.value).toBe('offline')
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(storyRouter.currentRoute.value.path).toBe('/character/new')
    await expect(useCreationStore().perMode.online.draftId).toBe('story-missing-draft')
  },
}

export const NextFromIdentity: Story = {
  decorators: [withStores({ characters: [draftTraining], creation: { draftId: draftTraining.id, step: 1 } })],
  play: async ({ canvasElement }) => {
    const view = screen(canvasElement)
    await userEvent.click(await view.findByRole('button', { name: /Next/ }))
    await expect(await view.findByRole('button', { name: '2', current: 'step' })).toBeInTheDocument()
  },
}

const gameDraft = withStores({
  characters: [draftIdentity],
  creation: { draftId: draftIdentity.id, step: 1 },
  games: [crookhollow],
  members: MEMBERS.filter(m => m.game === crookhollow.id),
  meta: { [draftIdentity.id]: inGame(crookhollow) },
  scope: { kind: 'game', gameId: crookhollow.id },
})

/** Closing the wizard inside a game returns to that game's table. */
export const CloseInGame: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  decorators: [gameDraft],
  loaders: [atRoute(`/games/${crookhollow.id}/new`)],
  play: async ({ canvasElement }) => {
    await userEvent.click(await screen(canvasElement).findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}`))
  },
}
