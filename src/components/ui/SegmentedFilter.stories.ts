import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref, watch } from 'vue'
import SegmentedFilter from './SegmentedFilter.vue'

const catalogOptions = [
  { value: 'all', label: 'All' },
  { value: 'weapons', label: 'Weapons' },
  { value: 'armor', label: 'Armor' },
  { value: 'gear', label: 'Gear' },
  { value: 'consumables', label: 'Consumables' },
]

const logOptions = [
  { value: 'rolls', label: 'Rolls' },
  { value: 'changes', label: 'Changes' },
  { value: 'all', label: 'All' },
]

const meta = {
  title: 'UI/SegmentedFilter',
  component: SegmentedFilter as Meta<typeof SegmentedFilter>['component'],
  args: {
    modelValue: 'all',
    options: catalogOptions,
    variant: 'block',
    fullWidth: false,
    'onUpdate:modelValue': fn(),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['block', 'pill'] },
    modelValue: { control: 'text' },
  },
  render: (args) => ({
    components: { SegmentedFilter },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: '<SegmentedFilter v-bind="args" v-model="value" />',
  }),
  parameters: {
    docs: {
      description: {
        component:
          'Design prototype: `materials/design-vtt/design/palette.html` (block); `materials/design-vtt/design/components/dice-drawer.html` (pill)',
      },
    },
  },
} satisfies Meta<typeof SegmentedFilter>

export default meta
type Story = StoryObj<typeof meta>

export const Block: Story = {}

export const BlockSecondSelected: Story = {
  args: { modelValue: 'armor' },
}

export const Pill: Story = {
  args: { variant: 'pill', options: logOptions, modelValue: 'rolls' },
}

export const PillFullWidth: Story = {
  args: { variant: 'pill', options: logOptions, modelValue: 'rolls', fullWidth: true },
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
}

export const BlockFullWidth: Story = {
  args: { options: logOptions, fullWidth: true },
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
}

export const Overflowing: Story = {
  decorators: [() => ({ template: '<div style="max-width: 240px"><story /></div>' })],
}

export const Variants: Story = {
  render: (args) => ({
    components: { SegmentedFilter },
    setup() {
      const block = ref('all')
      const pill = ref('rolls')
      return { args, block, pill, catalogOptions, logOptions }
    },
    template: `
      <div style="display: grid; gap: 16px; justify-items: start">
        <SegmentedFilter v-bind="args" v-model="block" :options="catalogOptions" variant="block" />
        <SegmentedFilter v-bind="args" v-model="pill" :options="logOptions" variant="pill" />
      </div>
    `,
  }),
}
