import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref, watch } from 'vue'
import TabBar from './TabBar.vue'
import IconBag from './icons/IconBag.vue'
import IconEdit from './icons/IconEdit.vue'
import IconFlask from './icons/IconFlask.vue'
import IconStar from './icons/IconStar.vue'

const inGameTabs = [
  { value: 'main', label: 'Main' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'magic', label: 'Magic' },
  { value: 'notes', label: 'Notes' },
]

const decoratedTabs = [
  { value: 'main', label: 'Main', icon: IconStar },
  { value: 'inventory', label: 'Inventory', icon: IconBag, badge: 12 },
  { value: 'magic', label: 'Magic', icon: IconFlask, dot: 'accent' as const },
  { value: 'notes', label: 'Notes', icon: IconEdit },
]

const meta = {
  title: 'UI/TabBar',
  component: TabBar,
  args: {
    modelValue: 'main',
    tabs: inGameTabs,
    variant: 'top',
    size: 'md',
    'onUpdate:modelValue': fn(),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['top', 'bottom'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    modelValue: { control: 'select', options: ['main', 'inventory', 'magic', 'notes'] },
  },
  render: (args) => ({
    components: { TabBar },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: '<TabBar v-bind="args" v-model="value" />',
  }),
  decorators: [() => ({ template: '<div style="max-width: 560px"><story /></div>' })],
  parameters: {
    docs: { description: { component: 'Design prototype: `materials/design-vtt/design/components/tab-bar.html`' } },
  },
} satisfies Meta<typeof TabBar>

export default meta
type Story = StoryObj<typeof meta>

export const Top: Story = {}

export const WithIconsBadgeAndDot: Story = {
  args: { tabs: decoratedTabs, modelValue: 'inventory' },
}

export const DotKinds: Story = {
  args: {
    tabs: [
      { value: 'main', label: 'Main', dot: 'accent' },
      { value: 'inventory', label: 'Inventory', dot: 'danger' },
      { value: 'magic', label: 'Magic', dot: 'info' },
    ],
  },
}

export const WithDisabledTab: Story = {
  args: {
    tabs: [
      { value: 'main', label: 'Main' },
      { value: 'inventory', label: 'Inventory' },
      { value: 'magic', label: 'Magic', disabled: true },
      { value: 'notes', label: 'Notes' },
    ],
  },
}

export const Bottom: Story = {
  args: { variant: 'bottom', tabs: decoratedTabs },
  decorators: [() => ({ template: '<div style="max-width: 375px"><story /></div>' })],
}

export const Narrow: Story = {
  args: { tabs: decoratedTabs },
  decorators: [() => ({ template: '<div style="max-width: 320px"><story /></div>' })],
}

export const Sizes: Story = {
  render: (args) => ({
    components: { TabBar },
    setup() {
      const value = ref(args.modelValue)
      return { args, value }
    },
    template: `
      <div style="display: grid; gap: 16px">
        <TabBar v-bind="args" v-model="value" size="sm" />
        <TabBar v-bind="args" v-model="value" size="md" />
        <TabBar v-bind="args" v-model="value" size="lg" />
      </div>
    `,
  }),
  args: { tabs: decoratedTabs },
}
