import type { Meta, StoryObj } from '@storybook/vue3-vite'
import NotesPanel from './NotesPanel.vue'
import { brann, build } from '@/stories/fixtures'
import { withStores } from '@/stories/state'
import { useActiveCharacter } from '@/composables/useActiveCharacter'

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
