import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import HpBar from './HpBar.vue'

const meta = {
  title: 'UI/HpBar',
  component: HpBar,
  args: {
    current: 12,
    max: 12,
    onApplyDamage: fn(),
    onHeal: fn(),
    onAddTemp: fn(),
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'base', 'lg'] },
  },
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
  parameters: {
    docs: { description: { component: 'Design prototype: `materials/design-vtt/design/components/hp-bar.html`' } },
  },
} satisfies Meta<typeof HpBar>

export default meta
type Story = StoryObj<typeof meta>

export const Full: Story = {}

export const Wounded: Story = {
  args: { current: 6 },
}

export const Critical: Story = {
  args: { current: 2 },
}

export const Down: Story = {
  args: { current: 0 },
}

export const WithTempHp: Story = {
  args: { current: 8, temp: 4 },
}

export const WithEffects: Story = {
  args: {
    current: 7,
    effects: [
      { label: 'Bleeding', kind: 'dot', meta: '−1/turn' },
      { label: 'Regeneration', kind: 'hot' },
      { label: 'Poisoned', kind: 'warn' },
    ],
  },
}

export const ReadOnly: Story = {
  args: { current: 9, showControls: false },
}

export const Sizes: Story = {
  render: (args) => ({
    components: { HpBar },
    setup: () => ({ args }),
    template: `
      <div style="display: grid; gap: 16px">
        <HpBar v-bind="args" size="sm" />
        <HpBar v-bind="args" size="base" />
        <HpBar v-bind="args" size="lg" />
      </div>
    `,
  }),
  args: { current: 7 },
}
