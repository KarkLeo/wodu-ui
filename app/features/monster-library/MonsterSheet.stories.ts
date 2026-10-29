import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import MonsterSheet from './MonsterSheet.vue'
import { MONSTERS } from '@/stories/fixtures'

const goblin = MONSTERS[1]!

const meta = {
  title: 'Library/MonsterSheet',
  component: MonsterSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { open: true, mode: 'add', source: null, saving: false, failed: false, 'onUpdate:open': fn(), onSave: fn() },
} satisfies Meta<typeof MonsterSheet>

export default meta
type Story = StoryObj<typeof meta>

const dialog = (canvasElement: HTMLElement, name: string) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name }).then(d => within(d))

/**
 * Adding: nothing is sent while the entry is incomplete, and each field says what it needs. A valid
 * entry goes out trimmed and normalised (`D6 + 1` → `1d6+1`), empty texts dropped.
 */
export const Add: Story = {
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New monster')
    await expect(sheet.getByLabelText('Armor')).toHaveValue('0')
    await expect(sheet.queryByText('Give it a name.')).toBeNull()

    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).not.toHaveBeenCalled()
    await expect(sheet.getByText('Give it a name.')).toBeVisible()
    await expect(sheet.getByText('HP: A whole number from 1 to 999.')).toBeVisible()
    await expect(sheet.getByText('Damage: A dice roll such as d6, 1d8+1 or 2d6.')).toBeVisible()
    await expect(sheet.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')

    await userEvent.type(sheet.getByLabelText('Name'), '  Bandit  ')
    await expect(sheet.queryByText('Give it a name.')).toBeNull()
    await userEvent.type(sheet.getByLabelText('HP'), '5')
    await userEvent.type(sheet.getByLabelText('Damage'), 'D6 + 1')
    await userEvent.type(sheet.getByLabelText('Special'), 'Ambushes from the ditch.')
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).toHaveBeenCalledWith({ name: 'Bandit', hp: 5, armor: 0, damage: '1d6+1', special: 'Ambushes from the ditch.' })
  },
}

/** The limits from the data model, each named under its field. */
export const OutOfRange: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New monster')
    await userEvent.type(sheet.getByLabelText('Name'), 'x'.repeat(81))
    await userEvent.type(sheet.getByLabelText('HP'), '0')
    await userEvent.clear(sheet.getByLabelText('Armor'))
    await userEvent.type(sheet.getByLabelText('Armor'), '1.5')
    await userEvent.type(sheet.getByLabelText('Damage'), '2d7')
    await userEvent.type(sheet.getByLabelText('Notes'), 'n'.repeat(2001))
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).not.toHaveBeenCalled()
    await expect(sheet.getByText('At most 80 characters.')).toBeVisible()
    await expect(sheet.getByText('HP: A whole number from 1 to 999.')).toBeVisible()
    await expect(sheet.getByText('Armor: A whole number from 0 to 9.')).toBeVisible()
    await expect(sheet.getByText('Damage: A dice roll such as d6, 1d8+1 or 2d6.')).toBeVisible()
    await expect(sheet.getByText('At most 2000 characters.')).toBeVisible()
  },
}

/** Editing starts from the entry and saves it under the same button label as other forms. */
export const Edit: Story = {
  args: { mode: 'edit', source: goblin },
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'Edit monster')
    await expect(sheet.getByLabelText('Name')).toHaveValue('Goblin')
    await expect(sheet.getByLabelText('HP')).toHaveValue('3')
    await expect(sheet.getByLabelText('Damage')).toHaveValue('1d6')
    await expect(sheet.getByLabelText('Notes')).toHaveValue('Three of them hide in the mill loft.')
    await userEvent.clear(sheet.getByLabelText('HP'))
    await userEvent.type(sheet.getByLabelText('HP'), '4')
    await userEvent.clear(sheet.getByLabelText('Notes'))
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }))
    await expect(args.onSave).toHaveBeenCalledWith({
      name: 'Goblin', hp: 4, armor: 0, damage: '1d6', special: 'Cowardly: flees once half the pack is down.',
    })
  },
}

/** A variant starts as a copy under a new name. */
export const Duplicate: Story = {
  args: { mode: 'duplicate', source: goblin },
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement, 'New variant')
    await expect(sheet.getByLabelText('Name')).toHaveValue('Goblin (copy)')
    await expect(sheet.getByLabelText('Special')).toHaveValue('Cowardly: flees once half the pack is down.')
    await expect(sheet.getByRole('button', { name: 'Add' })).toBeEnabled()
  },
}

/** A variant of a long name is cut short so it still fits the 80-character limit and saves at once. */
export const DuplicateLongName: Story = {
  tags: ['no-visual'],
  args: { mode: 'duplicate', source: { ...goblin, name: `Goblin ${'x'.repeat(73)}` } },
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New variant')
    const name = (sheet.getByLabelText('Name') as HTMLInputElement).value
    await expect(name).toHaveLength(80)
    await expect(name).toMatch(/ \(copy\)$/)
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).toHaveBeenCalledWith(expect.objectContaining({ name }))
  },
}

/** While the write is on its way the button waits. */
export const Saving: Story = {
  args: { mode: 'edit', source: goblin, saving: true },
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement, 'Edit monster')
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled()
  },
}

/** A refused write keeps what was typed and says so. */
export const Failed: Story = {
  args: { mode: 'edit', source: goblin, failed: true },
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement, 'Edit monster')
    await expect(sheet.getByRole('alert')).toHaveTextContent('Couldn’t save the monster. Try again.')
  },
}

export const Russian: Story = {
  globals: { locale: 'ru' },
  args: { mode: 'duplicate', source: goblin },
}
