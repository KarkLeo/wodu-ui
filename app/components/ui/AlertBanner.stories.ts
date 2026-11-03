import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import AlertBanner from './AlertBanner.vue'
import Button from './Button.vue'
import IconWarning from './icons/IconWarning.vue'

const meta = {
  title: 'UI/AlertBanner',
  component: AlertBanner,
  render: () => ({
    components: { AlertBanner, Button },
    template: `
      <AlertBanner>
        Could not load the library. The list may be out of date.
        <template #action><Button variant="ghost" size="sm">Try again</Button></template>
      </AlertBanner>
    `,
  }),
  decorators: [() => ({ template: '<div style="max-width: 480px"><story /></div>' })],
} satisfies Meta<typeof AlertBanner>

export default meta
type Story = StoryObj<typeof meta>

/** Announced as an alert, with its action inside. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole('alert')
    await expect(alert).toHaveTextContent('Could not load the library.')
    await expect(within(alert).getByRole('button', { name: 'Try again' })).toBeVisible()
  },
}

/** A rule being bent, with an icon; bold words take the warning colour. */
export const Warning: Story = {
  render: () => ({
    components: { AlertBanner, IconWarning },
    template: `
      <AlertBanner tone="warning">
        <template #icon><IconWarning /></template>
        <b>Two weapons equipped.</b> Only one counts for damage.
      </AlertBanner>
    `,
  }),
}

/** A standing notice with a title and an action under it, as a named region rather than an alert. */
export const AccentStacked: Story = {
  render: () => ({
    components: { AlertBanner, Button },
    template: `
      <AlertBanner tone="accent" title="This game has no master" stacked :announce="false" as="section" aria-label="This game has no master">
        Any member can take the role.
        <template #action><Button variant="primary" size="sm">Become master</Button></template>
      </AlertBanner>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('alert')).toBeNull()
    const region = canvas.getByRole('region', { name: 'This game has no master' })
    await expect(within(region).getByRole('button', { name: 'Become master' })).toBeVisible()
  },
}

/** Plain information with an eyebrow over the title and no text. */
export const NeutralEyebrow: Story = {
  render: () => ({
    components: { AlertBanner },
    template: `<AlertBanner tone="neutral" eyebrow="You are invited to" title="The Olden Road" :announce="false" />`,
  }),
}

/** No frame, inside a card that has its own. */
export const Inline: Story = {
  render: () => ({
    components: { AlertBanner, IconWarning },
    template: `
      <div style="padding: 14px 16px; border: 1px solid var(--vtt-danger); border-radius: var(--r-sm)">
        <AlertBanner inline :announce="false">
          <template #icon><IconWarning /></template>
          Next dose requires a CON roll.
        </AlertBanner>
      </div>
    `,
  }),
}

/** Danger and warning announce themselves by default; accent and neutral are standing notices. */
export const AnnounceByTone: Story = {
  render: () => ({
    components: { AlertBanner },
    template: `
      <div style="display: grid; gap: 8px">
        <AlertBanner tone="danger">Couldn’t save.</AlertBanner>
        <AlertBanner tone="warning">Multiple weapons equipped.</AlertBanner>
        <AlertBanner tone="accent" title="This game has no master" />
        <AlertBanner tone="neutral" eyebrow="You are invited to" title="The Olden Road" />
      </div>
    `,
  }),
  play: async ({ canvasElement }) => {
    const alerts = within(canvasElement).getAllByRole('alert')
    await expect(alerts.map(a => a.textContent?.trim())).toEqual(['Couldn’t save.', 'Multiple weapons equipped.'])
  },
}
