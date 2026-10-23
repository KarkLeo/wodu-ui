import type { Meta, StoryObj } from '@storybook/vue3-vite'
import SkillsPanel from './SkillsPanel.vue'
import { brann, wren } from '@/stories/fixtures'
import { withStores } from '@/stories/state'
import { useActiveCharacter } from '@/composables/useActiveCharacter'

const meta = {
  title: 'Panels/SkillsPanel',
  component: SkillsPanel,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { controls: { disable: true } },
  decorators: [withStores({ characters: [brann, wren] })],
} satisfies Meta<typeof SkillsPanel>

export default meta
type Story = StoryObj<typeof SkillsPanel>

const forCharacter = (id: string): Story['render'] => () => ({
  components: { SkillsPanel },
  setup() {
    const { char } = useActiveCharacter(() => id)
    return { char }
  },
  template: '<SkillsPanel v-if="char" :char="char" />',
})

export const Fighter: Story = {
  render: forCharacter(brann.id),
}

export const Thief: Story = {
  render: forCharacter(wren.id),
}
