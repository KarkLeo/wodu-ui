import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref, watch } from 'vue'
import FormCheckbox from './FormCheckbox.vue'

const meta = {
  title: 'UI/FormCheckbox',
  component: FormCheckbox,
  args: {
    modelValue: false,
    default: 'Consumable',
    'onUpdate:modelValue': fn(),
  },
  render: (args) => ({
    components: { FormCheckbox },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: `<FormCheckbox v-model="value" :aria-label="args.ariaLabel" :disabled="args.disabled"
      @update:model-value="args['onUpdate:modelValue']">{{ args.default }}</FormCheckbox>`,
  }),
  parameters: {
    docs: { description: { component: 'Design prototype: `materials/design-vtt/design/components/inventory.html`' } },
  },
} satisfies Meta<typeof FormCheckbox>

export default meta
type Story = StoryObj<typeof meta>

export const Unchecked: Story = {}

export const Checked: Story = {
  args: { modelValue: true },
}

export const LongLabel: Story = {
  args: { default: 'Consumable — removed from inventory after a single use' },
  decorators: [() => ({ template: '<div style="max-width: 280px"><story /></div>' })],
}

export const WithoutLabel: Story = {
  args: { default: '', ariaLabel: 'Equipped' },
}

export const Disabled: Story = {
  args: { disabled: true },
}
