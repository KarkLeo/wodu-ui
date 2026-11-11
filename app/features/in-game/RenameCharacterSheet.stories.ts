import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import RenameCharacterSheet from './RenameCharacterSheet.vue'
import { brann } from '@/stories/fixtures'
import { withOfflineMode, withStores } from '@/stories/state'
import { useCharactersStore } from '@/stores/characters'
import { clearPbRequests, pbRequests } from '../../../.storybook/mocks/pb'

const TRUE_NAME = 'Ashen Wolf'

const meta = {
  title: 'Screens/InGame/RenameCharacterSheet',
  component: RenameCharacterSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { characterId: brann.id, open: true },
  decorators: [withStores({ characters: [{ ...brann, trueName: TRUE_NAME }] })],
} satisfies Meta<typeof RenameCharacterSheet>

export default meta
type Story = StoryObj<typeof meta>

const dialog = async (canvasElement: HTMLElement) =>
  within(await within(canvasElement.ownerDocument.body).findByRole('dialog', { name: `Rename ${brann.name}` }))
const characterWrites = () => pbRequests().filter(r => r === 'characters.update').length
const brannNow = () => useCharactersStore().getById(brann.id)!

/** Both names, the true one masked until the eye shows it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue(brann.name)
    const trueName = sheet.getByRole('textbox', { name: /True name/ })
    await expect(trueName).toHaveValue(TRUE_NAME)
    await expect(getComputedStyle(trueName).getPropertyValue('-webkit-text-security')).toBe('disc')
    await expect(trueName).toHaveAccessibleDescription('Only you and the master see it.')
  },
}

/** Offline there is no master to mention. */
export const Offline: Story = {
  decorators: [withOfflineMode],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    await expect(sheet.getByRole('textbox', { name: /True name/ })).not.toHaveAccessibleDescription()
  },
}

/** Only what changed is written: a new name is one write, the true name untouched. */
export const RenamesOnce: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    clearPbRequests()
    const name = sheet.getByRole('textbox', { name: 'Name' })
    await userEvent.clear(name)
    await userEvent.type(name, '  Brann the Bold ')
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(brannNow().name).toBe('Brann the Bold'))
    await expect(brannNow().trueName).toBe(TRUE_NAME)
    await waitFor(() => expect(characterWrites()).toBe(1))
  },
}

/** Clearing the true name removes it; changing both names is two writes. */
export const ChangesBoth: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    clearPbRequests()
    await userEvent.type(sheet.getByRole('textbox', { name: 'Name' }), ' Jr')
    await userEvent.clear(sheet.getByRole('textbox', { name: /True name/ }))
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(brannNow().trueName).toBe(''))
    await expect(brannNow().name).toBe(`${brann.name} Jr`)
    await waitFor(() => expect(characterWrites()).toBe(2))
  },
}

/** A name cannot be empty; nothing is written. */
export const EmptyName: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    clearPbRequests()
    await userEvent.clear(sheet.getByRole('textbox', { name: 'Name' }))
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled()
    await userEvent.keyboard('{Enter}')
    await expect(characterWrites()).toBe(0)
    await expect(brannNow().name).toBe(brann.name)
  },
}

/** Saving with nothing changed writes nothing. */
export const NothingChanged: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement)
    clearPbRequests()
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }))
    await expect(characterWrites()).toBe(0)
  },
}
