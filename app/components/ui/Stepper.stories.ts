import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref, watch } from 'vue'
import Stepper from './Stepper.vue'

const meta = {
  title: 'UI/Stepper',
  component: Stepper,
  args: {
    modelValue: 2,
    step: 1,
    size: 'base',
    ariaLabel: 'Edit STR',
    'onUpdate:modelValue': fn(),
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'base'] },
    modelValue: { control: 'number' },
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
  },
  render: (args) => ({
    components: { Stepper },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: '<Stepper v-bind="args" v-model="value" />',
  }),
  parameters: {
    docs: { description: { component: 'Design prototype: `materials/design-vtt/design/components/stat-chip.html`' } },
  },
} satisfies Meta<typeof Stepper>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { min: -3, max: 3 },
}

export const Small: Story = {
  args: { size: 'sm', modelValue: 0, min: -10, max: 10, ariaLabel: 'Damage modifier' },
}

export const AtMin: Story = {
  args: { modelValue: -3, min: -3, max: 3 },
}

export const AtMax: Story = {
  args: { modelValue: 3, min: -3, max: 3 },
}

export const Unbounded: Story = {
  args: { modelValue: 0, ariaLabel: 'Modifier' },
}

export const Coins: Story = {
  args: { modelValue: 35, min: 0, step: 5, ariaLabel: 'Coins' },
}

export const Sizes: Story = {
  render: (args) => ({
    components: { Stepper },
    setup() {
      const value = ref(args.modelValue)
      return { args, value }
    },
    template: `
      <div style="display: flex; align-items: center; gap: 24px">
        <Stepper v-bind="args" v-model="value" size="sm" />
        <Stepper v-bind="args" v-model="value" size="base" />
      </div>
    `,
  }),
  args: { min: -3, max: 3 },
}
