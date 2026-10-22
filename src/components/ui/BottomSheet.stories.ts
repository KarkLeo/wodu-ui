import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref, watch } from 'vue'
import BottomSheet from './BottomSheet.vue'
import Button from './Button.vue'

const catalog = [
  { name: 'Light weapon', notes: 'Daggers, short swords, hand axes', price: 10 },
  { name: 'Martial weapon', notes: 'Long swords, hammers, axes, spears', price: 30 },
  { name: 'Great weapon', notes: 'Two-handed swords, battle axes, polearms', price: 40 },
  { name: 'Shortbow', notes: 'Slings and the like', price: 10 },
  { name: 'Light armor', notes: 'Armor 1', price: 30 },
  { name: 'Shield', notes: '+1 armor', price: 10 },
  { name: 'Rope', notes: '50 feet', price: 2 },
  { name: 'Torches', notes: 'A bundle of six', price: 2 },
]

const listTemplate = `
  <ul style="list-style: none; margin: 0; padding: 0">
    <li
      v-for="item in catalog"
      :key="item.name"
      style="display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid var(--vtt-border-subtle)"
    >
      <span>
        <span style="display: block; color: var(--vtt-text-primary)">{{ item.name }}</span>
        <span style="font-size: 12px; color: var(--vtt-text-muted)">{{ item.notes }}</span>
      </span>
      <span style="font-family: var(--font-mono); color: var(--vtt-accent-soft); white-space: nowrap">{{ item.price }} s</span>
    </li>
  </ul>
`

const meta = {
  title: 'UI/BottomSheet',
  component: BottomSheet,
  args: {
    open: false,
    title: 'Gear catalog',
    maxWidth: 520,
    'onUpdate:open': fn(),
  },
  render: (args) => ({
    components: { BottomSheet, Button },
    setup() {
      const open = ref(args.open)
      watch(() => args.open, (v) => { open.value = v })
      return { args, open, catalog }
    },
    template: `
      <Button variant="hero" @click="open = true">Open catalog</Button>
      <BottomSheet v-bind="args" v-model:open="open">
        ${listTemplate}
        <template #footer>
          <Button variant="ghost" @click="open = false">Close</Button>
          <Button variant="hero" @click="open = false">Buy selected</Button>
        </template>
      </BottomSheet>
    `,
  }),
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/inventory.html` (catalog bottom sheet, §5)',
      },
    },
  },
} satisfies Meta<typeof BottomSheet>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  args: { open: true },
}

export const WithoutTitle: Story = {
  args: { title: undefined },
}

export const Narrow: Story = {
  args: { maxWidth: 360, title: 'Shortbow' },
  render: (args) => ({
    components: { BottomSheet, Button },
    setup() {
      const open = ref(args.open)
      watch(() => args.open, (v) => { open.value = v })
      return { args, open }
    },
    template: `
      <Button variant="primary" @click="open = true">Show item</Button>
      <BottomSheet v-bind="args" v-model:open="open">
        <p style="margin: 0; color: var(--vtt-text-secondary); line-height: 1.5">
          Slings and the like. Damage 1d6, ranged. Costs 10 s.
        </p>
      </BottomSheet>
    `,
  }),
}
