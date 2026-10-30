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
    template: `<SearchField v-model="value" :label="args.label" :placeholder="args.placeholder"
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
