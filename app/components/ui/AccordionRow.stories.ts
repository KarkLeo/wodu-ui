import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import AccordionRow from './AccordionRow.vue'
import Button from './Button.vue'
import ItemStatChip from '@/features/in-game/components/inventory/ItemStatChip.vue'

const meta = {
  title: 'UI/AccordionRow',
  component: AccordionRow,
  args: {
    expanded: false,
    details: [
      { label: 'Special', text: 'Regenerates 1 HP a round unless burned.' },
      { label: 'Notes', text: 'Lairs under the old bridge.\nHates the miller.' },
    ],
    'onUpdate:expanded': fn(),
  },
  render: (args) => ({
    components: { AccordionRow, Button, ItemStatChip },
    setup() {
      const open = ref(args.expanded)
      watch(() => args.expanded, (v) => { open.value = v })
      return { args, open }
    },
    template: `
      <ul style="margin: 0; padding: 0">
        <AccordionRow v-model:expanded="open" :details="args.details" @update:expanded="args['onUpdate:expanded']">
          <template #title>Bridge troll</template>
          <template #meta>
            <ItemStatChip variant="hp">18 HP</ItemStatChip>
            <ItemStatChip variant="armor">armor 1</ItemStatChip>
            <ItemStatChip variant="damage">1d10+1</ItemStatChip>
          </template>
          <template #actions>
            <Button variant="ghost" size="sm">Edit</Button>
            <Button variant="danger-ghost" size="sm" style="margin-left: auto">Delete</Button>
          </template>
        </AccordionRow>
      </ul>
    `,
  }),
  decorators: [() => ({ template: '<div style="max-width: 640px"><story /></div>' })],
} satisfies Meta<typeof AccordionRow>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}

export const Open: Story = {
  args: { expanded: true },
}

export const OpenWithoutDetails: Story = {
  args: { expanded: true, details: [] },
}

/** The header toggles the body; the row is named by its title. */
export const Toggling: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const row = canvas.getByRole('listitem', { name: 'Bridge troll' })
    const head = within(row).getAllByRole('button')[0]!
    await expect(head).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByText('Lairs under the old bridge.', { exact: false })).toBeNull()

    await userEvent.click(head)
    await expect(head).toHaveAttribute('aria-expanded', 'true')
    await expect(args['onUpdate:expanded']).toHaveBeenLastCalledWith(true)
    const body = canvasElement.ownerDocument.getElementById(head.getAttribute('aria-controls')!)!
    await expect(within(body).getByText('Special')).toBeVisible()
    await expect(within(body).getByRole('button', { name: 'Edit' })).toBeVisible()

    await userEvent.click(head)
    await expect(head).toHaveAttribute('aria-expanded', 'false')
    await expect(args['onUpdate:expanded']).toHaveBeenLastCalledWith(false)
  },
}

const single = (meta: string) => ({
  components: { AccordionRow },
  template: `
    <ul style="margin: 0; padding: 0">
      <AccordionRow>
        <template #title>Lantern oil</template>
        <template #meta>${meta}</template>
      </AccordionRow>
    </ul>
  `,
})
const metaOf = (canvasElement: HTMLElement) => canvasElement.querySelector<HTMLElement>('.accordion-meta')!

/** A meta wrapper that renders nothing takes no room. */
export const EmptyMeta: Story = {
  render: () => single('<span class="chips"></span>'),
  play: async ({ canvasElement }) => {
    await expect(metaOf(canvasElement)).not.toBeVisible()
  },
}

/** Plain text in the meta slot still shows. */
export const TextMeta: Story = {
  render: () => single('3 left'),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('3 left')).toBeVisible()
  },
}

/** On a phone the chips drop under the title. */
export const Phone: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { expanded: true },
}
