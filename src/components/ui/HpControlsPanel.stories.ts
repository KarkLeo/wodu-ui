import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import HpControlsPanel from './HpControlsPanel.vue'
// The panel's styles live in HpBar.vue's global <style> block, scoped under `.hp-popover`.
import './HpBar.vue'

const meta = {
  title: 'UI/HpControlsPanel',
  component: HpControlsPanel,
  args: {
    current: 9,
    max: 12,
    showHeader: true,
    onApplyDamage: fn(),
    onHeal: fn(),
    onAddTemp: fn(),
    onSubmitted: fn(),
  },
  argTypes: {
    // With a characterId the dice buttons roll through useDiceRoller, which persists to PocketBase.
    characterId: { table: { disable: true } },
    characterName: { table: { disable: true } },
  },
  decorators: [() => ({ template: '<div class="hp-popover"><story /></div>' })],
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/hp-bar.html`',
      },
    },
  },
} satisfies Meta<typeof HpControlsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const WithHeader: Story = {}

export const WithoutHeader: Story = {
  args: { showHeader: false },
}

export const WithTempHp: Story = {
  args: { current: 7, temp: 3 },
}

export const Critical: Story = {
  args: { current: 2 },
}
