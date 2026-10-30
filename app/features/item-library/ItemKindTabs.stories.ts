import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'
import ItemKindTabs from './ItemKindTabs.vue'
import type { ItemKindFilter } from '@/types/library'

const meta = {
  title: 'Library/ItemKindTabs',
  component: ItemKindTabs,
  globals: { viewport: { value: 'phone', isRotated: false } },
} satisfies Meta<typeof ItemKindTabs>

export default meta
type Story = StoryObj<typeof meta>

/** All eight options; picking one changes the model. */
export const Default: Story = {
  args: { modelValue: 'all' },
  render: () => ({
    components: { ItemKindTabs },
    setup() {
      const kind = ref<ItemKindFilter>('all')
      return { kind }
    },
    template: '<ItemKindTabs v-model="kind" /><output data-testid="kind">{{ kind }}</output>',
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('radio')).toHaveLength(8)
    await expect(canvas.getByRole('radio', { name: 'All' })).toBeChecked()
    await userEvent.click(canvas.getByRole('radio', { name: 'Other' }))
    await expect(canvas.getByTestId('kind')).toHaveTextContent('custom')
    await expect(canvas.getByRole('radio', { name: 'Other' })).toBeChecked()
  },
}
