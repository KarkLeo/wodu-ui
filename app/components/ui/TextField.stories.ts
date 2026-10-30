import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import TextField from './TextField.vue'

const meta = {
  title: 'UI/TextField',
  component: TextField,
  args: {
    modelValue: '',
    label: 'Name',
    placeholder: 'Longsword',
    'onUpdate:modelValue': fn(),
  },
  render: (args) => ({
    components: { TextField },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: `<TextField v-bind="args" v-model="value" @update:model-value="args['onUpdate:modelValue']" />`,
  }),
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
} satisfies Meta<typeof TextField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Filled: Story = {
  args: { modelValue: 'Hunting crossbow' },
}

/** Dice formulas and numbers. */
export const Mono: Story = {
  args: { label: 'Damage', modelValue: '1d8+1', mono: true, placeholder: 'd6' },
}

/** The error sits under the field, and the input points at it. */
export const WithError: Story = {
  args: { label: 'Price', modelValue: '1.5', mono: true, inputmode: 'numeric', error: 'A whole number from 0 to 100000.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Price')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAttribute('inputmode', 'numeric')
    await expect(input).toHaveAccessibleDescription('A whole number from 0 to 100000.')
  },
}

/** Without an error the input is valid and describes nothing. */
export const Typing: Story = {
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Name' })
    await expect(input).toHaveAttribute('aria-invalid', 'false')
    await expect(input).not.toHaveAttribute('aria-describedby')
    await userEvent.type(input, 'Rope')
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith('Rope')
  },
}
