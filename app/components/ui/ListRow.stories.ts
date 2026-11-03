import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { expect, userEvent, within } from 'storybook/test'
import Avatar from './Avatar.vue'
import Button from './Button.vue'
import ListRow from './ListRow.vue'
import Pill from './Pill.vue'

const meta = {
  title: 'UI/ListRow',
  component: ListRow,
  args: {
    as: 'div',
    variant: 'plain',
    title: 'Brann Ironhide',
    subtitle: 'Fighter · level 2',
    selected: false,
    disabled: false,
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['plain', 'card', 'dashed'] },
    as: { control: 'inline-radio', options: ['div', 'button', 'a', 'li'] },
    subtitleTone: { control: 'inline-radio', options: ['neutral', 'accent'] },
  },
  render: (args) => ({
    components: { ListRow, Avatar },
    setup: () => ({ args }),
    template: `
      <ListRow v-bind="args">
        <template #leading><Avatar :name="args.title ?? ''" :selected="args.selected" /></template>
      </ListRow>
    `,
  }),
  decorators: [() => ({ template: '<div style="max-width: 380px"><story /></div>' })],
  parameters: {
    docs: { description: { component: 'A row in a list: `#leading` (an avatar or an icon), title, sub line, optional note, `#trailing` (a pill, a status, an action) and `#below` (actions or a bar under the text, out to the right end); extra content under the sub line goes in the default slot. Rendered as a `button`, a link (`a` or RouterLink) or a plain element. `plain` is the borderless row of the players panel and the table sheets; `card` the framed card of the cabinet lists, with the trailing piece on the title line; `dashed` the card of a draft.' } },
  },
} satisfies Meta<typeof ListRow>

export default meta
type Story = StoryObj<typeof meta>

/** A static row: an element of its own, no button. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull()
    await expect(within(canvasElement).getByText('Brann Ironhide')).toBeVisible()
  },
}

// Counts clicks in the sub line, so a play function can see whether the row acted.
const counting = (args: Record<string, unknown>) => ({
  components: { ListRow, Avatar },
  setup: () => ({ args, clicks: ref(0) }),
  template: `
    <ListRow v-bind="args" :subtitle="'Clicked ' + clicks" @click="clicks++">
      <template #leading><Avatar name="Brann" /></template>
    </ListRow>
  `,
})

/** A row that acts is a button named by its text. */
export const AsButton: Story = {
  args: { as: 'button' },
  render: counting,
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: /Brann Ironhide/ })
    await expect(row).toHaveAttribute('type', 'button')
    await expect(row).not.toHaveAttribute('aria-pressed')
    await userEvent.click(row)
    await expect(row).toHaveTextContent('Clicked 1')
  },
}

/** The open entry: a gold tint behind the row and a gold avatar; a row that toggles it is pressed. */
export const Selected: Story = {
  args: { as: 'button', selected: true, pressed: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /Brann Ironhide/ })).toHaveAttribute('aria-pressed', 'true')
  },
}

/** A disabled button row does not act. */
export const Disabled: Story = {
  args: { as: 'button', disabled: true },
  render: counting,
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('button', { name: /Brann Ironhide/ })
    await expect(row).toBeDisabled()
    await userEvent.click(row)
    await expect(row).toHaveTextContent('Clicked 0')
  },
}

/** A long name and sub line are cut with an ellipsis, the trailing status stays. */
export const WithTrailing: Story = {
  args: { title: 'Brann Ironhide of the Long Winter Road', subtitle: 'you · Fighter of the northern marches · level 2' },
  render: (args) => ({
    components: { ListRow, Avatar },
    setup: () => ({ args }),
    template: `
      <ListRow v-bind="args">
        <template #leading><Avatar :name="args.title ?? ''" /></template>
        <template #trailing><span style="width: 7px; height: 7px; border-radius: 50%; background: var(--vtt-success)" /></template>
      </ListRow>
    `,
  }),
}

/** Pills under the name, actions below the text out to the right end (a member of a game). */
export const WithPillsAndActions: Story = {
  render: () => ({
    components: { ListRow, Avatar, Pill, Button },
    setup: () => ({ removed: ref(false) }),
    template: `
      <ul style="margin: 0; padding: 0; list-style: none">
        <ListRow as="li" title="Kostya">
          <template #leading><Avatar name="Kostya" /></template>
          <span style="display: inline-flex; gap: 6px"><Pill tone="accent">Master</Pill><Pill>You</Pill></span>
          <template #below>
            <span style="display: flex; gap: 6px; margin-top: 6px">
              <Button variant="danger-ghost" size="sm" @click="removed = true">{{ removed ? 'Removed' : 'Remove' }}</Button>
            </span>
          </template>
        </ListRow>
      </ul>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('listitem')).toHaveTextContent('Kostya')
    await userEvent.click(canvas.getByRole('button', { name: 'Remove' }))
    await expect(canvas.getByRole('button', { name: 'Removed' })).toBeVisible()
  },
}

/** A cabinet card: the pill on the title line, a sub line and a note. */
export const Card: Story = {
  args: {
    as: 'button',
    variant: 'card',
    title: 'Shadows over Crookhollow',
    subtitle: '3 players · master: Seva',
    note: 'Your characters: Oda',
  },
  render: (args) => ({
    components: { ListRow, Pill },
    setup: () => ({ args }),
    template: `
      <ListRow v-bind="args">
        <template #trailing><Pill>Player</Pill></template>
      </ListRow>
    `,
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: /Shadows over Crookhollow/ })).toHaveTextContent('Player')
  },
}

/** A long pill takes at most about half the title line; both are cut. */
export const CardLongPill: Story = {
  args: { as: 'button', variant: 'card', title: 'Brann Ironhide of the Long Winter Road', subtitle: 'Fighter · level 2' },
  render: (args) => ({
    components: { ListRow, Pill },
    setup: () => ({ args }),
    template: `
      <ListRow v-bind="args">
        <template #trailing><Pill>In game: Shadows over Crookhollow and beyond</Pill></template>
      </ListRow>
    `,
  }),
}

/** A draft: dashed and dimmed, the sub line is the call to action. */
export const Dashed: Story = {
  args: { as: 'button', variant: 'dashed', title: 'Unnamed', subtitle: 'Resume →', subtitleTone: 'accent' },
  render: (args) => ({
    components: { ListRow },
    setup: () => ({ args }),
    template: '<ListRow v-bind="args" />',
  }),
}

/** A disabled link row keeps the link role but has no href and no click, so it neither navigates nor takes the focus. */
export const DisabledLink: Story = {
  tags: ['no-visual'],
  args: { as: 'a', variant: 'card', title: 'Olden’s Tower', subtitle: '2 players', disabled: true },
  render: (args) => ({
    components: { ListRow },
    setup: () => ({ args, clicks: ref(0) }),
    template: '<ListRow v-bind="args" href="#olden" :note="\'Clicked \' + clicks" @click="clicks++" />',
  }),
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole('link', { name: /Olden’s Tower/ })
    await expect(row).toHaveAttribute('aria-disabled', 'true')
    await expect(row).not.toHaveAttribute('href')
    const before = window.location.hash
    await userEvent.click(row)
    await expect(window.location.hash).toBe(before)
    await expect(row).toHaveTextContent('Clicked 0')
    await userEvent.tab()
    await expect(row).not.toHaveFocus()
  },
}

/** A link row navigates; here it is a plain anchor. */
export const AsLink: Story = {
  args: { as: 'a', variant: 'card', title: 'Olden’s Tower', subtitle: '2 players' },
  render: (args) => ({
    components: { ListRow },
    setup: () => ({ args }),
    template: '<ListRow v-bind="args" href="#olden" />',
  }),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: /Olden’s Tower/ })).toHaveAttribute('href', '#olden')
  },
}

export const List: Story = {
  render: () => ({
    components: { ListRow, Avatar },
    setup: () => ({ open: ref('wren') }),
    template: `
      <ul style="display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none">
        <li v-for="c in [{ id: 'brann', name: 'Brann Ironhide' }, { id: 'wren', name: 'Wren Ashfoot' }, { id: 'mirel', name: 'Mirel Vane' }]" :key="c.id">
          <ListRow as="button" :title="c.name" subtitle="Fighter · level 1" :selected="open === c.id" :pressed="open === c.id" @click="open = c.id">
            <template #leading><Avatar :name="c.name" :selected="open === c.id" /></template>
          </ListRow>
        </li>
      </ul>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Mirel Vane/ }))
    await expect(canvas.getByRole('button', { name: /Mirel Vane/ })).toHaveClass('is-selected')
    await expect(canvas.getByRole('button', { name: /Wren Ashfoot/ })).not.toHaveClass('is-selected')
    await expect(canvas.getByRole('button', { name: /Mirel Vane/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByRole('button', { name: /Wren Ashfoot/ })).toHaveAttribute('aria-pressed', 'false')
  },
}
