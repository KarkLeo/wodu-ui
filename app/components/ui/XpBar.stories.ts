import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, within } from 'storybook/test'
import { expectNoEditControls } from '@/stories/readonly'
import XpBar from './XpBar.vue'

const meta = {
  title: 'UI/XpBar',
  component: XpBar,
  args: {
    current: 1840,
    max: 3000,
    hint: 'to lvl 3',
    onLevelUp: fn(),
    'onUpdate:current': fn(),
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'base', 'lg'] },
  },
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/xp-bar.html`',
      },
    },
  },
} satisfies Meta<typeof XpBar>

export default meta
type Story = StoryObj<typeof meta>

export const Growing: Story = {}

export const CloseToLevel: Story = {
  args: { current: 2650 },
}

export const ReadyToLevelUp: Story = {
  args: { current: 3000, isReady: true, hint: 'ready' },
}

export const LevelCap: Story = {
  args: { current: 47250, max: 47250, isCap: true, hint: 'max' },
}

/** What a read-only sheet shows: the value, nothing that changes XP or leads to level-up. */
export const ReadOnly: Story = {
  args: { showControls: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('1840')).toBeVisible()
    await expectNoEditControls(canvasElement)
  },
}

export const Sizes: Story = {
  render: (args) => ({
    components: { XpBar },
    setup: () => ({ args }),
    template: `
      <div style="display: grid; gap: 16px">
        <XpBar v-bind="args" size="sm" />
        <XpBar v-bind="args" size="base" />
        <XpBar v-bind="args" size="lg" />
      </div>
    `,
  }),
}
