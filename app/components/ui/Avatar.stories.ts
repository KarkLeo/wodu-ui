import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, userEvent, within } from 'storybook/test'
import Avatar from './Avatar.vue'

const meta = {
  title: 'UI/Avatar',
  component: Avatar,
  args: { name: 'Brann Ironhide', size: 'lg', selected: false },
  argTypes: {
    size: { control: 'inline-radio', options: ['lg', 'md', 'sm'] },
  },
  parameters: {
    docs: { description: { component: 'The initial of a name in a circle: list rows (`lg`), the cabinet header (`md`), the collapsed players rail (`sm`). `selected` is the gold look of an open entry; a link or a button gets a hover ring and, while selected or current, a glow.' } },
  },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

/** The initial is upper-cased. */
export const Default: Story = {
  args: { name: 'wren' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent?.trim()).toBe('W')
  },
}

export const Selected: Story = {
  args: { selected: true },
}

/** A blank name still shows something. */
export const NoName: Story = {
  args: { name: '   ' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent?.trim()).toBe('?')
  },
}

/** A link avatar (the cabinet header's profile link) keeps the accessible name its caller gives it. */
export const AsLink: Story = {
  args: { as: 'a', size: 'md', name: 'Anna' },
  render: (args) => ({
    components: { Avatar },
    setup: () => ({ args }),
    template: '<Avatar v-bind="args" href="#profile" aria-label="Profile" />',
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: 'Profile' })).toHaveTextContent('A')
  },
}

/** An interactive avatar that is selected glows; clicking toggles it here. */
export const InteractiveSelected: Story = {
  render: () => ({
    components: { Avatar },
    setup: () => ({ on: ref(true) }),
    template: '<Avatar as="button" type="button" name="Mirel" size="sm" aria-label="Mirel" :selected="on" @click="on = !on" />',
  }),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Mirel' })
    await expect(button).toHaveClass('is-selected')
    await userEvent.click(button)
    await expect(button).not.toHaveClass('is-selected')
  },
}

export const Sizes: Story = {
  render: () => ({
    components: { Avatar },
    template: `
      <div style="display: flex; gap: 16px; align-items: center">
        <Avatar name="Brann" size="lg" />
        <Avatar name="Brann" size="md" />
        <Avatar name="Brann" size="sm" />
        <Avatar name="Brann" size="lg" selected />
        <Avatar name="Brann" size="sm" selected interactive />
      </div>
    `,
  }),
}
