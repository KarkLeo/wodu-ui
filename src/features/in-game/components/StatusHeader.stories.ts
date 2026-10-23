import type { Meta, StoryObj } from '@storybook/vue3-vite'
import StatusHeader from './StatusHeader.vue'
import { brann, wren, oda, PARTY } from '@/stories/fixtures'
import { withStores } from '@/stories/state'

const meta = {
  title: 'Panels/StatusHeader',
  component: StatusHeader,
  globals: { viewport: { value: 'phone', isRotated: false } },
  decorators: [withStores({ characters: PARTY })],
} satisfies Meta<typeof StatusHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Healthy: Story = {
  args: { id: brann.id },
}

export const Wounded: Story = {
  args: { id: wren.id },
}

export const ReadyToLevelUp: Story = {
  args: { id: oda.id },
}

export const Compact: Story = {
  args: { id: brann.id, compact: true },
}
