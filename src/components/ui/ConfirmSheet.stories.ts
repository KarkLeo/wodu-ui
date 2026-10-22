import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref, watch } from 'vue'
import ConfirmSheet from './ConfirmSheet.vue'
import Button from './Button.vue'

const meta = {
  title: 'UI/ConfirmSheet',
  component: ConfirmSheet,
  args: {
    open: false,
    title: 'Not enough coins',
    variant: 'gold',
    'onUpdate:open': fn(),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['gold', 'danger'] },
  },
  render: (args) => ({
    components: { ConfirmSheet, Button },
    setup() {
      const open = ref(args.open)
      watch(() => args.open, (v) => { open.value = v })
      return { args, open }
    },
    template: `
      <Button variant="primary" @click="open = true">Buy great weapon</Button>
      <ConfirmSheet v-bind="args" v-model:open="open">
        <p>“Great weapon” costs 40 s, you have 25 s. Discuss with the GM.</p>
        <template #actions>
          <Button variant="hero" @click="open = false">Ask the GM</Button>
          <Button variant="ghost" @click="open = false">Cancel</Button>
        </template>
      </ConfirmSheet>
    `,
  }),
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/magic.html` (§6 overdose dialog); shared sheet tokens in `materials/design-vtt/design/palette.html`',
      },
    },
  },
} satisfies Meta<typeof ConfirmSheet>

export default meta
type Story = StoryObj<typeof meta>

export const Gold: Story = {}

export const GoldOpen: Story = {
  args: { open: true },
}

export const Danger: Story = {
  args: { title: 'Quicksilver overdose', variant: 'danger' },
  render: (args) => ({
    components: { ConfirmSheet, Button },
    setup() {
      const open = ref(args.open)
      watch(() => args.open, (v) => { open.value = v })
      return { args, open }
    },
    template: `
      <Button variant="danger-ghost" @click="open = true">Drink quicksilver</Button>
      <ConfirmSheet v-bind="args" v-model:open="open">
        <p>Already 3 doses today against a daily limit of 3. The next one could be the last.</p>
        <template #actions>
          <Button variant="hero-danger" @click="open = false">Roll CON and drink</Button>
          <Button variant="primary" @click="open = false">New day · reset counter</Button>
        </template>
      </ConfirmSheet>
    `,
  }),
}

export const DangerOpen: Story = {
  ...Danger,
  args: { ...Danger.args, open: true },
}
