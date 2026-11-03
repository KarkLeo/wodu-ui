import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import SearchField from './SearchField.vue'

const meta = {
  title: 'UI/SearchField',
  component: SearchField,
  args: {
    modelValue: '',
    label: 'Search items',
    placeholder: 'Name or note…',
    'onUpdate:modelValue': fn(),
  },
  render: (args) => ({
    components: { SearchField },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: `<SearchField v-model="value" :label="args.label" :placeholder="args.placeholder" :size="args.size"
      @update:model-value="args['onUpdate:modelValue']" />`,
  }),
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
} satisfies Meta<typeof SearchField>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const Filled: Story = {
  args: { modelValue: 'sword' },
}

/** Typing updates the model; the field is reached by its label. */
export const Typing: Story = {
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole('searchbox', { name: 'Search items' })
    await userEvent.type(input, 'oil')
    await expect(input).toHaveValue('oil')
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith('oil')
  },
}

/** The field's own clear button empties it and keeps the focus in the field; it shows only while there is text. */
export const Clearing: Story = {
  args: { modelValue: 'sword' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('searchbox', { name: 'Search items' })
    await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }))
    await expect(input).toHaveValue('')
    await expect(input).toHaveFocus()
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith('')
    await expect(canvas.queryByRole('button', { name: 'Clear search' })).toBeNull()
  },
}

/** Tight headers (the gear catalog): smaller pill and placeholder, while typed text stays 16px so iOS does not zoom. */
export const Compact: Story = {
  args: { size: 'sm', placeholder: 'Search: sword, armor, bandage…' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('searchbox', { name: 'Search items' })
    await expect(getComputedStyle(input).fontSize).toBe('16px')
    await expect(input.closest('label')!.getBoundingClientRect().height).toBeLessThan(34)
  },
}
