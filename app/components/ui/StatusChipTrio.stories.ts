import type { Meta, StoryObj } from '@storybook/vue3-vite'
import StatusChipTrio from './StatusChipTrio.vue'
import StatusChip from './StatusChip.vue'
import IconWeapon from './icons/IconWeapon.vue'
import IconShield from './icons/IconShield.vue'
import IconCoin from './icons/IconCoin.vue'
import IconDice from './icons/IconDice.vue'

const meta = {
  title: 'UI/StatusChipTrio',
  component: StatusChipTrio,
  render: (args) => ({
    components: { StatusChipTrio, StatusChip, IconWeapon, IconShield, IconCoin },
    setup: () => ({ args }),
    template: `
      <StatusChipTrio v-bind="args">
        <StatusChip kind="damage" label="Damage" value="d8+2">
          <template #symbol><IconWeapon /></template>
        </StatusChip>
        <StatusChip kind="armor" label="Armor" :value="3">
          <template #symbol><IconShield /></template>
        </StatusChip>
        <StatusChip kind="coin" label="Coins" :value="45">
          <template #symbol><IconCoin /></template>
        </StatusChip>
      </StatusChipTrio>
    `,
  }),
  args: {
    noFrame: false,
  },
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/status-chip.html`',
      },
    },
  },
} satisfies Meta<typeof StatusChipTrio>

export default meta
type Story = StoryObj<typeof meta>

export const Framed: Story = {}

export const NoFrame: Story = {
  args: { noFrame: true },
}

export const CompactHeader: Story = {
  render: (args) => ({
    components: { StatusChipTrio, StatusChip, IconWeapon, IconShield, IconCoin },
    setup: () => ({ args }),
    template: `
      <StatusChipTrio v-bind="args">
        <StatusChip kind="damage" label="Damage" value="d8+2" size="sm">
          <template #symbol><IconWeapon /></template>
        </StatusChip>
        <StatusChip kind="armor" label="Armor" :value="3" size="sm">
          <template #symbol><IconShield /></template>
        </StatusChip>
        <StatusChip kind="coin" label="Coins" :value="45" size="sm">
          <template #symbol><IconCoin /></template>
        </StatusChip>
      </StatusChipTrio>
    `,
  }),
  args: { noFrame: true },
}

export const NoWeapon: Story = {
  render: (args) => ({
    components: { StatusChipTrio, StatusChip, IconWeapon, IconShield, IconCoin },
    setup: () => ({ args }),
    template: `
      <StatusChipTrio v-bind="args">
        <StatusChip kind="dim" label="Damage" value="—">
          <template #symbol><IconWeapon /></template>
        </StatusChip>
        <StatusChip kind="armor" label="Armor" :value="0">
          <template #symbol><IconShield /></template>
        </StatusChip>
        <StatusChip kind="coin" label="Coins" :value="12">
          <template #symbol><IconCoin /></template>
        </StatusChip>
      </StatusChipTrio>
    `,
  }),
}

export const WithPopovers: Story = {
  render: (args) => ({
    components: { StatusChipTrio, StatusChip, IconWeapon, IconShield, IconCoin, IconDice },
    setup: () => ({ args }),
    template: `
      <StatusChipTrio v-bind="args">
        <StatusChip kind="damage" label="Damage" value="d8+2" has-popover popover-title="Martial weapon">
          <template #symbol><IconWeapon /></template>
          <template #popover>
            <div class="pop-head">
              <span class="pop-title">Martial weapon</span>
              <span class="pop-sub">d8+2</span>
            </div>
            <div class="breakdown">
              <div class="breakdown-row">
                <span class="br-name">Martial weapon</span>
                <span class="br-value">d8</span>
              </div>
              <div class="breakdown-row">
                <span class="br-name">Slay</span>
                <span class="br-value is-buff">+2</span>
              </div>
            </div>
            <button type="button" class="pop-hero-roll">
              <IconDice />
              <span>Roll d8+2</span>
            </button>
          </template>
        </StatusChip>
        <StatusChip kind="armor" label="Armor" :value="3" has-popover popover-title="Armor">
          <template #symbol><IconShield /></template>
          <template #popover>
            <div class="pop-head">
              <span class="pop-title">Armor</span>
              <span class="pop-sub">3</span>
            </div>
            <div class="breakdown">
              <div class="breakdown-row">
                <span class="br-name">Full armor</span>
                <span class="br-value">+2</span>
              </div>
              <div class="breakdown-row">
                <span class="br-name">Shield</span>
                <span class="br-value">+1</span>
              </div>
            </div>
            <div class="breakdown-total">
              <span class="bt-label">Total</span>
              <span class="bt-value">3</span>
            </div>
          </template>
        </StatusChip>
        <StatusChip kind="coin" label="Coins" :value="45" has-popover popover-title="Coins">
          <template #symbol><IconCoin /></template>
          <template #popover>
            <div class="pop-head">
              <span class="pop-title">Coins</span>
              <span class="pop-sub">45</span>
            </div>
          </template>
        </StatusChip>
      </StatusChipTrio>
    `,
  }),
}
