import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import XpControlsPanel from './XpControlsPanel.vue'
// The panel's styles live in XpBar.vue's global <style> block, scoped under `.xp-popover`.
import './XpBar.vue'

const meta = {
  title: 'UI/XpControlsPanel',
  component: XpControlsPanel,
  args: {
    current: 1840,
    max: 3000,
    showHeader: true,
    'onUpdate:current': fn(),
    onLevelUp: fn(),
  },
  decorators: [() => ({ template: '<div class="xp-popover"><story /></div>' })],
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/xp-bar.html`',
      },
    },
  },
} satisfies Meta<typeof XpControlsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const WithHeader: Story = {}

export const WithoutHeader: Story = {
  args: { showHeader: false },
}

export const CustomTitle: Story = {
  args: { popoverTitle: 'Brannoc the Fighter' },
}

export const ReadyToLevelUp: Story = {
  args: { current: 3000, isReady: true },
}
