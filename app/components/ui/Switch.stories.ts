import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import Switch from './Switch.vue'

const meta = {
  title: 'UI/Switch',
  component: Switch,
  args: {
    modelValue: false,
    label: 'Play on scene change',
    'onUpdate:modelValue': fn(),
  },
  render: (args) => ({
    components: { Switch },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: `<Switch v-model="value" :label="args.label" :disabled="args.disabled" :hide-label="args.hideLabel"
      @update:model-value="args['onUpdate:modelValue']" />`,
  }),
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Off: Story = {
  play: async ({ canvasElement, args }) => {
    const toggle = within(canvasElement).getByRole('switch', { name: 'Play on scene change' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(true)
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  },
}

export const On: Story = {
  args: { modelValue: true },
}

/** The visible label is part of the control: a click on the text toggles it. */
export const ClickLabel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Play on scene change'))
    await expect(canvas.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  },
}

export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole('switch')
    await userEvent.tab()
    await expect(toggle).toHaveFocus()
    await userEvent.keyboard(' ')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await userEvent.keyboard(' ')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement, args }) => {
    const toggle = within(canvasElement).getByRole('switch')
    await expect(toggle).toBeDisabled()
    await userEvent.click(toggle)
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(args['onUpdate:modelValue']).not.toHaveBeenCalled()
  },
}

/** The label names the switch for assistive tech and is not drawn. */
export const HiddenLabel: Story = {
  args: { hideLabel: true, label: 'Loop' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('switch', { name: 'Loop' })).toBeInTheDocument()
    await expect(canvas.queryByText('Loop')).toBeNull()
  },
}

/** The default slot replaces the visible text; the label stays the accessible name. */
export const CustomContent: Story = {
  render: (args) => ({
    components: { Switch },
    setup: () => ({ args, value: ref(true) }),
    template: `<Switch v-model="value" :label="args.label"><b>Music</b> <i>(loops)</i></Switch>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('switch', { name: 'Play on scene change' })).toBeInTheDocument()
    await expect(canvas.getByText('Music')).toBeVisible()
    await expect(canvas.queryByText('Play on scene change')).toBeNull()
  },
}

export const LongLabel: Story = {
  args: { label: 'Show the scene image to every player at the table, not only to the ones who are connected' },
  decorators: [() => ({ template: '<div style="max-width: 280px"><story /></div>' })],
}
