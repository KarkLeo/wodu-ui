import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import FormField from './FormField.vue'

/** The shell behind TextField, SelectField and TextareaField: label, the control from the slot, the error. */
const meta = {
  title: 'UI/FormField',
  component: FormField,
  args: { label: 'Name' },
  render: (args) => ({
    components: { FormField },
    setup: () => ({ args }),
    template: `
      <FormField v-slot="{ id, invalid, describedBy }" v-bind="args">
        <input :id="id" class="form-field-control" :aria-invalid="invalid" :aria-describedby="describedBy">
      </FormField>
    `,
  }),
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
} satisfies Meta<typeof FormField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithError: Story = {
  args: { error: 'A name is required.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Name')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAccessibleDescription('A name is required.')
  },
}
