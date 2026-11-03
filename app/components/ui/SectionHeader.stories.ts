import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, userEvent, within } from 'storybook/test'
import Button from './Button.vue'
import SectionHeader from './SectionHeader.vue'
import IconPlus from './icons/IconPlus.vue'

const meta = {
  title: 'UI/SectionHeader',
  component: SectionHeader,
  args: { title: 'Abilities', variant: 'label', as: 'span' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['label', 'heading'] },
  },
  decorators: [() => ({ template: '<div style="max-width: 420px"><story /></div>' })],
  parameters: {
    docs: { description: { component: 'The head of a block: a title with an optional hint, count, right-hand note and `#action` slot.' } },
  },
} satisfies Meta<typeof SectionHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The wizard steps: an italic note next to the title. */
export const WithHint: Story = {
  args: { title: 'Attributes', hint: 'Roll 2d6 for each, or one by one' },
}

/** A list with its length after the title. */
export const WithCount: Story = {
  args: { title: 'Weapons', count: 2 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.section-header-title')).toHaveTextContent('Weapons · 2')
  },
}

/** A total or a summary at the right end. */
export const WithMeta: Story = {
  args: { title: 'Weapons', count: 2, meta: 'Damage 1d6 · Armor 1' },
}

export const WithAction: Story = {
  args: { title: 'Spirits', count: 1 },
  render: (args) => ({
    components: { SectionHeader, Button },
    setup: () => {
      const added = ref(0)
      return { args, IconPlus, added }
    },
    template: `
      <SectionHeader v-bind="args" :count="args.count + added">
        <template #action>
          <Button variant="dashed" size="sm" :icon-left="IconPlus" @click="added++">Add spirit</Button>
        </template>
      </SectionHeader>
    `,
  }),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Add spirit' }))
    await expect(canvasElement.querySelector('.section-header-title')).toHaveTextContent('Spirits · 2')
  },
}

/** Hint, meta and action together wrap on a narrow block. */
export const AllParts: Story = {
  args: { title: 'Hit points', hint: 'Roll 1d6 per level, keep the best', meta: '3 / 3' },
  decorators: [() => ({ template: '<div style="max-width: 260px"><story /></div>' })],
  render: (args) => ({
    components: { SectionHeader, Button },
    setup: () => ({ args }),
    template: `
      <SectionHeader v-bind="args">
        <template #action><Button variant="ghost" size="sm">Reroll</Button></template>
      </SectionHeader>
    `,
  }),
}

/** The larger serif title of a panel that is a heading for assistive tech. */
export const Heading: Story = {
  args: { title: 'Notes', variant: 'heading', as: 'h2' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 2, name: 'Notes' })).toBeVisible()
  },
}
