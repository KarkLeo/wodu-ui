import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'
import CabinetLayout from './CabinetLayout.vue'
import { atRoute, DESKTOP_VIEWPORT } from '@/stories/state'
import { signInMock } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Screens/Cabinet/CabinetLayout',
  component: CabinetLayout,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  loaders: [atRoute('/games')],
  beforeEach() {
    signInMock()
  },
  render: () => ({
    components: { CabinetLayout },
    template: `<CabinetLayout>
      <div data-testid="page" style="height: 320px; border: 1px dashed var(--vtt-border-strong); border-radius: var(--r-md)" />
    </CabinetLayout>`,
  }),
} satisfies Meta<typeof CabinetLayout>

export default meta
type Story = StoryObj<typeof meta>

/** The header above, the page in the main column; no players panel and no dice drawer. */
export const Phone: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('banner')).toBeVisible()
    await expect(within(canvas.getByRole('main')).getByTestId('page')).toBeVisible()
  },
}

/** Desktop: the page centred, no wider than the old home column. */
export const Desktop: Story = {
  globals: DESKTOP_VIEWPORT,
  play: async ({ canvasElement }) => {
    const main = within(canvasElement).getByRole('main').getBoundingClientRect()
    await expect(main.width).toBeLessThanOrEqual(640)
    await expect(Math.abs(main.left - (document.documentElement.clientWidth - main.right))).toBeLessThan(2)
  },
}
