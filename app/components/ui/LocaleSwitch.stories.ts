import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, fn, userEvent, within } from 'storybook/test'
import LocaleSwitch from './LocaleSwitch.vue'
import type { Locale } from '@/locales'

const meta = {
  title: 'UI/LocaleSwitch',
  component: LocaleSwitch,
  args: { modelValue: 'en', variant: 'plain', 'onUpdate:modelValue': fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['plain', 'pill'] },
  },
  render: (args) => ({
    components: { LocaleSwitch },
    setup: () => {
      const locale = ref<Locale>(args.modelValue)
      return { args, locale }
    },
    template: '<LocaleSwitch v-bind="args" v-model="locale" aria-label="Language" />',
  }),
  parameters: {
    docs: { description: { component: 'EN / RU / UK on `SegmentedFilter`: a radio group with one tab stop, arrow keys move the choice. It only reports the choice through `v-model`; the caller decides whether it also goes to the profile. `plain` in the offline players panel, `pill` in the profile and on the sign-in screen.' } },
  },
} satisfies Meta<typeof LocaleSwitch>

export default meta
type Story = StoryObj<typeof meta>

/** The group is named by its caller; the current language is the checked radio. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const group = within(within(canvasElement).getByRole('radiogroup', { name: 'Language' }))
    await expect(group.getByRole('radio', { name: 'EN' })).toBeChecked()
    await userEvent.click(group.getByRole('radio', { name: 'UK' }))
    await expect(args['onUpdate:modelValue']).toHaveBeenCalledWith('uk')
    await expect(group.getByRole('radio', { name: 'UK' })).toBeChecked()
  },
}

/** Arrow keys move the choice; each move is reported. */
export const Keyboard: Story = {
  tags: ['no-visual'],
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(canvas.getByRole('radio', { name: 'EN' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith('ru')
    await expect(canvas.getByRole('radio', { name: 'RU' })).toHaveFocus()
  },
}

export const Pill: Story = {
  args: { variant: 'pill', modelValue: 'ru' },
}
