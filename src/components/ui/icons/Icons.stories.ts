import type { Meta, StoryObj } from '@storybook/vue3-vite'
import IconArmor from './IconArmor.vue'
import IconArrowUp from './IconArrowUp.vue'
import IconBack from './IconBack.vue'
import IconBag from './IconBag.vue'
import IconCheck from './IconCheck.vue'
import IconCheckBold from './IconCheckBold.vue'
import IconCheckCircle from './IconCheckCircle.vue'
import IconChevronLeft from './IconChevronLeft.vue'
import IconChevronRight from './IconChevronRight.vue'
import IconClock from './IconClock.vue'
import IconClose from './IconClose.vue'
import IconCoin from './IconCoin.vue'
import IconDice from './IconDice.vue'
import IconDiceFab from './IconDiceFab.vue'
import IconDiceOutline from './IconDiceOutline.vue'
import IconEdit from './IconEdit.vue'
import IconFlask from './IconFlask.vue'
import IconHeart from './IconHeart.vue'
import IconHome from './IconHome.vue'
import IconInfo from './IconInfo.vue'
import IconLightning from './IconLightning.vue'
import IconLock from './IconLock.vue'
import IconMenu from './IconMenu.vue'
import IconMinus from './IconMinus.vue'
import IconPlus from './IconPlus.vue'
import IconSearch from './IconSearch.vue'
import IconShield from './IconShield.vue'
import IconStar from './IconStar.vue'
import IconTool from './IconTool.vue'
import IconTrash from './IconTrash.vue'
import IconWarning from './IconWarning.vue'
import IconWeapon from './IconWeapon.vue'

const icons = {
  IconArmor,
  IconArrowUp,
  IconBack,
  IconBag,
  IconCheck,
  IconCheckBold,
  IconCheckCircle,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconClose,
  IconCoin,
  IconDice,
  IconDiceFab,
  IconDiceOutline,
  IconEdit,
  IconFlask,
  IconHeart,
  IconHome,
  IconInfo,
  IconLightning,
  IconLock,
  IconMenu,
  IconMinus,
  IconPlus,
  IconSearch,
  IconShield,
  IconStar,
  IconTool,
  IconTrash,
  IconWarning,
  IconWeapon,
}

const meta = {
  title: 'UI/Icons',
  parameters: {
    docs: { description: { component: 'Design prototype: `materials/design-vtt/design/palette.html`' } },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Gallery: Story = {
  render: () => ({
    setup: () => ({ icons }),
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; color: var(--vtt-text-secondary)">
        <div
          v-for="(icon, name) in icons"
          :key="name"
          style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 8px; border: 1px solid var(--vtt-border-subtle); border-radius: var(--r-sm); background: var(--vtt-bg-surface)"
        >
          <component :is="icon" style="width: 24px; height: 24px; color: var(--vtt-accent-soft)" />
          <span style="font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.04em">{{ name }}</span>
        </div>
      </div>
    `,
  }),
}
