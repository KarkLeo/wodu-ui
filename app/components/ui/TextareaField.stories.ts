import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import TextareaField from './TextareaField.vue'

const meta = {
  title: 'UI/TextareaField',
  component: TextareaField,
  args: {
    modelValue: '',
    label: 'Notes',
    placeholder: 'Where it was found, who wants it back…',
    'onUpdate:modelValue': fn(),
  },
  render: (args) => ({
    components: { TextareaField },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: `<TextareaField v-bind="args" v-model="value" @update:model-value="args['onUpdate:modelValue']" />`,
  }),
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
} satisfies Meta<typeof TextareaField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Filled: Story = {
  args: { modelValue: 'Smells of the sea.\nThe chain is new.' },
}

export const WithError: Story = {
  args: { modelValue: 'Too long', error: 'At most 2000 characters.' },
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByLabelText('Notes')
    await expect(textarea).toHaveAttribute('aria-invalid', 'true')
    await expect(textarea).toHaveAccessibleDescription('At most 2000 characters.')
  },
}

/** An optional note after the label and a hint that describes the field. */
export const WithHint: Story = {
  args: { label: 'Appearance', optional: 'optional', hint: 'What others see when it comes.' },
  play: async ({ canvasElement }) => {
    const textarea = within(canvasElement).getByRole('textbox', { name: /Appearance/ })
    await expect(textarea).toHaveAccessibleDescription('What others see when it comes.')
  },
}

/** A label for assistive tech only; `blur` lets a debounced field commit. */
export const HiddenLabelAndBlur: Story = {
  args: { label: 'Notes about the character', hideLabel: true, onBlur: fn() },
  play: async ({ canvasElement, args }) => {
    const textarea = within(canvasElement).getByRole('textbox', { name: 'Notes about the character' })
    await userEvent.click(textarea)
    await userEvent.tab()
    await expect(args.onBlur).toHaveBeenCalledTimes(1)
  },
}
