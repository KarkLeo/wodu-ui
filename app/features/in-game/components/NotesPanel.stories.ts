import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import NotesPanel from './NotesPanel.vue'
import { brann, build, inGame, olden } from '@/stories/fixtures'
import { withGameTable, withStores } from '@/stories/state'
import { useActiveCharacter } from '@/composables/useActiveCharacter'
import { asTeammate, expectNoEditControls, sheetFor } from '@/stories/readonly'
import { useCharactersStore } from '@/stores/characters'
import { useToastsStore } from '@/stores/toasts'
import { pb } from '../../../../.storybook/mocks/pb'

const NOTES = [
  'Owes Garrick the smith 20 silver for the shield.',
  'The bandits in the Blackwood answer to someone called the Grey Abbot.',
  '',
  'Ask the priestess at Hollow Ford about the sigil on the crypt door.',
].join('\n')

const chronicler = build('story-chronicler', [
  { type: 'SET_NAME', name: 'Tamsin Reed' },
  { type: 'SET_HIT_DICE_RESULT', hitDice: 1, maxHp: 7, currentHp: 7, hpHistory: [{ level: 1, roll: 6, source: 'dice' }] },
  { type: 'FINALIZE_CHARACTER' },
  { type: 'UPDATE_NOTES', notes: NOTES },
])

const meta = {
  title: 'Panels/NotesPanel',
  component: NotesPanel,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { controls: { disable: true } },
  decorators: [withStores({ characters: [brann, chronicler] })],
} satisfies Meta<typeof NotesPanel>

export default meta
type Story = StoryObj<typeof NotesPanel>

const forCharacter = (id: string): Story['render'] => () => ({
  components: { NotesPanel },
  setup() {
    const { char, dispatch } = useActiveCharacter(() => id)
    return { char, dispatch }
  },
  template: '<NotesPanel v-if="char" :char="char" :dispatch="dispatch" />',
})

export const Empty: Story = {
  render: forCharacter(brann.id),
}

export const WithText: Story = {
  render: forCharacter(chronicler.id),
}

/** A teammate's notes read as text, not a textarea. */
export const ReadOnly: Story = {
  render: forCharacter(chronicler.id),
  decorators: [sheetFor(chronicler.id), asTeammate([chronicler])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/Owes Garrick the smith/)).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}

export const ReadOnlyEmpty: Story = {
  render: forCharacter(brann.id),
  decorators: [sheetFor(brann.id), asTeammate([brann])],
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText('No notes yet.')).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}

/** Review focus 5: typing when the sheet turns read-only (the character left the game) drops the text, sends nothing. */
export const TurnsReadOnlyWhileTyping: Story = {
  tags: ['no-visual'],
  render: forCharacter(chronicler.id),
  decorators: [sheetFor(chronicler.id), withGameTable(olden, [chronicler], { [chronicler.id]: inGame(olden) })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const update = spyOn(pb.collection('characters'), 'update')
    const toasts = useToastsStore()
    toasts.clearAll()
    await userEvent.type(await canvas.findByRole('textbox'), ' Half-written')
    useCharactersStore().setMeta(chronicler.id, { owner: olden.master, game: olden.id })
    await waitFor(() => expect(canvas.queryByRole('textbox')).toBeNull())
    await new Promise(resolve => setTimeout(resolve, 800))
    await expect(update).not.toHaveBeenCalled()
    await expect(toasts.items).toEqual([])
    await expect(canvas.queryByText(/Half-written/)).toBeNull()
  },
}
