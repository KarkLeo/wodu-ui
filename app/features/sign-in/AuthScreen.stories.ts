import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, within } from 'storybook/test'
import AuthScreen from './AuthScreen.vue'
import Button from '@/components/ui/Button.vue'
import { currentLocale } from '@/locales'
import { pb, signInMock } from '../../../.storybook/mocks/pb'

const meta = {
  title: 'Screens/SignIn/AuthScreen',
  component: AuthScreen,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'World of Dungeons',
    subtitle: 'character sheet for the table',
    cardTitle: 'Card title',
  },
  render: (args) => ({
    components: { AuthScreen, Button },
    setup: () => ({ args }),
    template: `
      <AuthScreen v-bind="args">
        <p class="auth-note" style="text-align: left">Card content goes here.</p>
        <Button variant="hero" size="lg" class="auth-wide">Primary action</Button>
        <template #footer>
          <Button variant="ghost" size="lg" class="auth-wide">Secondary action</Button>
        </template>
      </AuthScreen>
    `,
  }),
} satisfies Meta<typeof AuthScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithBackLink: Story = {
  render: (args) => ({
    components: { AuthScreen },
    setup: () => ({ args }),
    template: `
      <AuthScreen v-bind="args">
        <template #back><span class="eyebrow" style="margin: 0">← back</span></template>
        <p class="auth-error">An error line inside the card.</p>
      </AuthScreen>
    `,
  }),
}

export const LocaleButtons: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group')
    await userEvent.click(within(group).getByRole('button', { name: 'RU' }))
    await expect(currentLocale.value).toBe('ru')
    await expect(within(group).getByRole('button', { name: 'RU' })).toHaveAttribute('aria-pressed', 'true')
  },
}

export const LocaleWritesProfileWhenSignedIn: Story = {
  tags: ['no-visual'],
  beforeEach() {
    signInMock()
  },
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('users'), 'update')
    const group = within(canvasElement).getByRole('group')
    await userEvent.click(within(group).getByRole('button', { name: 'UK' }))
    await expect(update).toHaveBeenCalledWith('user-mock', { language: 'uk' })
  },
}
