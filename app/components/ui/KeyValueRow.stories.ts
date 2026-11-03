import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, userEvent, within } from 'storybook/test'
import Button from './Button.vue'
import KeyValueRow from './KeyValueRow.vue'
import IconClock from './icons/IconClock.vue'
import IconCheckCircle from './icons/IconCheckCircle.vue'

const meta = {
  title: 'UI/KeyValueRow',
  component: KeyValueRow,
  args: { label: 'Email', layout: 'inline', tone: 'neutral' },
  argTypes: {
    layout: { control: 'inline-radio', options: ['inline', 'stacked'] },
    tone: { control: 'inline-radio', options: ['neutral', 'accent'] },
  },
  render: (args) => ({
    components: { KeyValueRow },
    setup: () => ({ args }),
    template: '<KeyValueRow v-bind="args">brann@example.com</KeyValueRow>',
  }),
  decorators: [() => ({ template: '<div style="max-width: 420px"><story /></div>' })],
  parameters: {
    docs: { description: { component: 'A label and its value in a list of rows, with an optional leading `#icon` and a trailing `#action`. Rows that follow each other are divided by a line.' } },
  },
} satisfies Meta<typeof KeyValueRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A long value is cut with an ellipsis instead of pushing the action out. */
export const WithAction: Story = {
  args: { label: 'Name' },
  render: (args) => ({
    components: { KeyValueRow, Button },
    setup: () => {
      const name = ref('Brann of the Long Winter Road, the Bold')
      return { args, name }
    },
    template: `
      <KeyValueRow v-bind="args">
        {{ name }}
        <template #action>
          <Button variant="ghost" size="sm" aria-label="Change name" @click="name = 'Brann'">Change</Button>
        </template>
      </KeyValueRow>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Change name' }))
    await expect(canvas.getByText('Brann')).toBeVisible()
  },
}

/** The label names a control in the action slot through `labelId`. */
export const LabelledControl: Story = {
  args: { label: 'Language', labelId: 'kv-language' },
  render: (args) => ({
    components: { KeyValueRow, Button },
    setup: () => ({ args }),
    template: `
      <KeyValueRow v-bind="args">
        <template #action>
          <div role="group" aria-labelledby="kv-language" style="display: flex; gap: 4px">
            <Button variant="primary" size="sm">EN</Button>
            <Button size="sm">RU</Button>
          </div>
        </template>
      </KeyValueRow>
    `,
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('group', { name: 'Language' })).toBeVisible()
  },
}

/** A settings card: rows divided by a line. */
export const List: Story = {
  render: () => ({
    components: { KeyValueRow, Button },
    template: `
      <div>
        <KeyValueRow label="Name">Brann
          <template #action><Button variant="ghost" size="sm">Change</Button></template>
        </KeyValueRow>
        <KeyValueRow label="Email">brann@example.com</KeyValueRow>
        <KeyValueRow label="Version">v0.6.6 · 3 Nov 2026</KeyValueRow>
      </div>
    `,
  }),
}

/** A summary list: an icon, the label over the value, and a trailing note. */
export const Stacked: Story = {
  render: () => ({
    components: { KeyValueRow, IconClock, IconCheckCircle },
    template: `
      <div>
        <KeyValueRow layout="stacked" tone="accent" label="New skill">
          Climbing
          <template #icon><IconClock :size="18" :stroke-width="1.4" /></template>
        </KeyValueRow>
        <KeyValueRow layout="stacked" tone="accent" label="Hit points">
          9 / 12
          <template #icon><IconCheckCircle :size="18" :stroke-width="1.4" /></template>
          <template #action><span style="font-family: var(--font-serif); font-size: 22px; color: var(--vtt-accent)">+3</span></template>
        </KeyValueRow>
      </div>
    `,
  }),
}
