import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import IconButton from './IconButton.vue'
import IconCheck from './icons/IconCheck.vue'
import IconChevronLeft from './icons/IconChevronLeft.vue'
import IconClose from './icons/IconClose.vue'
import IconEdit from './icons/IconEdit.vue'
import IconMenu from './icons/IconMenu.vue'
import IconTrash from './icons/IconTrash.vue'

const meta = {
  title: 'UI/IconButton',
  component: IconButton,
  args: {
    label: 'Close',
    size: 'md',
    variant: 'round',
    tone: 'neutral',
    disabled: false,
    onClick: fn(),
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['lg', 'md', 'sm'] },
    variant: { control: 'inline-radio', options: ['round', 'square'] },
    tone: { control: 'inline-radio', options: ['neutral', 'accent', 'danger'] },
    type: { control: 'inline-radio', options: ['button', 'submit', 'reset'] },
  },
  render: (args) => ({
    components: { IconButton, IconClose },
    setup: () => ({ args }),
    template: '<IconButton v-bind="args"><IconClose :size="12" /></IconButton>',
  }),
  parameters: {
    docs: { description: { component: 'Icon-only button. `label` is its accessible name; the icon is passed in the default slot at its own size.' } },
  },
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

/** The round 28px button: sheet close, panel collapse. Named by its label, with no pressed or expanded state. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Close' })
    await expect(button).toHaveAttribute('type', 'button')
    await expect(button).not.toHaveAttribute('aria-pressed')
    await expect(button).not.toHaveAttribute('aria-expanded')
    await userEvent.click(button)
    await expect(args.onClick).toHaveBeenCalledOnce()
  },
}

/** `lg` for a rail toggle or a wizard close, `md` for chrome and sheets, `sm` for an action inside a popover row. */
export const Sizes: Story = {
  render: () => ({
    components: { IconButton, IconChevronLeft, IconClose },
    template: `
      <div style="display: flex; align-items: center; gap: 12px">
        <IconButton size="lg" label="Expand panel"><IconChevronLeft /></IconButton>
        <IconButton size="md" label="Close"><IconClose :size="12" /></IconButton>
        <IconButton size="sm" variant="square" label="Remove"><IconClose :size="10" /></IconButton>
      </div>
    `,
  }),
}

/** Square buttons are the row actions of inventory and magic lists; `danger` reddens on hover for a remove. */
export const RowActions: Story = {
  render: () => ({
    components: { IconButton, IconCheck, IconEdit, IconTrash },
    template: `
      <div style="display: flex; gap: 4px">
        <IconButton variant="square" label="Edit"><IconEdit /></IconButton>
        <IconButton variant="square" tone="accent" label="Unequip"><IconCheck :size="14" /></IconButton>
        <IconButton variant="square" tone="danger" label="Remove"><IconTrash /></IconButton>
      </div>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Edit', 'Unequip', 'Remove'])
  },
}

/** A toggle passes `pressed` through as `aria-pressed` and takes the accent look while on. */
export const Pressed: Story = {
  render: () => ({
    components: { IconButton, IconMenu },
    setup: () => ({ on: ref(false) }),
    template: '<IconButton label="Pin panel" :pressed="on" @click="on = !on"><IconMenu :size="14" /></IconButton>',
  }),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Pin panel' })
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  },
}

/** Disabled: dimmed, and a click does nothing. */
export const Disabled: Story = {
  args: { label: 'Clear history', disabled: true },
  render: (args) => ({
    components: { IconButton, IconTrash },
    setup: () => ({ args }),
    template: '<IconButton v-bind="args"><IconTrash /></IconButton>',
  }),
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Clear history' })
    await expect(button).toBeDisabled()
    await userEvent.click(button, { pointerEventsCheck: 0 })
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}

/** As a Reka trigger child: the trigger's state and handlers land on the button, which keeps its label. */
export const AsMenuTrigger: Story = {
  render: () => ({
    components: { IconButton, IconMenu, DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem },
    template: `
      <DropdownMenuRoot :modal="false">
        <DropdownMenuTrigger as-child>
          <IconButton label="Game menu"><IconMenu :size="14" /></IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="start" :side-offset="6" style="padding: 6px; border: 1px solid var(--vtt-border-gold); border-radius: var(--r-md); background: var(--vtt-bg-elevated)">
            <DropdownMenuItem style="padding: 8px 10px; color: var(--vtt-text-primary)">Invite</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    `,
  }),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Game menu' })
    await expect(button).toHaveAttribute('aria-haspopup', 'menu')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'))
    await expect(within(document.body).getByRole('menuitem', { name: 'Invite' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'false'))
  },
}
