import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import StatusChip from './StatusChip.vue'
import IconWeapon from './icons/IconWeapon.vue'
import IconShield from './icons/IconShield.vue'
import IconCoin from './icons/IconCoin.vue'
import IconDice from './icons/IconDice.vue'

const ICONS = {
  damage: IconWeapon,
  armor: IconShield,
  coin: IconCoin,
  dim: IconWeapon,
}

const meta = {
  title: 'UI/StatusChip',
  component: StatusChip,
  render: (args) => ({
    components: { StatusChip },
    setup: () => ({ args, icons: ICONS }),
    template: `
      <StatusChip v-bind="args">
        <template #symbol><component :is="icons[args.kind]" /></template>
      </StatusChip>
    `,
  }),
  args: {
    kind: 'damage',
    label: 'Damage',
    value: 'd8+2',
    meta: 'martial weapon',
    onOpen: fn(),
  },
  argTypes: {
    kind: { control: 'inline-radio', options: ['damage', 'armor', 'coin', 'dim'] },
    size: { control: 'inline-radio', options: ['sm', 'base', 'lg'] },
  },
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/status-chip.html`',
      },
    },
  },
} satisfies Meta<typeof StatusChip>

export default meta
type Story = StoryObj<typeof meta>

export const Damage: Story = {}

export const Armor: Story = {
  args: { kind: 'armor', label: 'Armor', value: 3, meta: 'full armor + shield' },
}

export const Coins: Story = {
  args: { kind: 'coin', label: 'Coins', value: 45, meta: 'purse' },
}

export const NoWeapon: Story = {
  args: { kind: 'dim', label: 'Damage', value: '—', meta: 'no weapon' },
}

export const Buffed: Story = {
  args: { value: 'd8', mod: '+d4', meta: 'martial weapon' },
}

export const Debuffed: Story = {
  args: { kind: 'armor', label: 'Armor', value: 2, mod: '−1', meta: 'shield broken' },
}

export const Kinds: Story = {
  render: (args) => ({
    components: { StatusChip },
    setup: () => ({ args, icons: ICONS }),
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 16px">
        <StatusChip v-bind="args" kind="damage" label="Damage" value="d8+2" meta="martial weapon">
          <template #symbol><component :is="icons.damage" /></template>
        </StatusChip>
        <StatusChip v-bind="args" kind="armor" label="Armor" :value="3" meta="full armor + shield">
          <template #symbol><component :is="icons.armor" /></template>
        </StatusChip>
        <StatusChip v-bind="args" kind="coin" label="Coins" :value="45" meta="purse">
          <template #symbol><component :is="icons.coin" /></template>
        </StatusChip>
        <StatusChip v-bind="args" kind="dim" label="Damage" value="—" meta="no weapon">
          <template #symbol><component :is="icons.dim" /></template>
        </StatusChip>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: (args) => ({
    components: { StatusChip },
    setup: () => ({ args, icons: ICONS }),
    template: `
      <div style="display: flex; align-items: center; gap: 16px">
        <StatusChip v-bind="args" size="sm">
          <template #symbol><component :is="icons[args.kind]" /></template>
        </StatusChip>
        <StatusChip v-bind="args" size="base">
          <template #symbol><component :is="icons[args.kind]" /></template>
        </StatusChip>
        <StatusChip v-bind="args" size="lg">
          <template #symbol><component :is="icons[args.kind]" /></template>
        </StatusChip>
      </div>
    `,
  }),
}

export const WithPopover: Story = {
  render: (args) => ({
    components: { StatusChip, IconWeapon, IconDice },
    setup: () => ({ args }),
    template: `
      <StatusChip v-bind="args">
        <template #symbol><IconWeapon /></template>
        <template #popover>
          <div class="pop-head">
            <span class="pop-title">Martial weapon</span>
            <span class="pop-sub">d8+2</span>
          </div>
          <div class="breakdown">
            <div class="breakdown-row">
              <div>
                <span class="br-name">Martial weapon</span>
                <span class="br-source">weapon</span>
              </div>
              <span class="br-value">d8</span>
            </div>
            <div class="breakdown-row">
              <div>
                <span class="br-name">Slay</span>
                <span class="br-source">ability</span>
              </div>
              <span class="br-value is-buff">+2</span>
            </div>
          </div>
          <div class="breakdown-total">
            <span class="bt-label">Total</span>
            <span class="bt-value">d8+2</span>
          </div>
          <button type="button" class="pop-hero-roll">
            <IconDice />
            <span>Roll d8+2</span>
          </button>
        </template>
      </StatusChip>
    `,
  }),
  args: { hasPopover: true, popoverTitle: 'Martial weapon', meta: undefined },
}
