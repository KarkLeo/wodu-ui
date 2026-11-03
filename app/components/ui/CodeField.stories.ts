import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import Button from './Button.vue'
import CodeField from './CodeField.vue'

const meta = {
  title: 'UI/CodeField',
  component: CodeField,
  args: { length: 8, groupSize: 4, label: 'Code from the email', disabled: false, autofocus: false, onComplete: fn() },
  render: (args) => ({
    components: { CodeField },
    setup: () => ({ args, code: ref('') }),
    template: '<CodeField v-bind="args" v-model="code" />',
  }),
  decorators: [() => ({ template: '<div style="max-width: 330px"><story /></div>' })],
  parameters: {
    docs: { description: { component: 'A one-time code: an invisible input over N drawn cells. The cell to fill next is underlined while the field has the focus; typing or pasting is cleaned (digits only by default, or `sanitize`) and `complete` fires once the last cell is filled. `groupSize` adds a wider gap between groups. `focus()` is exposed for a reset after a wrong code.' } },
  },
} satisfies Meta<typeof CodeField>

export default meta
type Story = StoryObj<typeof meta>

const input = (canvasElement: HTMLElement) => within(canvasElement).getByLabelText('Code from the email')

/** Empty, focused: the first cell is current. */
export const Default: Story = {
  args: { autofocus: true },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(input(canvasElement)).toHaveFocus())
    await expect(canvasElement.querySelector('.is-current')).not.toBeNull()
  },
}

/** Part of the code typed: the cells show it, the next one is current, nothing is submitted yet. */
export const PartlyFilled: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.type(input(canvasElement), '245')
    await expect(input(canvasElement)).toHaveValue('245')
    await expect(args.onComplete).not.toHaveBeenCalled()
  },
}

/** Pasting text keeps its digits and completes the code at once. */
export const PasteCompletes: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    await userEvent.click(input(canvasElement))
    await userEvent.paste('Your code: 2451-1566')
    await expect(args.onComplete).toHaveBeenCalledOnce()
    await expect(args.onComplete).toHaveBeenCalledWith('24511566')
    await expect(input(canvasElement)).toHaveValue('24511566')
  },
}

/** A reset from outside empties the input; `focus()` puts the caret back. */
export const ResetAndFocus: Story = {
  tags: ['no-visual'],
  render: (args) => ({
    components: { CodeField, Button },
    setup: () => {
      const code = ref('')
      const field = ref<InstanceType<typeof CodeField> | null>(null)
      function reset() {
        code.value = ''
        field.value?.focus()
      }
      return { args, code, field, reset }
    },
    template: `
      <div style="display: grid; gap: 12px">
        <CodeField ref="field" v-bind="args" v-model="code" />
        <Button variant="ghost" size="sm" @click="reset">Reset</Button>
      </div>
    `,
  }),
  play: async ({ canvasElement }) => {
    await userEvent.type(input(canvasElement), '1234')
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(input(canvasElement)).toHaveValue(''))
    await expect(input(canvasElement)).toHaveFocus()
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(input(canvasElement)).toBeDisabled()
  },
}

/** Six cells in two groups of three. */
export const SixDigits: Story = {
  args: { length: 6, groupSize: 3 },
}
