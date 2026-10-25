import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'
import AuthField from './AuthField.vue'

const meta = {
  title: 'Screens/SignIn/AuthField',
  component: AuthField,
  args: {
    id: 'story-field',
    label: 'Email',
    modelValue: '',
    type: 'email',
    placeholder: 'you@example.com',
  },
  render: (args) => ({
    components: { AuthField },
    setup() {
      const value = ref(args.modelValue)
      return { args, value }
    },
    template: '<div style="width: 300px; padding: 24px"><AuthField v-bind="args" v-model="value" /></div>',
  }),
} satisfies Meta<typeof AuthField>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithHint: Story = {
  args: { hint: 'No password — we’ll email you a code.' },
}

export const Filled: Story = {
  args: { modelValue: 'anna@mail.com' },
}

export const OptionalLabel: Story = {
  args: {
    label: 'Player name',
    optional: '— a nickname is fine',
    type: 'text',
    placeholder: undefined,
    modelValue: 'anna',
    maxlength: 40,
    hint: 'The master and other players see this.',
  },
}

export const TypesAndCaps: Story = {
  tags: ['no-visual'],
  args: { label: 'Player name', type: 'text', placeholder: undefined, maxlength: 5 },
  play: async ({ canvasElement }) => {
    const field = within(canvasElement).getByLabelText('Player name')
    await userEvent.type(field, 'Annabel')
    await expect(field).toHaveValue('Annab')
  },
}
