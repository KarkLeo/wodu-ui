import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { fn } from 'storybook/test'
import StatChip from './StatChip.vue'
import IconDice from './icons/IconDice.vue'

const meta = {
  title: 'UI/StatChip',
  component: StatChip,
  args: {
    label: 'STR',
    value: '+1',
    dice: '2d6',
    state: 'positive',
    onToggleEdit: fn(),
    onOpen: fn(),
    'onUpdate:value': fn(),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'row', 'hero', 'minimal'] },
    size: { control: 'inline-radio', options: ['sm', 'base', 'lg'] },
    state: {
      control: 'select',
      options: ['default', 'zero', 'positive', 'high', 'active', 'disabled'],
    },
  },
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/stat-chip.html`',
      },
    },
  },
} satisfies Meta<typeof StatChip>

export default meta
type Story = StoryObj<typeof meta>

export const Positive: Story = {}

export const Zero: Story = {
  args: { label: 'DEX', value: '0', state: 'zero' },
}

export const High: Story = {
  args: { label: 'CON', value: '+3', state: 'high' },
}

export const Active: Story = {
  args: { label: 'WIS', value: '+2', state: 'active' },
}

export const Disabled: Story = {
  args: { label: 'INT', value: '0', state: 'disabled' },
}

export const Buffed: Story = {
  args: { label: 'CON', value: '+3', base: '+1', mod: 2, state: 'high' },
}

export const Debuffed: Story = {
  args: { label: 'DEX', value: '-1', base: '+1', mod: -2, state: 'zero' },
}

export const RowVariant: Story = {
  args: { label: 'INT', value: '+2', variant: 'row' },
}

export const HeroVariant: Story = {
  args: { label: 'WIS', value: '+1', variant: 'hero', rollHint: 'Roll' },
}

export const MinimalVariant: Story = {
  args: { label: 'CHA', value: '0', variant: 'minimal', state: 'zero', dice: undefined },
}

export const Variants: Story = {
  render: (args) => ({
    components: { StatChip },
    setup: () => ({ args }),
    template: `
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
        <StatChip v-bind="args" variant="default" />
        <StatChip v-bind="args" variant="row" />
        <StatChip v-bind="args" variant="hero" roll-hint="Roll" />
        <StatChip v-bind="args" variant="minimal" />
      </div>
    `,
  }),
}

export const States: Story = {
  render: (args) => ({
    components: { StatChip },
    setup: () => ({ args }),
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 16px">
        <StatChip v-bind="args" label="DEX" value="0" state="zero" />
        <StatChip v-bind="args" label="STR" value="+1" state="positive" />
        <StatChip v-bind="args" label="CON" value="+3" state="high" />
        <StatChip v-bind="args" label="WIS" value="+2" state="active" />
        <StatChip v-bind="args" label="INT" value="0" state="disabled" />
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: (args) => ({
    components: { StatChip },
    setup: () => ({ args }),
    template: `
      <div style="display: flex; align-items: center; gap: 16px">
        <StatChip v-bind="args" size="sm" />
        <StatChip v-bind="args" size="base" />
        <StatChip v-bind="args" size="lg" />
      </div>
    `,
  }),
}

export const Editing: Story = {
  render: (args) => ({
    components: { StatChip },
    setup() {
      const value = ref(1)
      const editing = ref(true)
      function toggle() {
        editing.value = !editing.value
        args.onToggleEdit?.()
      }
      return { args, value, editing, toggle }
    },
    template: `
      <StatChip
        v-bind="args"
        v-model:value="value"
        :editing="editing"
        editable
        @toggle-edit="toggle"
      />
    `,
  }),
  args: { dice: undefined },
}

export const WithPopover: Story = {
  render: (args) => ({
    components: { StatChip, IconDice },
    setup: () => ({ args }),
    template: `
      <StatChip v-bind="args">
        <template #popover>
          <div class="pop-head">
            <span class="pop-title">Strength · +2</span>
            <span class="pop-sub">STR</span>
          </div>
          <button type="button" class="pop-hero">
            <IconDice />
            <span>Roll 2d6 +2</span>
          </button>
          <div class="pop-divider" />
          <div class="pop-section-head">
            <span class="pop-sub">Modifiers</span>
          </div>
          <div class="pop-effect">
            <span class="pop-effect-delta is-buff">+1</span>
            <span class="pop-effect-name">
              Potion of giant strength
              <span class="pop-effect-meta">until the end of the scene</span>
            </span>
            <button type="button" class="pop-effect-remove" aria-label="Remove Potion of giant strength">×</button>
          </div>
        </template>
      </StatChip>
    `,
  }),
  args: {
    value: '+2',
    base: '+1',
    mod: 1,
    hasPopover: true,
    popoverTitle: 'Strength · +2',
  },
}

export const StatBlock: Story = {
  render: (args) => ({
    components: { StatChip },
    setup: () => ({
      args,
      stats: [
        { label: 'STR', value: '+3', state: 'high' },
        { label: 'DEX', value: '+1', state: 'positive' },
        { label: 'CON', value: '+2', state: 'positive', base: '+1', mod: 1 },
        { label: 'INT', value: '0', state: 'zero' },
        { label: 'WIS', value: '0', state: 'zero' },
        { label: 'CHA', value: '+1', state: 'positive' },
      ] as const,
    }),
    template: `
      <div style="display: grid; grid-template-columns: repeat(3, max-content); gap: 12px">
        <StatChip
          v-for="s in stats"
          :key="s.label"
          v-bind="args"
          :label="s.label"
          :value="s.value"
          :state="s.state"
          :base="'base' in s ? s.base : undefined"
          :mod="'mod' in s ? s.mod : undefined"
        />
      </div>
    `,
  }),
}
