import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import StatsPanel from './StatsPanel.vue'
import { brann, wren } from '@/stories/fixtures'
import { withStores } from '@/stories/state'
import { useActiveCharacter } from '@/composables/useActiveCharacter'
import { useCharactersStore } from '@/stores/characters'
import { asTeammate, expectNoEditControls, sheetFor } from '@/stories/readonly'
import { clearPbRequests, pbRequests } from '../../../../.storybook/mocks/pb'

const meta = {
  title: 'Panels/StatsPanel',
  component: StatsPanel,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { controls: { disable: true } },
  decorators: [withStores({ characters: [brann, wren] })],
} satisfies Meta<typeof StatsPanel>

export default meta
type Story = StoryObj<typeof StatsPanel>

const forCharacter = (id: string): Story['render'] => () => ({
  components: { StatsPanel },
  setup() {
    const { char, dispatch } = useActiveCharacter(() => id)
    return { char, dispatch }
  },
  template: '<StatsPanel v-if="char" :char="char" :dispatch="dispatch" />',
})

export const Fighter: Story = {
  render: forCharacter(brann.id),
}

export const WithBuff: Story = {
  render: forCharacter(wren.id),
}

export const ModifiersOpen: Story = {
  render: forCharacter(wren.id),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: /^DEX/ }))
    await expect(await within(document.body).findByText('Cat’s grace')).toBeInTheDocument()
  },
}

/** Editing a base stat: typing stays a draft, and it writes once, also when Save or closing takes the field away. */
export const BaseStatWritesOncePerEdit: Story = {
  tags: ['no-visual'],
  render: forCharacter(brann.id),
  play: async ({ canvasElement, step }) => {
    const page = within(canvasElement.ownerDocument.body)
    const writes = () => pbRequests().filter(r => r === 'characters.update').length
    const stats = () => useCharactersStore().getById(brann.id)!.stats
    const openEdit = async () => {
      await userEvent.click(within(canvasElement).getByRole('button', { name: /^DEX/ }))
      await userEvent.click(await page.findByRole('button', { name: 'Edit base' }))
      return page.findByRole('spinbutton', { name: 'Edit DEX' })
    }
    clearPbRequests()

    await step('Enter writes once', async () => {
      const field = await openEdit()
      await userEvent.clear(field)
      await userEvent.type(field, '2')
      await expect(writes()).toBe(0)
      await userEvent.keyboard('{Enter}')
      await expect(writes()).toBe(1)
      await expect(stats().dex).toBe(2)
    })

    await step('closing the sheet keeps what was typed, on the stat being edited', async () => {
      const field = page.getByRole('spinbutton', { name: 'Edit DEX' })
      await userEvent.clear(field)
      await userEvent.type(field, '3')
      await userEvent.click(page.getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(page.queryByRole('dialog')).toBeNull())
      await expect(writes()).toBe(2)
      await expect(stats().dex).toBe(3)
    })

    await step('the step buttons write once per press', async () => {
      await openEdit()
      await userEvent.click(within(page.getByRole('group', { name: 'Edit DEX' })).getByRole('button', { name: 'Decrease' }))
      await expect(writes()).toBe(3)
      await expect(stats().dex).toBe(2)
    })
  },
}

/** A teammate's stats: the effects list stays, rolling, editing and adding or removing effects go. */
export const ReadOnly: Story = {
  render: forCharacter(wren.id),
  decorators: [sheetFor(wren.id), asTeammate([brann, wren])],
  play: async ({ canvasElement }) => {
    await expectNoEditControls(canvasElement)
    await userEvent.click(await within(canvasElement).findByRole('button', { name: /^DEX/ }))
    const dialog = await within(document.body).findByRole('dialog')
    await expect(await within(dialog).findByText('Cat’s grace')).toBeVisible()
    await expectNoEditControls(dialog)
  },
}
