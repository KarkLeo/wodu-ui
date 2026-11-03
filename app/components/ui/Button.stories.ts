import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import Button from './Button.vue'
import IconDice from './icons/IconDice.vue'
import IconDiceFace from './icons/IconDiceFace.vue'
import IconHeart from './icons/IconHeart.vue'
import IconPlus from './icons/IconPlus.vue'
import IconStar from './icons/IconStar.vue'
import IconTrash from './icons/IconTrash.vue'

const meta = {
  title: 'UI/Button',
  component: Button,
  args: {
    variant: 'ghost',
    size: 'base',
    disabled: false,
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'hero', 'hero-danger', 'hero-success', 'ghost', 'dashed', 'danger-ghost', 'roll'],
    },
    size: { control: 'inline-radio', options: ['sm', 'base', 'lg'] },
    type: { control: 'inline-radio', options: ['button', 'submit', 'reset'] },
    iconLeft: { control: false },
    iconRight: { control: false },
  },
  parameters: {
    docs: { description: { component: 'Design prototype: `materials/design-vtt/design/palette.html`' } },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Ghost: Story = {
  args: { variant: 'ghost', default: 'Edit' },
}

export const Primary: Story = {
  args: { variant: 'primary', default: 'Save' },
}

export const Hero: Story = {
  args: { variant: 'hero', iconLeft: IconDice, default: 'Roll' },
}

export const HeroDanger: Story = {
  args: { variant: 'hero-danger', default: 'Reset session' },
}

/** The heal submit of the HP controls. */
export const HeroSuccess: Story = {
  args: { variant: 'hero-success', default: 'Heal' },
}

/** An add action that opens a picker or appends an empty entry: catalog, library, a new spirit or ritual. */
export const Dashed: Story = {
  args: { variant: 'dashed', iconLeft: IconPlus, default: 'Add spirit' },
}

export const DangerGhost: Story = {
  args: { variant: 'danger-ghost', iconLeft: IconTrash, default: 'Delete' },
}

/** The small squared dice action beside a section title: roll the stats, the HP, the hit dice. */
export const Roll: Story = {
  args: { variant: 'roll', iconLeft: IconDiceFace, default: 'Roll all' },
}

export const RollDisabled: Story = {
  args: { variant: 'roll', iconLeft: IconDiceFace, disabled: true, default: 'Roll all' },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Roll all' })
    await expect(button).toBeDisabled()
    await userEvent.click(button, { pointerEventsCheck: 0 })
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}

export const WithIconRight: Story = {
  args: { variant: 'primary', iconRight: IconStar, default: 'Favorite' },
}

export const Disabled: Story = {
  args: { variant: 'primary', disabled: true, default: 'Level up' },
}

export const Variants: Story = {
  render: (args) => ({
    components: { Button },
    setup: () => ({ args, IconDice, IconHeart, IconTrash }),
    template: `
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px">
        <Button v-bind="args" variant="primary">Primary</Button>
        <Button v-bind="args" variant="hero" :icon-left="IconDice">Roll</Button>
        <Button v-bind="args" variant="hero-danger">Overdose</Button>
        <Button v-bind="args" variant="hero-success">Heal</Button>
        <Button v-bind="args" variant="ghost" :icon-left="IconHeart">Heal</Button>
        <Button v-bind="args" variant="danger-ghost" :icon-left="IconTrash">Delete</Button>
      </div>
    `,
  }),
}

export const Sizes: Story = {
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: `
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px">
        <Button v-bind="args" size="sm">Small</Button>
        <Button v-bind="args" size="base">Base</Button>
        <Button v-bind="args" size="lg">Large</Button>
      </div>
    `,
  }),
  args: { variant: 'primary' },
}
