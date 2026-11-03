import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, fn, userEvent, within } from 'storybook/test'
import SelectableRow from './SelectableRow.vue'
import Pill from './Pill.vue'
import { useRovingSelection } from '@/composables/useRovingSelection'

const CLERIC = [
  { id: 'turn', name: 'Turn Undead', description: 'Undead flee from your holy symbol.', granted: true },
  { id: 'heal', name: 'Cure', description: 'Heal wounds and lift curses by touch.' },
  { id: 'blessing', name: 'Blessing', description: '+1 to an ally’s roll once per scene.' },
  { id: 'summoning', name: 'Summoning', description: 'Call a spirit to your side.' },
]

const meta = {
  title: 'UI/SelectableRow',
  component: SelectableRow,
  args: {
    title: 'Cure',
    description: 'Heal wounds and lift curses by touch.',
    type: 'checkbox',
    selected: false,
    locked: false,
    disabled: false,
    onToggle: fn(),
  },
  argTypes: {
    type: { control: 'inline-radio', options: ['checkbox', 'radio'] },
  },
  decorators: [() => ({ template: '<div style="max-width: 520px"><story /></div>' })],
  parameters: {
    docs: {
      description: {
        component: 'A pick row of the creation and level-up wizards: round check, title, italic description, a mono flag or a trailing chip. '
          + '`checkbox` for a pick of several, `radio` for a pick of one; `locked` is granted (checked, fixed), `disabled` cannot be picked now. '
          + 'Put the rows in a `role="group"` / `role="radiogroup"` element named after the section. '
          + 'Radios in a group get one tab stop and arrow keys: pass `tabindex` and `@keydown` from `useRovingSelection`. '
          + 'Design prototypes: `character-creation.html`, `level-up.html`.',
      },
    },
  },
} satisfies Meta<typeof SelectableRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole('checkbox', { name: /^Cure/ })
    await expect(row).not.toBeChecked()
    await userEvent.click(row)
    await expect(args.onToggle).toHaveBeenCalledTimes(1)
  },
}

export const Selected: Story = {
  args: { selected: true, flag: 'selected' },
}

/** Granted by the class: announced as checked, cannot be toggled. */
export const Locked: Story = {
  args: { title: 'Turn Undead', description: 'Undead flee from your holy symbol.', locked: true, flag: 'base' },
  play: async ({ args, canvasElement }) => {
    const row = within(canvasElement).getByRole('checkbox', { name: /^Turn Undead/ })
    await expect(row).toBeChecked()
    await expect(row).toBeDisabled()
    await userEvent.click(row, { pointerEventsCheck: 0 })
    await expect(args.onToggle).not.toHaveBeenCalled()
  },
}

export const Disabled: Story = {
  args: { disabled: true, flag: 'no slots left' },
}

/** Level-up: one pick, a chip at the end. */
export const RadioWithChip: Story = {
  render: (args) => ({
    components: { SelectableRow, Pill },
    setup: () => ({ args }),
    template: `
      <SelectableRow v-bind="args">
        <template #trailing><Pill tone="danger" size="sm">+6 HP auto</Pill></template>
      </SelectableRow>
    `,
  }),
  args: { title: 'Hardy', description: '+6 HP.', type: 'radio' },
}

/** Creation: two abilities to choose, one granted; the rest are disabled once the slots are full. */
export const PickMulti: Story = {
  render: (args) => ({
    components: { SelectableRow },
    setup() {
      const picked = ref<string[]>([])
      const full = () => picked.value.length >= 1
      function toggle(id: string) {
        picked.value = picked.value.includes(id) ? picked.value.filter((p) => p !== id) : [...picked.value, id]
        args.onToggle?.()
      }
      return { args, abilities: CLERIC, picked, full, toggle }
    },
    template: `
      <div role="group" aria-label="Abilities">
        <SelectableRow
          v-for="a in abilities"
          :key="a.id"
          :title="a.name"
          :description="a.description"
          :locked="a.granted"
          :selected="picked.includes(a.id)"
          :disabled="!a.granted && !picked.includes(a.id) && full()"
          :flag="a.granted ? 'base' : picked.includes(a.id) ? 'selected' : full() ? 'no slots left' : undefined"
          @toggle="toggle(a.id)"
        />
      </div>
    `,
  }),
  play: async ({ canvasElement }) => {
    const group = within(within(canvasElement).getByRole('group', { name: 'Abilities' }))
    await expect(group.getByRole('checkbox', { name: /^Turn Undead/ })).toBeChecked()
    await userEvent.click(group.getByRole('checkbox', { name: /^Cure/ }))
    await expect(group.getByRole('checkbox', { name: /^Cure/ })).toBeChecked()
    await expect(group.getByRole('checkbox', { name: /^Blessing/ })).toBeDisabled()
    group.getByRole('checkbox', { name: /^Cure/ }).focus()
    await userEvent.keyboard('{Enter}')
    await expect(group.getByRole('checkbox', { name: /^Cure/ })).not.toBeChecked()
    await expect(group.getByRole('checkbox', { name: /^Blessing/ })).toBeEnabled()
  },
}

/** Level-up: one skill; picking another moves the selection. One tab stop, and the arrow keys move and pick. */
export const PickSingle: Story = {
  render: (args) => ({
    components: { SelectableRow },
    setup() {
      const picked = ref<string | null>(null)
      const skills = ['Heal', 'Lore', 'Survival']
      const { tabIndexFor, onKeydown } = useRovingSelection(() => skills.map((value) => ({ value })), picked)
      return { args, skills, picked, tabIndexFor, onKeydown }
    },
    template: `
      <div role="radiogroup" aria-label="New skill">
        <SelectableRow
          v-for="s in skills"
          :key="s"
          type="radio"
          :title="s"
          :selected="picked === s"
          :tabindex="tabIndexFor(s)"
          @keydown="onKeydown"
          @toggle="picked = s"
        />
      </div>
    `,
  }),
  play: async ({ canvasElement }) => {
    const group = within(within(canvasElement).getByRole('radiogroup', { name: 'New skill' }))
    const radio = (name: string) => group.getByRole('radio', { name })

    await userEvent.tab()
    await expect(radio('Heal')).toHaveFocus()
    await expect(radio('Heal')).not.toBeChecked()
    await userEvent.tab()
    await expect(group.queryAllByRole('radio').filter((r) => r === document.activeElement)).toHaveLength(0)
    await userEvent.tab({ shift: true })
    await expect(radio('Heal')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect(radio('Lore')).toHaveFocus()
    await expect(radio('Lore')).toBeChecked()
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    await expect(radio('Survival')).toHaveFocus()
    await expect(radio('Survival')).toBeChecked()

    await userEvent.click(group.getByRole('radio', { name: 'Lore' }))
    await expect(group.getByRole('radio', { name: 'Lore' })).toBeChecked()
    group.getByRole('radio', { name: 'Heal' }).focus()
    await userEvent.keyboard(' ')
    await expect(group.getByRole('radio', { name: 'Heal' })).toBeChecked()
    await expect(group.getByRole('radio', { name: 'Lore' })).not.toBeChecked()
    await expect(group.getAllByRole('radio', { checked: true })).toHaveLength(1)
  },
}
