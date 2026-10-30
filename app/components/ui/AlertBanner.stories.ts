import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import AlertBanner from './AlertBanner.vue'
import Button from './Button.vue'

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
