import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, within } from 'storybook/test'
import AuthBackLink from './AuthBackLink.vue'
import AuthScreen from './AuthScreen.vue'
import Button from '@/components/ui/Button.vue'
import FormError from '@/components/ui/FormError.vue'
import StateNote from '@/components/ui/StateNote.vue'
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
    components: { AuthScreen, Button, StateNote },
    setup: () => ({ args }),
    template: `
      <AuthScreen v-bind="args">
        <StateNote inline align="start" size="xs">Card content goes here.</StateNote>
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
    components: { AuthBackLink, AuthScreen, FormError },
    setup: () => ({ args }),
    template: `
      <AuthScreen v-bind="args">
        <template #back><AuthBackLink>← back</AuthBackLink></template>
        <FormError>An error line inside the card.</FormError>
      </AuthScreen>
    `,
  }),
}

export const LocaleButtons: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('radiogroup')
    await userEvent.click(within(group).getByRole('radio', { name: 'RU' }))
    await expect(currentLocale.value).toBe('ru')
    await expect(within(group).getByRole('radio', { name: 'RU' })).toBeChecked()
  },
}

export const LocaleWritesProfileWhenSignedIn: Story = {
  tags: ['no-visual'],
  beforeEach() {
    signInMock()
  },
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('users'), 'update')
    const group = within(canvasElement).getByRole('radiogroup')
    await userEvent.click(within(group).getByRole('radio', { name: 'UK' }))
    await expect(update).toHaveBeenCalledWith('user-mock', { language: 'uk' })
  },
}
