import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Button from './Button.vue'
import StateNote from './StateNote.vue'

const meta = {
  title: 'UI/StateNote',
  component: StateNote,
  args: { compact: false },
  render: (args) => ({
    components: { StateNote },
    setup: () => ({ args }),
    template: '<StateNote v-bind="args" role="status">Loading the library…</StateNote>',
  }),
} satisfies Meta<typeof StateNote>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Less room around it, inside a sheet. */
export const Compact: Story = {
  args: { compact: true },
}

export const WithAction: Story = {
  render: (args) => ({
    components: { StateNote, Button },
    setup: () => ({ args }),
    template: `
      <StateNote v-bind="args" role="alert">
        Could not load the library.
        <template #action><Button variant="ghost" size="sm">Try again</Button></template>
      </StateNote>
    `,
  }),
}
