import type { Meta, StoryObj } from '@storybook/vue3-vite'
import FormError from './FormError.vue'

const meta = {
  title: 'UI/FormError',
  component: FormError,
  render: () => ({
    components: { FormError },
    template: '<FormError role="alert">Could not save. Check the connection and try again.</FormError>',
  }),
} satisfies Meta<typeof FormError>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
