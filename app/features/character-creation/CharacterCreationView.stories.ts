import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import CharacterCreationView from './CharacterCreationView.vue'
import { build, draftGear, draftIdentity, draftTraining } from '@/stories/fixtures'
import { atRoute, withStores } from '@/stories/state'

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

export const NextFromIdentity: Story = {
  decorators: [withStores({ characters: [draftTraining], creation: { draftId: draftTraining.id, step: 1 } })],
  play: async ({ canvasElement }) => {
    const view = screen(canvasElement)
    await userEvent.click(await view.findByRole('button', { name: /Next/ }))
    await expect(await view.findByRole('button', { name: '2', current: 'step' })).toBeInTheDocument()
  },
}
