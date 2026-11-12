import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import MediaPanelShell from './MediaPanelShell.vue'

const card: Decorator = (story) => ({
  components: { story },
  template: '<div style="width: min(440px, 100vw - 32px); height: 360px"><story /></div>',
})

const meta = {
  title: 'Features/Stage/MediaPanelShell',
  component: MediaPanelShell,
  parameters: { layout: 'centered' },
  decorators: [card],
  args: { kind: 'sounds', status: 'ready', count: 2, onAdd: fn() },
  render: (args) => ({
    components: { MediaPanelShell },
    setup: () => ({ args }),
    template: `<MediaPanelShell v-bind="args">
      <p>The entries</p>
      <template #footer><p data-testid="footer">The footer</p></template>
    </MediaPanelShell>`,
  }),
} satisfies Meta<typeof MediaPanelShell>

export default meta
type Story = StoryObj<typeof meta>

/** The title, the count with the limit, the add button, the entries and the footer under them. */
export const Ready: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Sounds' })).toBeVisible()
    await expect(canvas.getByText('2 / 15')).toBeVisible()
    await expect(canvas.getByText('2 / 15')).toHaveAttribute('aria-live', 'polite')
    await expect(canvas.getByText('The entries')).toBeVisible()
    await expect(canvas.getByTestId('footer')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Upload sound' }))
    await expect(args.onAdd).toHaveBeenCalledTimes(1)
  },
}

export const Loading: Story = {
  tags: ['no-visual'],
  args: { status: 'loading', count: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading sounds…')
    await expect(canvas.queryByText('The entries')).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Upload sound' })).toBeNull()
  },
}

export const Failed: Story = {
  tags: ['no-visual'],
  args: { status: 'failed', count: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Couldn’t load the sounds.')
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeVisible()
  },
}

/** Nothing in the list: the hint stands in for the entries and the footer. */
export const Empty: Story = {
  args: { count: 0 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/No sounds yet/)).toBeVisible()
    await expect(canvas.queryByText('The entries')).toBeNull()
    await expect(canvas.queryByTestId('footer')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Upload sound' })).toBeEnabled()
  },
}

/** At the limit the add button is out and a note says why. */
export const AtTheLimit: Story = {
  args: { count: 15 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('15 / 15')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Upload sound' })).toBeDisabled()
    await expect(canvas.getByText(/reached the limit of 15 sounds/)).toBeVisible()
  },
}
