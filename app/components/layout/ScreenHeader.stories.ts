import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import Button from '@/components/ui/Button.vue'
import ScreenHeader from './ScreenHeader.vue'

const meta = {
  title: 'Layout/ScreenHeader',
  component: ScreenHeader,
  args: { title: 'Item library', subtitle: 'The Crookhollow Expedition' },
  render: (args) => ({
    components: { ScreenHeader, Button },
    setup: () => ({ args }),
    template: `
      <ScreenHeader v-bind="args">
        <template #actions><Button variant="ghost" size="sm">Back to the table</Button></template>
      </ScreenHeader>
    `,
  }),
  decorators: [() => ({ template: '<div style="max-width: 640px"><story /></div>' })],
} satisfies Meta<typeof ScreenHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 1, name: 'Item library' })).toBeVisible()
  },
}

export const TitleOnly: Story = {
  args: { subtitle: undefined },
}

/** A long subtitle is cut short, the action keeps its place. */
export const LongSubtitle: Story = {
  args: { subtitle: 'The Very Long and Winding Expedition into the Caverns beneath Crookhollow Hill' },
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
}

/** A small caption over a list, as on the cabinet pages. */
export const Eyebrow: Story = {
  args: { title: 'Games', subtitle: undefined, variant: 'eyebrow' },
  render: (args) => ({
    components: { ScreenHeader },
    setup: () => ({ args }),
    template: '<ScreenHeader v-bind="args" />',
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 1, name: 'Games' })).toBeVisible()
  },
}

/** The large centred title of the sign-in screens; a long subtitle wraps instead of being cut. */
export const Hero: Story = {
  args: {
    title: 'World of Dungeons',
    subtitle: 'A character sheet for the old-school game, kept at the table and shared with your party',
    variant: 'hero',
  },
  render: (args) => ({
    components: { ScreenHeader },
    setup: () => ({ args }),
    template: '<ScreenHeader v-bind="args" />',
  }),
  decorators: [() => ({ template: '<div style="max-width: 380px"><story /></div>' })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'World of Dungeons' })).toBeVisible()
    await expect(canvas.getByText(/A character sheet/)).toBeVisible()
  },
}
