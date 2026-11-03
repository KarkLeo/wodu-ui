import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, fn, userEvent, within } from 'storybook/test'
import SelectableTile from './SelectableTile.vue'

const meta = {
  title: 'UI/SelectableTile',
  component: SelectableTile,
  args: { selected: false, disabled: false, static: false, size: 'md', onSelect: fn() },
  argTypes: {
    size: { control: 'inline-radio', options: ['md', 'sm'] },
  },
  render: (args) => ({
    components: { SelectableTile },
    setup: () => ({ args }),
    template: `
      <SelectableTile v-bind="args" style="width: 180px">
        <span style="font-family: var(--font-serif); font-size: 18px; color: var(--vtt-accent-soft)">Fighter</span>
        <span style="font-family: var(--font-mono); font-size: 9px; color: var(--vtt-text-muted)">ATHLETICS · 2 ABILITIES</span>
      </SelectableTile>
    `,
  }),
  parameters: {
    docs: {
      description: {
        component: 'A tile of the wizards: a class card, a stat. Selectable it is a `radio` (put the tiles in a `role="radiogroup"` named after the section); '
          + '`static` draws the same frame as a plain element, which may carry an `#action` (the stat reroll). '
          + '`label` is the mono caption at the top. Design prototypes: `character-creation.html`, `level-up.html`.',
      },
    },
  },
} satisfies Meta<typeof SelectableTile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const tile = within(canvasElement).getByRole('radio', { name: /Fighter/ })
    await expect(tile).not.toBeChecked()
    await userEvent.click(tile)
    await expect(args.onSelect).toHaveBeenCalledTimes(1)
  },
}

export const Selected: Story = {
  args: { selected: true },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const tile = within(canvasElement).getByRole('radio', { name: /Fighter/ })
    await expect(tile).toBeDisabled()
    await userEvent.click(tile, { pointerEventsCheck: 0 })
    await expect(args.onSelect).not.toHaveBeenCalled()
  },
}

/** A stat tile with its caption. */
export const SmallWithLabel: Story = {
  args: { size: 'sm', label: 'STR' },
  render: (args) => ({
    components: { SelectableTile },
    setup: () => ({ args }),
    template: `
      <SelectableTile v-bind="args" style="width: 120px">
        <span style="margin-top: 2px; font-family: var(--font-serif); font-size: 32px; color: var(--vtt-accent-soft); line-height: 1">+2</span>
      </SelectableTile>
    `,
  }),
}

/** Display only: no role, an action in the corner. */
export const Static: Story = {
  args: { static: true, size: 'sm', label: 'CON' },
  render: (args) => ({
    components: { SelectableTile },
    setup: () => ({ args }),
    template: `
      <SelectableTile v-bind="args" style="width: 120px">
        <template #action><button type="button" style="font-size: 10px">Reroll</button></template>
        <span style="margin-top: 2px; font-family: var(--font-serif); font-size: 32px; color: var(--vtt-accent-soft); line-height: 1">+1</span>
      </SelectableTile>
    `,
  }),
  play: async ({ args, canvasElement }) => {
    const view = within(canvasElement)
    await expect(view.queryByRole('radio')).toBeNull()
    await userEvent.click(view.getByRole('button', { name: 'Reroll' }))
    await expect(args.onSelect).not.toHaveBeenCalled()
  },
}

/** Pick one class: the selection moves, Space and Enter pick. */
export const PickOne: Story = {
  render: () => ({
    components: { SelectableTile },
    setup() {
      const picked = ref('fighter')
      return { picked, classes: ['fighter', 'thief', 'cleric'] }
    },
    template: `
      <div role="radiogroup" aria-label="Class" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 480px">
        <SelectableTile v-for="c in classes" :key="c" :selected="picked === c" @select="picked = c">
          <span style="font-family: var(--font-serif); font-size: 18px; color: var(--vtt-accent-soft); text-transform: capitalize">{{ c }}</span>
        </SelectableTile>
      </div>
    `,
  }),
  play: async ({ canvasElement }) => {
    const group = within(within(canvasElement).getByRole('radiogroup', { name: 'Class' }))
    await expect(group.getByRole('radio', { name: 'fighter' })).toBeChecked()
    await userEvent.click(group.getByRole('radio', { name: 'thief' }))
    await expect(group.getByRole('radio', { name: 'thief' })).toBeChecked()
    group.getByRole('radio', { name: 'cleric' }).focus()
    await userEvent.keyboard('{Enter}')
    await expect(group.getByRole('radio', { name: 'cleric' })).toBeChecked()
    await expect(group.getAllByRole('radio', { checked: true })).toHaveLength(1)
  },
}
