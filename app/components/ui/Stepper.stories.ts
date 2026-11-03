import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import Stepper from './Stepper.vue'

const meta = {
  title: 'UI/Stepper',
  component: Stepper,
  args: {
    modelValue: 2,
    step: 1,
    size: 'md',
    ariaLabel: 'Edit STR',
    'onUpdate:modelValue': fn(),
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['lg', 'md', 'sm'] },
    tone: { control: 'inline-radio', options: ['neutral', 'accent', 'danger', 'success'] },
    modelValue: { control: 'number' },
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
  },
  render: (args) => ({
    components: { Stepper },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: '<Stepper v-bind="args" v-model="value" />',
  }),
  parameters: {
    docs: { description: { component: 'Design prototype: `materials/design-vtt/design/components/stat-chip.html`' } },
  },
} satisfies Meta<typeof Stepper>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { min: -3, max: 3 },
}

export const Small: Story = {
  args: { size: 'sm', modelValue: 0, min: -10, max: 10, ariaLabel: 'Damage modifier' },
}

export const AtMin: Story = {
  args: { modelValue: -3, min: -3, max: 3 },
}

export const AtMax: Story = {
  args: { modelValue: 3, min: -3, max: 3 },
}

export const Unbounded: Story = {
  args: { modelValue: 0, ariaLabel: 'Modifier' },
}

export const Coins: Story = {
  args: { modelValue: 35, min: 0, step: 5, ariaLabel: 'Coins' },
}

/** A bare number with its buttons grouped after it, for a row where a framed field would be too heavy. */
export const Plain: Story = {
  render: (args) => ({
    components: { Stepper },
    setup: () => ({ args }),
    template: `
      <Stepper v-bind="args">
        <template #suffix><span style="font-family: var(--font-mono); font-size: 10px; color: var(--vtt-text-muted)">s.</span></template>
      </Stepper>
    `,
  }),
  args: { modelValue: 50, min: 0, lazy: true, variant: 'plain', ariaLabel: 'Coins', decreaseLabel: 'Remove a coin', increaseLabel: 'Add a coin' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add a coin' }))
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(51)
  },
}

export const Sizes: Story = {
  render: (args) => ({
    components: { Stepper },
    setup() {
      const value = ref(args.modelValue)
      return { args, value }
    },
    template: `
      <div style="display: flex; align-items: center; gap: 24px">
        <Stepper v-bind="args" v-model="value" size="sm" />
        <Stepper v-bind="args" v-model="value" size="md" />
      </div>
    `,
  }),
  args: { min: -3, max: 3 },
}

/** The amount of a panel: full width, round buttons, a large underlined number. */
export const Large: Story = {
  args: { size: 'lg', modelValue: 4, min: 0, tone: 'danger', ariaLabel: 'Amount' },
  decorators: [() => ({ template: '<div style="width: 288px"><story /></div>' })],
}

export const Tones: Story = {
  render: (args) => ({
    components: { Stepper },
    setup: () => ({ args, tones: ['neutral', 'accent', 'danger', 'success'] as const }),
    template: `
      <div style="display: flex; gap: 24px">
        <Stepper v-for="tone in tones" :key="tone" v-bind="args" :tone="tone" :model-value="4" />
      </div>
    `,
  }),
}

/** An amount wider than a stat bonus: the caller sets `--stepper-field-width`. */
export const WideField: Story = {
  args: { modelValue: 9529, min: 0, ariaLabel: 'Coins' },
  render: (args) => ({
    components: { Stepper },
    setup: () => ({ args }),
    template: '<Stepper v-bind="args" style="--stepper-field-width: 84px" />',
  }),
}

/** Only the number field, named by a visible label. */
export const FieldOnly: Story = {
  args: { modelValue: 1840, min: 0, hideButtons: true, labelledby: 'field-only-label', lazy: true },
  render: (args) => ({
    components: { Stepper },
    setup: () => ({ args }),
    template: `
      <div style="display: flex; align-items: center; gap: 8px; --stepper-field-width: 120px">
        <span id="field-only-label">Input</span>
        <Stepper v-bind="args" />
      </div>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('spinbutton', { name: 'Input' })).toBeVisible()
    await expect(canvas.queryByRole('button')).toBeNull()
    await expect(canvas.queryByRole('group')).toBeNull()
  },
}

export const NamedButtons: Story = {
  args: { modelValue: 35, min: 0, ariaLabel: 'Coins', decreaseLabel: 'Decrease coins', increaseLabel: 'Increase coins' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('group', { name: 'Coins' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Decrease coins' })).toBeEnabled()
    await expect(canvas.getByRole('button', { name: 'Increase coins' })).toBeEnabled()
  },
}

/** Without `lazy` every input reaches the model, for a model that only holds a local amount. */
export const EveryInput: Story = {
  args: { modelValue: 0, min: 0, ariaLabel: 'Amount' },
  play: async ({ args, canvasElement }) => {
    const field = within(canvasElement).getByRole('spinbutton', { name: 'Amount' })
    await userEvent.clear(field)
    await userEvent.type(field, '12')
    await expect(args['onUpdate:modelValue']).toHaveBeenCalledTimes(2)
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(12)
  },
}

/** With `lazy` typing stays a draft: one update per edit on blur, Enter or a step, none on Escape. */
export const Lazy: Story = {
  args: { modelValue: 35, min: 0, lazy: true, ariaLabel: 'Coins' },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement)
    const update = args['onUpdate:modelValue']
    const field = canvas.getByRole<HTMLInputElement>('spinbutton', { name: 'Coins' })

    await step('typing does not update; Enter does, once', async () => {
      await userEvent.clear(field)
      await userEvent.type(field, '120')
      await expect(update).not.toHaveBeenCalled()
      await userEvent.keyboard('{Enter}')
      await expect(update).toHaveBeenCalledTimes(1)
      await expect(update).toHaveBeenLastCalledWith(120)
    })

    await step('leaving the field does not update again, nor does an unchanged value', async () => {
      await userEvent.tab()
      await expect(update).toHaveBeenCalledTimes(1)
      await userEvent.clear(field)
      await userEvent.type(field, '120')
      await userEvent.tab()
      await expect(update).toHaveBeenCalledTimes(1)
    })

    await step('blur commits', async () => {
      await userEvent.clear(field)
      await userEvent.type(field, '7')
      await userEvent.tab()
      await expect(update).toHaveBeenCalledTimes(2)
      await expect(update).toHaveBeenLastCalledWith(7)
    })

    await step('Escape drops the draft', async () => {
      await userEvent.clear(field)
      await userEvent.type(field, '999')
      await userEvent.keyboard('{Escape}')
      await expect(field).toHaveValue(7)
      await userEvent.tab()
      await expect(update).toHaveBeenCalledTimes(2)
    })

    await step('each button press is one update', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Increase' }))
      await expect(update).toHaveBeenCalledTimes(3)
      await expect(update).toHaveBeenLastCalledWith(8)
      await userEvent.click(canvas.getByRole('button', { name: 'Decrease' }))
      await expect(update).toHaveBeenCalledTimes(4)
      await expect(update).toHaveBeenLastCalledWith(7)
    })

    await step('an emptied field commits nothing and shows the model again', async () => {
      await userEvent.clear(field)
      await userEvent.tab()
      await expect(update).toHaveBeenCalledTimes(4)
      await expect(field).toHaveValue(7)
      await userEvent.clear(field)
      await userEvent.keyboard('{Enter}')
      await expect(update).toHaveBeenCalledTimes(4)
      await expect(field).toHaveValue(7)
    })

    await step('so does text a number input cannot parse', async () => {
      await userEvent.clear(field)
      await userEvent.type(field, '1e')
      await userEvent.tab()
      await expect(update).toHaveBeenCalledTimes(4)
      await expect(field).toHaveValue(7)
    })

    await step('a value below min is clamped on commit', async () => {
      await userEvent.clear(field)
      await userEvent.type(field, '-5')
      await userEvent.keyboard('{Enter}')
      await expect(update).toHaveBeenLastCalledWith(0)
      await expect(field).toHaveValue(0)
    })
  },
}
