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

/** A hint in the flow of a sheet or a form: no room around it, left-aligned, panel size. */
export const InlineHint: Story = {
  args: { inline: true, align: 'start', size: 'sm' },
  render: (args) => ({
    components: { StateNote },
    setup: () => ({ args }),
    template: `
      <div style="max-width: 360px; display: flex; flex-direction: column; gap: 12px">
        <StateNote v-bind="args">Pick a character to bring to the table. It stays yours; the master can see it.</StateNote>
        <div style="height: 40px; border: 1px solid var(--vtt-border-subtle); border-radius: var(--r-md)" />
      </div>
    `,
  }),
}

/** A footnote under the actions of a screen, centred and small. */
export const Footnote: Story = {
  args: { inline: true, size: 'xs' },
  render: (args) => ({
    components: { StateNote },
    setup: () => ({ args }),
    template: '<div style="max-width: 360px"><StateNote v-bind="args">Characters stay on this device only.</StateNote></div>',
  }),
}
