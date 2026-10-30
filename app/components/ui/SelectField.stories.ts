import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import SelectField from './SelectField.vue'

const kinds = [
  { value: 'weapon', label: 'Weapon' },
  { value: 'armor', label: 'Armor' },
  { value: 'gear', label: 'Gear' },
]

const meta = {
  title: 'UI/SelectField',
  component: SelectField as Meta<typeof SelectField>['component'],
  args: {
    modelValue: 'weapon',
    label: 'Kind',
    options: kinds,
    'onUpdate:modelValue': fn(),
  },
  render: (args) => ({
    components: { SelectField },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: `<SelectField v-bind="args" v-model="value" @update:model-value="args['onUpdate:modelValue']" />`,
  }),
  decorators: [() => ({ template: '<div style="max-width: 240px"><story /></div>' })],
} satisfies Meta<typeof SelectField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Picking an option updates the model with its value. */
export const Picking: Story = {
  play: async ({ canvasElement, args }) => {
    const select = within(canvasElement).getByLabelText('Kind')
    await userEvent.selectOptions(select, 'Armor')
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith('armor')
  },
}

/** Values need not be strings. */
export const BooleanValues: Story = {
  render: () => ({
    components: { SelectField },
    setup() {
      const melee = ref(true)
      const options = [{ value: true, label: 'Melee' }, { value: false, label: 'Ranged' }]
      return { melee, options }
    },
    template: `<div><SelectField v-model="melee" label="Reach" :options="options" /><output>{{ melee }}</output></div>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.selectOptions(canvas.getByLabelText('Reach'), 'Ranged')
    await expect(canvas.getByRole('status')).toHaveTextContent('false')
  },
}
