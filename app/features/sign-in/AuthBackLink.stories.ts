import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import AuthBackLink from './AuthBackLink.vue'

const meta = {
  title: 'Screens/SignIn/AuthBackLink',
  component: AuthBackLink,
  render: (args) => ({
    components: { AuthBackLink },
    setup: () => ({ args }),
    template: '<AuthBackLink v-bind="args">← Home</AuthBackLink>',
  }),
} satisfies Meta<typeof AuthBackLink>

export default meta
type Story = StoryObj<typeof meta>

export const AsButton: Story = {
  args: { onClick: fn() } as Story['args'],
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: '← Home' }))
    await expect((args as unknown as { onClick: unknown }).onClick).toHaveBeenCalledOnce()
  },
}

export const AsLink: Story = {
  args: { to: { name: 'landing' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: '← Home' })).toHaveAttribute('href', '/')
  },
}
