import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import WizardShell from './WizardShell.vue'
import WizardStepper from './WizardStepper.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import IconStarBold from '@/components/ui/icons/IconStarBold.vue'
import { DESKTOP_VIEWPORT } from '@/stories/state'

const PHONE = { viewport: { value: 'phone', isRotated: false } }

const paragraph = 'The road out of Crookhollow climbs through the barrows. Pick what you carry, and what you leave behind.'

const meta = {
  title: 'Layout/WizardShell',
  component: WizardShell,
  globals: PHONE,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Basics',
    hint: 'Roll your attributes',
    closeLabel: 'Close',
    backLabel: 'Back',
    nextLabel: 'Next',
    nextDisabled: false,
    onClose: fn(),
    onBack: fn(),
    onNext: fn(),
  },
  argTypes: { nextIcon: { control: false } },
  // The desktop wizard takes its height from the area it sits in, as it does in GameLayout's main column.
  decorators: [() => ({ template: '<div style="height: 100vh"><story /></div>' })],
  render: (args) => ({
    components: { WizardShell, WizardStepper, SectionHeader },
    setup: () => ({ args, paragraph, sections: 3 }),
    template: `
      <WizardShell v-bind="args">
        <template #stepper><WizardStepper :count="3" :current="1" navigable /></template>
        <section v-for="n in sections" :key="n" style="display: flex; flex-direction: column; gap: 12px">
          <SectionHeader :title="'Section ' + n" hint="a short note" />
          <p style="margin: 0; color: var(--vtt-text-secondary)">{{ paragraph }}</p>
        </section>
      </WizardShell>
    `,
  }),
} satisfies Meta<typeof WizardShell>

export default meta
type Story = StoryObj<typeof meta>

// On phones the shell teleports itself to <body>, outside the story canvas.
const screen = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/** Full screen on a phone; close, back and next report to the caller. */
export const Phone: Story = {
  play: async ({ args, canvasElement }) => {
    const view = screen(canvasElement)
    const shell = canvasElement.ownerDocument.body.querySelector('.wz-shell') as HTMLElement
    await expect(shell.parentElement).toBe(canvasElement.ownerDocument.body)
    await expect(getComputedStyle(shell).position).toBe('fixed')
    await userEvent.click(view.getByRole('button', { name: 'Close' }))
    await userEvent.click(view.getByRole('button', { name: '← Back' }))
    await userEvent.click(view.getByRole('button', { name: 'Next →' }))
    await expect(args.onClose).toHaveBeenCalledOnce()
    await expect(args.onBack).toHaveBeenCalledOnce()
    await expect(args.onNext).toHaveBeenCalledOnce()
  },
}

/** Centred card on a desktop, rendered in place. */
export const Desktop: Story = {
  globals: DESKTOP_VIEWPORT,
  play: async ({ canvasElement }) => {
    const shell = canvasElement.querySelector('.wz-shell') as HTMLElement
    await expect(shell).not.toBeNull()
    const box = shell.getBoundingClientRect()
    await expect(box.width).toBe(720)
    await expect(Math.round(box.left + box.width / 2)).toBe(Math.round(window.innerWidth / 2))
  },
}

/** Between GameLayout's side panels the card stays clear of them: narrower, then off-centre. */
export const BesidePanels: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [() => ({ template: '<div style="--gl-inset-left: 400px; --gl-inset-right: 200px; height: 100vh"><story /></div>' })],
  play: async ({ canvasElement }) => {
    const box = (canvasElement.querySelector('.wz-shell') as HTMLElement).getBoundingClientRect()
    await expect(box.left).toBeGreaterThanOrEqual(400)
    await expect(box.right).toBeLessThanOrEqual(window.innerWidth - 200)
    await expect(box.width).toBe(window.innerWidth - 400 - 200)
  },
}

/** A step longer than the screen scrolls between the fixed top bar and footer. */
export const LongContent: Story = {
  render: (args) => ({
    components: { WizardShell, WizardStepper, SectionHeader },
    setup: () => ({ args, paragraph, sections: 12 }),
    template: `
      <WizardShell v-bind="args">
        <template #stepper><WizardStepper :count="3" :current="2" navigable /></template>
        <section v-for="n in sections" :key="n" style="display: flex; flex-direction: column; gap: 12px">
          <SectionHeader :title="'Section ' + n" hint="a short note" />
          <p style="margin: 0; color: var(--vtt-text-secondary)">{{ paragraph }}</p>
        </section>
      </WizardShell>
    `,
  }),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument
    const content = doc.body.querySelector('.wz-content') as HTMLElement
    await expect(content.scrollHeight).toBeGreaterThan(content.clientHeight)
    const next = screen(canvasElement).getByRole('button', { name: 'Next →' })
    await expect(next.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
  },
}

/** A step that is not done yet: next is disabled and does nothing. */
export const NextDisabled: Story = {
  args: { hint: 'Needs a name', nextDisabled: true },
  play: async ({ args, canvasElement }) => {
    const next = screen(canvasElement).getByRole('button', { name: 'Next →' })
    await expect(next).toBeDisabled()
    await userEvent.click(next, { pointerEventsCheck: 0 })
    await expect(args.onNext).not.toHaveBeenCalled()
  },
}

/** The final step: an icon in place of the forward arrow, and a subtitle under the title. */
export const FinalStep: Story = {
  args: { title: 'Summary', subtitle: 'Level up · 2 → 3', hint: 'All set', nextLabel: 'Confirm', nextIcon: IconStarBold },
  play: async ({ canvasElement }) => {
    const view = screen(canvasElement)
    await expect(view.getByRole('button', { name: 'Confirm' })).toBeEnabled()
    await expect(view.getByText('Level up · 2 → 3')).toBeVisible()
  },
}
