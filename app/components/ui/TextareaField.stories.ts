import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, within } from 'storybook/test'
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
