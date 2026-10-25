import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn, userEvent, within } from 'storybook/test'
import InfoPopover from './InfoPopover.vue'
import InfoPopoverClose from './InfoPopoverClose.vue'
import Button from './Button.vue'

const meta = {
  title: 'UI/InfoPopover',
  component: InfoPopover,
  args: {
    side: 'right',
    align: 'start',
    sideOffset: 8,
    title: 'Strength · +2',
    onOpen: fn(),
  },
  argTypes: {
    side: { control: 'inline-radio', options: ['top', 'right', 'bottom', 'left'] },
    align: { control: 'inline-radio', options: ['start', 'center', 'end'] },
  },
  render: (args) => ({
    components: { InfoPopover, InfoPopoverClose, Button },
    setup: () => ({ args }),
    template: `
      <div style="display: flex; justify-content: center; align-items: center; min-height: 320px">
        <InfoPopover v-bind="args">
          <template #trigger>
            <Button variant="primary">STR +2</Button>
          </template>
          <div class="pop-head">
            <span class="pop-title">Strength · +2</span>
            <span class="pop-sub">STR</span>
          </div>
          <div class="breakdown">
            <div class="breakdown-row">
              <span class="br-name">Base (2d6 = 10)</span>
              <span class="br-value">+2</span>
            </div>
            <div class="breakdown-row">
              <span class="br-name">Potion of giant's strength</span>
              <span class="br-value">+1</span>
            </div>
            <div class="breakdown-row">
              <span class="br-name">Exhausted</span>
              <span class="br-value">−1</span>
            </div>
          </div>
          <div style="margin-top: 12px">
            <InfoPopoverClose as-child>
              <Button variant="hero" style="width: 100%; justify-content: center">Roll 2d6 +2</Button>
            </InfoPopoverClose>
          </div>
        </InfoPopover>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        component:
          'Design prototype: `materials/design-vtt/design/components/stat-chip.html` (§5, stat popover). '
          + 'Renders a popover on desktop and a BottomSheet on mobile widths. '
          + '`InfoPopoverClose` closes whichever is active; the "Roll" button below is wrapped in it.',
      },
    },
  },
} satisfies Meta<typeof InfoPopover>

export default meta
type Story = StoryObj<typeof meta>

const openOnLoad: Story['play'] = async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'STR +2' }))
}

export const Default: Story = {}

export const Open: Story = {
  play: openOnLoad,
}

export const SideTop: Story = {
  args: { side: 'top', align: 'center' },
  play: openOnLoad,
}

export const SideRight: Story = {
  args: { side: 'right' },
  play: openOnLoad,
}

export const SideBottom: Story = {
  args: { side: 'bottom', align: 'center' },
  play: openOnLoad,
}

export const SideLeft: Story = {
  args: { side: 'left' },
  play: openOnLoad,
}
