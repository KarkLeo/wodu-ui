import { nextTick, onUnmounted, ref } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import CharacterCreationView from './CharacterCreationView.vue'
import { useCharactersStore } from '@/stores/characters'
import { useCreationStore } from '@/stores/creation'
import { build, crookhollow, draftGear, draftIdentity, draftTraining, inGame, MEMBERS } from '@/stories/fixtures'
import { storyRouter } from '@/stories/router'
import { atRoute, withStores } from '@/stories/state'
import { bootstrapStatus } from '@/transport/bootstrap'
import { mode } from '@/transport/mode'
import { enterMode } from '@/transport/modeSwitch'
import { OFFLINE_KEYS } from '@/transport/offlineStorage'
import { authStore, clearPbRequests, pbRequests } from '../../../.storybook/mocks/pb'

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

/** Wizard: Lore and Summon come with the class (checked, fixed); one more skill and one more ability fill the slots. */
export const TrainingPickRules: Story = {
  tags: ['no-visual'],
  decorators: [withStores({ characters: [draftWizard], creation: { draftId: draftWizard.id, step: 2 } })],
  play: async ({ canvasElement }) => {
    const view = screen(canvasElement)
    const skills = within(await view.findByRole('group', { name: 'Skills' }))
    const abilities = within(view.getByRole('group', { name: 'Abilities' }))

    await expect(skills.getByRole('checkbox', { name: 'Lore' })).toBeChecked()
    await expect(skills.getByRole('checkbox', { name: 'Lore' })).toBeDisabled()
    await expect(abilities.getByRole('checkbox', { name: /^Summon/ })).toBeChecked()
    await expect(abilities.getByRole('checkbox', { name: /^Summon/ })).toBeDisabled()
    await expect(view.getByRole('button', { name: /Next/ })).toBeDisabled()

    await userEvent.click(skills.getByRole('checkbox', { name: 'Athletics' }))
    await expect(skills.getByRole('checkbox', { name: 'Athletics' })).toBeChecked()
    await expect(skills.getByRole('checkbox', { name: 'Awareness' })).toBeDisabled()

    abilities.getByRole('checkbox', { name: /^Cantrips/ }).focus()
    await userEvent.keyboard(' ')
    await expect(abilities.getByRole('checkbox', { name: /^Cantrips/ })).toBeChecked()
    await expect(abilities.getByRole('checkbox', { name: /^Command/ })).toBeDisabled()
    await expect(view.getByRole('button', { name: /Next/ })).toBeEnabled()

    abilities.getByRole('checkbox', { name: /^Cantrips/ }).focus()
    await userEvent.keyboard('{Enter}')
    await expect(abilities.getByRole('checkbox', { name: /^Cantrips/ })).not.toBeChecked()
    await expect(abilities.getByRole('checkbox', { name: /^Command/ })).toBeEnabled()
  },
}

/** One class at a time: picking another moves the selection. */
export const IdentityClassPick: Story = {
  tags: ['no-visual'],
  decorators: [withStores({ characters: [draftTraining], creation: { draftId: draftTraining.id, step: 1 } })],
  play: async ({ canvasElement }) => {
    const classes = within(await screen(canvasElement).findByRole('radiogroup', { name: 'Class' }))
    await expect(classes.getByRole('radio', { name: /^Cleric/ })).toBeChecked()
    await userEvent.click(classes.getByRole('radio', { name: /^Thief/ }))
    await expect(classes.getByRole('radio', { name: /^Thief/ })).toBeChecked()
    await expect(classes.getAllByRole('radio', { checked: true })).toHaveLength(1)
  },
}

/** The class cards are one tab stop, on the picked class; the arrow keys move and pick. */
export const IdentityClassKeyboard: Story = {
  tags: ['no-visual'],
  decorators: [withStores({ characters: [draftTraining], creation: { draftId: draftTraining.id, step: 1 } })],
  play: async ({ canvasElement }) => {
    const classes = within(await screen(canvasElement).findByRole('radiogroup', { name: 'Class' }))
    const radios = classes.getAllByRole('radio')
    const tabStops = () => radios.filter(r => r.tabIndex === 0)
    const cleric = classes.getByRole('radio', { name: /^Cleric/ })
    await expect(tabStops()).toEqual([cleric])

    cleric.focus()
    await userEvent.keyboard('{ArrowRight}')
    const next = radios[radios.indexOf(cleric) + 1]
    await expect(next).toHaveFocus()
    await expect(next).toBeChecked()
    await expect(tabStops()).toEqual([next])
    await userEvent.keyboard('{ArrowLeft}')
    await expect(cleric).toHaveFocus()
    await expect(cleric).toBeChecked()
    await expect(classes.getAllByRole('radio', { checked: true })).toHaveLength(1)

    await userEvent.tab()
    await expect(radios.includes(document.activeElement as HTMLElement)).toBe(false)
  },
}

export const GearBeforeHpRoll: Story = {
  decorators: [withStores({ characters: [draftHpUnrolled], creation: { draftId: draftHpUnrolled.id, step: 3 } })],
}

export const Gear: Story = {
  decorators: [withStores({ characters: [draftGear], creation: { draftId: draftGear.id, step: 3 } })],
  play: async ({ canvasElement }) => {
    const view = screen(canvasElement)
    await expect(await view.findByRole('button', { name: 'Gear catalog' })).toBeVisible()
    await expect(view.getAllByRole('button', { name: /catalog/i })).toHaveLength(1)
  },
}

/** The persisted draftId points at a draft that is gone: the wizard clears it and returns to the characters page. */
export const StaleDraft: Story = {
  tags: ['no-visual'],
  decorators: [withStores({ characters: [], creation: { draftId: 'story-missing-draft', step: 2 } })],
  play: async () => {
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/characters'))
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
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe('/characters'))
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

// Takes the wizard away the way a route change does, without moving the focus out of its field first.
const wizardShown = ref(true)
const leaveWizard = async () => {
  wizardShown.value = false
  await nextTick()
}
const removableWizard: Story['render'] = () => ({
  components: { CharacterCreationView },
  setup() {
    wizardShown.value = true
    return { wizardShown }
  },
  template: '<CharacterCreationView v-if="wizardShown" />',
})

const typeCoins = async (canvasElement: HTMLElement, amount: string) => {
  const field = await screen(canvasElement).findByRole('spinbutton', { name: 'Coins' })
  await userEvent.clear(field)
  await userEvent.type(field, amount)
  return field
}

/** Closing or leaving the step takes the field away; what was typed still goes out, once. */
export const CoinsCommitOnLeaving: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  render: removableWizard,
  decorators: [withStores({ characters: [draftGear], creation: { draftId: draftGear.id, step: 3 } })],
  play: async ({ canvasElement }) => {
    clearPbRequests()
    await typeCoins(canvasElement, '25')
    await leaveWizard()
    await expect(useCharactersStore().getById(draftGear.id)!.coins).toBe(25)
    await expect(pbRequests().filter(r => r === 'characters.update')).toHaveLength(1)
  },
}

const offlineDraft = build('story-draft-offline', [{ type: 'SET_NAME', name: 'Offline draft' }])

// Listed before withStores so that it runs after it: this device also holds a draft of the other mode.
const withOfflineDraft: Decorator = (story) => ({
  components: { story },
  setup() {
    localStorage.setItem(OFFLINE_KEYS.characters, JSON.stringify([offlineDraft]))
    useCreationStore().perMode.offline = { draftId: offlineDraft.id, step: 3 }
    onUnmounted(() => {
      authStore.clear()
      enterMode('online')
      useCreationStore().perMode.offline = { draftId: null, step: 1 }
      for (const key of Object.values(OFFLINE_KEYS)) localStorage.removeItem(key)
    })
  },
  template: '<story />',
})

/**
 * Swiping back from the online wizard to /offline/new: the mode switches while this page is still mounted
 * with coins typed and the field still focused. Whichever way the field goes away, the coins do not follow.
 */
export const TypedCoinsStayOutOfTheOtherModesDraft: Story = {
  tags: ['no-visual'],
  parameters: { navigationNotice: false },
  render: removableWizard,
  decorators: [withOfflineDraft, withStores({ characters: [draftGear], creation: { draftId: draftGear.id, step: 3 } })],
  play: async ({ canvasElement, step }) => {
    const offlineCoins = () => useCharactersStore().getById(offlineDraft.id)!.coins
    const before = offlineDraft.coins

    const field = await typeCoins(canvasElement, '999')
    enterMode('offline')
    await nextTick()
    await expect(offlineCoins()).toBe(before)

    await step('a blur after the switch writes nothing', async () => {
      field.focus()
      field.blur()
      await nextTick()
      await expect(offlineCoins()).toBe(before)
    })

    await step('nor does the page going away', async () => {
      await typeCoins(canvasElement, '888')
      await leaveWizard()
      await expect(offlineCoins()).toBe(before)
    })
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
