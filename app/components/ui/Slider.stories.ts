import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import Slider from './Slider.vue'

const meta = {
  title: 'UI/Slider',
  component: Slider,
  args: {
    modelValue: 0.5,
    ariaLabel: 'Volume',
    'onUpdate:modelValue': fn(),
  },
  render: (args) => ({
    components: { Slider },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: `<Slider v-model="value" :min="args.min" :max="args.max" :step="args.step" :aria-label="args.ariaLabel"
      :disabled="args.disabled" @update:model-value="args['onUpdate:modelValue']" />`,
  }),
  decorators: [() => ({ template: '<div style="width: 320px"><story /></div>' })],
} satisfies Meta<typeof Slider>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const thumb = within(canvasElement).getByRole('slider', { name: 'Volume' })
    await expect(thumb).toHaveAttribute('aria-valuenow', '0.5')
    thumb.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(thumb).toHaveAttribute('aria-valuenow', '0.55')
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(0.55)
    await userEvent.keyboard('{Home}')
    await expect(thumb).toHaveAttribute('aria-valuenow', '0')
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(0)
    await userEvent.keyboard('{End}')
    await expect(thumb).toHaveAttribute('aria-valuenow', '1')
  },
}

export const Whole: Story = {
  args: { modelValue: 40, min: 0, max: 100, step: 5, ariaLabel: 'Opacity' },
  play: async ({ canvasElement }) => {
    const thumb = within(canvasElement).getByRole('slider', { name: 'Opacity' })
    thumb.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(thumb).toHaveAttribute('aria-valuenow', '45')
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    const thumb = within(canvasElement).getByRole('slider')
    thumb.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(thumb).toHaveAttribute('aria-valuenow', '0.5')
    await expect(args['onUpdate:modelValue']).not.toHaveBeenCalled()
  },
}
