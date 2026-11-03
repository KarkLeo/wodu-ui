import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import TextField from './TextField.vue'

const meta = {
  title: 'UI/TextField',
  component: TextField,
  args: {
    modelValue: '',
    label: 'Name',
    placeholder: 'Longsword',
    'onUpdate:modelValue': fn(),
  },
  render: (args) => ({
    components: { TextField },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: `<TextField v-bind="args" v-model="value" @update:model-value="args['onUpdate:modelValue']" />`,
  }),
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
} satisfies Meta<typeof TextField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Filled: Story = {
  args: { modelValue: 'Hunting crossbow' },
}

/** Dice formulas and numbers. */
export const Mono: Story = {
  args: { label: 'Damage', modelValue: '1d8+1', mono: true, placeholder: 'd6' },
}

/** The error sits under the field, and the input points at it. */
export const WithError: Story = {
  args: { label: 'Price', modelValue: '1.5', mono: true, inputmode: 'numeric', error: 'A whole number from 0 to 100000.' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Price')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAttribute('inputmode', 'numeric')
    await expect(input).toHaveAccessibleDescription('A whole number from 0 to 100000.')
  },
}

/** Without an error the input is valid and describes nothing. */
export const Typing: Story = {
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Name' })
    await expect(input).toHaveAttribute('aria-invalid', 'false')
    await expect(input).not.toHaveAttribute('aria-describedby')
    await userEvent.type(input, 'Rope')
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith('Rope')
  },
}

/** The sign-in look: no box, a rule under a larger serif text, the hint under it describing the field. */
export const Underline: Story = {
  args: {
    variant: 'underline',
    type: 'email',
    label: 'Email',
    placeholder: 'you@example.com',
    hint: 'No password — we’ll email you a code.',
    autocomplete: 'email',
    spellcheck: false,
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('Email')
    await expect(input).toHaveAttribute('type', 'email')
    await expect(input).toHaveAttribute('spellcheck', 'false')
    await expect(input).toHaveAccessibleDescription('No password — we’ll email you a code.')
  },
}

/** A muted note after the label; it is part of the field's name. `maxlength` caps the text. */
export const OptionalNote: Story = {
  args: {
    variant: 'underline',
    label: 'Player name',
    optional: '— a nickname is fine',
    placeholder: undefined,
    maxlength: 5,
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: /Player name/ })
    await userEvent.type(input, 'Annabel')
    await expect(input).toHaveValue('Annab')
  },
}

/** The `hint` slot, for a hint with an icon. Both the hint and an error describe the field. */
export const HintSlotAndError: Story = {
  args: { variant: 'underline', label: 'True name', placeholder: 'Known only to you', error: 'Too long.' },
  render: (args) => ({
    components: { TextField },
    setup() {
      const value = ref(args.modelValue)
      return { args, value }
    },
    template: `
      <TextField v-bind="args" v-model="value">
        <template #hint>
          <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="6" cy="6" r="4"/></svg>
          Spirits who learn it gain power over you.
        </template>
      </TextField>
    `,
  }),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('True name')
    await expect(input).toHaveAccessibleDescription('Spirits who learn it gain power over you. Too long.')
  },
}

/** Where the surroundings already say what the field is, the label is kept for assistive tech only. */
export const HiddenLabel: Story = {
  args: { label: 'Source (potion, curse…)', placeholder: 'Source (potion, curse…)', hideLabel: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('textbox', { name: 'Source (potion, curse…)' })).toBeInTheDocument()
  },
}

/** `list` points at a `<datalist>`; `blur` lets a debounced field commit when focus leaves. */
export const SuggestionsAndBlur: Story = {
  args: { label: 'Sphere', placeholder: 'Pick or type', list: 'story-spheres', onBlur: fn() },
  render: (args) => ({
    components: { TextField },
    setup() {
      const value = ref(args.modelValue)
      return { args, value }
    },
    template: `
      <TextField v-bind="args" v-model="value" />
      <datalist id="story-spheres"><option value="Fire" /><option value="Water" /></datalist>
    `,
  }),
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByLabelText('Sphere')
    await expect(input).toHaveAttribute('list', 'story-spheres')
    await userEvent.click(input)
    await userEvent.tab()
    await expect(args.onBlur).toHaveBeenCalledTimes(1)
  },
}

/** Tight rows (a popover's add line): smaller box and placeholder, while typed text stays 16px so iOS does not zoom. */
export const Compact: Story = {
  args: { label: 'Source', hideLabel: true, size: 'sm', placeholder: 'Source (potion, curse…)' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Source' })
    await expect(getComputedStyle(input).fontSize).toBe('16px')
    await expect(input.getBoundingClientRect().height).toBeLessThan(36)
  },
}
