import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, fn, userEvent, within } from 'storybook/test'
import SelectableTile from './SelectableTile.vue'
import IconButton from './IconButton.vue'
import IconReroll from './icons/IconReroll.vue'
import { useRovingSelection } from '@/composables/useRovingSelection'

const meta = {
  title: 'UI/SelectableTile',
  component: SelectableTile,
  args: { selected: false, disabled: false, static: false, size: 'md', onSelect: fn() },
  argTypes: {
    size: { control: 'inline-radio', options: ['md', 'sm', 'compact'] },
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
          + 'radios in a group get one tab stop and arrow keys: pass `tabindex` and `@keydown` from `useRovingSelection`. '
          + '`static` draws the same frame as a plain element, which alone shows an `#action` (the stat reroll). '
          + '`label` is the mono caption at the top, `value` a large number with the default slot as its note. Design prototypes: `character-creation.html`, `level-up.html`.',
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
  args: { size: 'sm', label: 'STR', value: '+2' },
  render: (args) => ({
    components: { SelectableTile },
    setup: () => ({ args }),
    template: '<SelectableTile v-bind="args" style="width: 120px" />',
  }),
}

/** `value` with a note beside it; `valueTone` colours the number, and a selected tile draws it in accent. */
export const ValueTones: Story = {
  render: () => ({
    components: { SelectableTile },
    template: `
      <div style="display: grid; grid-template-columns: repeat(4, 130px); gap: 8px">
        <SelectableTile size="sm" label="STR" value="+1"><i style="font-size: 12px">→ +2</i></SelectableTile>
        <SelectableTile size="sm" label="DEX" value="+1" selected><i style="font-size: 12px">→ +2</i></SelectableTile>
        <SelectableTile static size="sm" label="CON" value="—" value-tone="muted" />
        <SelectableTile static size="sm" label="INT" value="+3" value-tone="accent" />
      </div>
    `,
  }),
}

/** An `#action` belongs to a static tile: a selectable one is a button already, and draws no empty head for it. */
export const ActionOnlyWhenStatic: Story = {
  tags: ['no-visual'],
  render: () => ({
    components: { SelectableTile },
    template: `
      <SelectableTile>
        <template #action><span>Action</span></template>
        Fighter
      </SelectableTile>
    `,
  }),
  play: async ({ canvasElement }) => {
    const tile = within(canvasElement).getByRole('radio', { name: 'Fighter' })
    await expect(tile.children).toHaveLength(0)
  },
}

/** Display only: no role, an action in the corner. */
export const Static: Story = {
  args: { static: true, size: 'sm', label: 'CON', value: '+1' },
  render: (args) => ({
    components: { SelectableTile, IconButton, IconReroll },
    setup: () => ({ args }),
    template: `
      <SelectableTile v-bind="args" style="width: 120px">
        <template #action>
          <IconButton variant="bare" size="sm" label="Reroll"><IconReroll :size="16" :stroke-width="1" /></IconButton>
        </template>
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

/** Pick one class: the selection moves, Space and Enter pick. One tab stop, and the arrow keys move and pick. */
export const PickOne: Story = {
  render: () => ({
    components: { SelectableTile },
    setup() {
      const picked = ref('fighter')
      const classes = ['fighter', 'thief', 'cleric']
      const { tabIndexFor, onKeydown } = useRovingSelection(() => classes.map((value) => ({ value })), picked)
      return { picked, classes, tabIndexFor, onKeydown }
    },
    template: `
      <div role="radiogroup" aria-label="Class" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 480px">
        <SelectableTile
          v-for="c in classes"
          :key="c"
          :selected="picked === c"
          :tabindex="tabIndexFor(c)"
          @keydown="onKeydown"
          @select="picked = c"
        >
          <span style="font-family: var(--font-serif); font-size: 18px; color: var(--vtt-accent-soft); text-transform: capitalize">{{ c }}</span>
        </SelectableTile>
      </div>
    `,
  }),
  play: async ({ canvasElement }) => {
    const group = within(within(canvasElement).getByRole('radiogroup', { name: 'Class' }))
    await expect(group.getByRole('radio', { name: 'fighter' })).toBeChecked()
    await userEvent.tab()
    await expect(group.getByRole('radio', { name: 'fighter' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(group.getByRole('radio', { name: 'thief' })).toHaveFocus()
    await expect(group.getByRole('radio', { name: 'thief' })).toBeChecked()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    await expect(group.getByRole('radio', { name: 'cleric' })).toHaveFocus()
    await expect(group.getByRole('radio', { name: 'cleric' })).toBeChecked()
    await userEvent.tab()
    await expect(group.queryAllByRole('radio').filter((r) => r === document.activeElement)).toHaveLength(0)
    await userEvent.tab({ shift: true })
    await expect(group.getByRole('radio', { name: 'cleric' })).toHaveFocus()
    await userEvent.click(group.getByRole('radio', { name: 'thief' }))
    await expect(group.getByRole('radio', { name: 'thief' })).toBeChecked()
    group.getByRole('radio', { name: 'cleric' }).focus()
    await userEvent.keyboard('{Enter}')
    await expect(group.getByRole('radio', { name: 'cleric' })).toBeChecked()
    await expect(group.getAllByRole('radio', { checked: true })).toHaveLength(1)
  },
}

/** The compact size has room for a picture with one line under it, as in the master's image grid. */
export const CompactWithPicture: Story = {
  args: { size: 'compact', selected: true },
  render: (args) => ({
    components: { SelectableTile },
    setup: () => ({ args }),
    template: `
      <SelectableTile v-bind="args" style="width: 130px">
        <span style="display: block; aspect-ratio: 4 / 3; border-radius: var(--r-sm); background: var(--vtt-bg-sunken)" />
        <span style="font-size: 12px; color: var(--vtt-text-secondary)">The old bridge</span>
      </SelectableTile>
    `,
  }),
  play: async ({ canvasElement }) => {
    const tile = within(canvasElement).getByRole('radio', { name: /The old bridge/ })
    await expect(tile).toBeChecked()
    await expect(getComputedStyle(tile).paddingLeft).toBe('6px')
  },
}
