import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import ModeSwitch from './ModeSwitch.vue'

const meta = {
  title: 'UI/ModeSwitch',
  component: ModeSwitch,
  args: {
    modelValue: 'online',
    'onUpdate:modelValue': fn(),
  },
  argTypes: {
    modelValue: { control: 'inline-radio', options: ['online', 'offline'] },
  },
  render: (args) => ({
    components: { ModeSwitch },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: '<div style="max-width: 248px"><ModeSwitch v-bind="args" v-model="value" /></div>',
  }),
} satisfies Meta<typeof ModeSwitch>

export default meta
type Story = StoryObj<typeof meta>

export const Online: Story = {}

export const Offline: Story = {
  args: { modelValue: 'offline' },
}

export const SwitchToOffline: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    const offline = await within(canvasElement).findByRole('radio', { name: 'Offline' })
    await userEvent.click(offline)
    await expect(args['onUpdate:modelValue']).toHaveBeenCalledWith('offline')
    await expect(offline).toHaveAttribute('aria-checked', 'true')
  },
}
