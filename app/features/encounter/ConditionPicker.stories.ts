import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, userEvent, within } from 'storybook/test'
import ConditionPicker from './ConditionPicker.vue'
import type { ConditionId } from '@/types/encounter'

const meta = {
  title: 'Encounter/ConditionPicker',
  component: ConditionPicker,
  args: { conditions: ['poisoned'] as ConditionId[] },
  render: (args) => ({
    components: { ConditionPicker },
    setup() {
      const on = ref<ConditionId[]>([...args.conditions])
      const toggle = (id: ConditionId) => {
        on.value = on.value.includes(id) ? on.value.filter(c => c !== id) : [...on.value, id]
      }
      return { on, toggle }
    },
    template: '<div style="max-width: 420px"><ConditionPicker :conditions="on" @toggle="toggle" /></div>',
  }),
  parameters: {
    docs: { description: { component: 'The nine condition tags of a monster as toggles. They carry no rules: they only remind the master what is going on.' } },
  },
} satisfies Meta<typeof ConditionPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Conditions' })
    await expect(within(group).getAllByRole('button')).toHaveLength(9)
    await expect(within(group).getByRole('button', { name: 'Poisoned' })).toHaveAttribute('aria-pressed', 'true')
    await expect(within(group).getByRole('button', { name: 'Stunned' })).toHaveAttribute('aria-pressed', 'false')
  },
}

export const Toggles: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const stunned = within(canvasElement).getByRole('button', { name: 'Stunned' })
    await userEvent.click(stunned)
    await expect(stunned).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Poisoned' }))
    await expect(within(canvasElement).getByRole('button', { name: 'Poisoned' })).toHaveAttribute('aria-pressed', 'false')
  },
}
