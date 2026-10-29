import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import ItemSheet from './ItemSheet.vue'
import { ITEMS } from '@/stories/fixtures'

const byId = (id: string) => ITEMS.find(i => i.id === id)!
const sword = byId('story-item-sword')

const meta = {
  title: 'Library/ItemSheet',
  component: ItemSheet,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { open: true, mode: 'add', source: null, saving: false, failed: false, 'onUpdate:open': fn(), onSave: fn() },
} satisfies Meta<typeof ItemSheet>

export default meta
type Story = StoryObj<typeof meta>

const dialog = (canvasElement: HTMLElement, name: string) =>
  within(canvasElement.ownerDocument.body).findByRole('dialog', { name }).then(d => within(d))

/**
 * Adding a weapon: nothing is sent while the entry is incomplete; a valid one goes out trimmed and
 * normalised (`D8 + 1` → `1d8+1`), empty texts dropped.
 */
export const AddWeapon: Story = {
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New item')
    await expect(sheet.getByLabelText('Kind')).toHaveValue('weapon')
    await expect(sheet.getByLabelText('Reach')).toBeVisible()
    await expect(sheet.queryByLabelText('Armor class')).toBeNull()
    await expect(sheet.queryByLabelText('Consumable')).toBeNull()

    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).not.toHaveBeenCalled()
    await expect(sheet.getByText('Give it a name.')).toBeVisible()
    await expect(sheet.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')

    await userEvent.type(sheet.getByLabelText('Name'), '  Hand axe  ')
    await userEvent.selectOptions(sheet.getByLabelText('Reach'), 'ranged')
    await userEvent.type(sheet.getByLabelText('Damage'), 'D8 + 1')
    await userEvent.type(sheet.getByLabelText('Price'), '12')
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).toHaveBeenCalledWith({
      name: 'Hand axe', descriptor: { kind: 'weapon', melee: false }, damage: '1d8+1', price: 12,
    })
  },
}

/** Armor asks for its class and not for reach. */
export const AddArmor: Story = {
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New item')
    await userEvent.selectOptions(sheet.getByLabelText('Kind'), 'armor')
    await expect(sheet.queryByLabelText('Reach')).toBeNull()
    await expect(sheet.getByLabelText('Armor class')).toBeVisible()
    await userEvent.type(sheet.getByLabelText('Name'), 'Chain shirt')
    await userEvent.selectOptions(sheet.getByLabelText('Armor class'), 'full')
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).toHaveBeenCalledWith({ name: 'Chain shirt', descriptor: { kind: 'armor', class: 'full' } })
  },
}

/** A shield has no sub-fields. */
export const AddShield: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New item')
    await userEvent.selectOptions(sheet.getByLabelText('Kind'), 'shield')
    await expect(sheet.queryByLabelText('Reach')).toBeNull()
    await expect(sheet.queryByLabelText('Armor class')).toBeNull()
    await expect(sheet.queryByLabelText('Consumable')).toBeNull()
    await userEvent.type(sheet.getByLabelText('Name'), 'Buckler')
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).toHaveBeenCalledWith({ name: 'Buckler', descriptor: { kind: 'shield' } })
  },
}

/** A tool has no sub-fields either, and cannot be consumable. */
export const AddTool: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New item')
    await userEvent.selectOptions(sheet.getByLabelText('Kind'), 'tool')
    await expect(sheet.queryByLabelText('Consumable')).toBeNull()
    await userEvent.type(sheet.getByLabelText('Name'), 'Thieves’ picks')
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).toHaveBeenCalledWith({ name: 'Thieves’ picks', descriptor: { kind: 'tool' } })
  },
}

/** Gear, occult items and “Other” can be consumable; the quantity appears with the box. */
export const AddConsumable: Story = {
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New item')
    await userEvent.selectOptions(sheet.getByLabelText('Kind'), 'gear')
    await expect(sheet.queryByLabelText('Quantity')).toBeNull()
    await userEvent.click(sheet.getByText('Consumable'))
    await expect(sheet.getByLabelText('Quantity')).toBeVisible()
    await userEvent.type(sheet.getByLabelText('Name'), 'Torch')
    await userEvent.type(sheet.getByLabelText('Quantity'), '5')
    await userEvent.type(sheet.getByLabelText('Notes'), 'Burns for an hour.')
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).toHaveBeenCalledWith({
      name: 'Torch', descriptor: { kind: 'gear', consumable: true }, quantity: 5, notes: 'Burns for an hour.',
    })
  },
}

/** Moving to a kind that cannot be consumed drops the stack. */
export const KindChangeDropsConsumable: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New item')
    await userEvent.selectOptions(sheet.getByLabelText('Kind'), 'occult')
    await userEvent.click(sheet.getByText('Consumable'))
    await userEvent.type(sheet.getByLabelText('Quantity'), '4')
    await userEvent.selectOptions(sheet.getByLabelText('Kind'), 'tool')
    await userEvent.type(sheet.getByLabelText('Name'), 'Crowbar')
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).toHaveBeenCalledWith({ name: 'Crowbar', descriptor: { kind: 'tool' } })
  },
}

/** The limits from the data model, each named under its field. */
export const OutOfRange: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New item')
    await userEvent.type(sheet.getByLabelText('Name'), 'x'.repeat(81))
    await userEvent.type(sheet.getByLabelText('Damage'), '2d7')
    await userEvent.type(sheet.getByLabelText('Price'), '1.5')
    await userEvent.type(sheet.getByLabelText('Notes'), 'n'.repeat(2001))
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).not.toHaveBeenCalled()
    await expect(sheet.getByText('At most 80 characters.')).toBeVisible()
    await expect(sheet.getByText('Damage: A dice roll such as d6, 1d8+1 or 2d6.')).toBeVisible()
    await expect(sheet.getByText('Price: A whole number from 0 to 100000.')).toBeVisible()
    await expect(sheet.getByText('At most 2000 characters.')).toBeVisible()
  },
}

export const QuantityOutOfRange: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New item')
    await userEvent.selectOptions(sheet.getByLabelText('Kind'), 'custom')
    await userEvent.click(sheet.getByText('Consumable'))
    await userEvent.type(sheet.getByLabelText('Name'), 'Chalk')
    await userEvent.type(sheet.getByLabelText('Quantity'), '100')
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).not.toHaveBeenCalled()
    await expect(sheet.getByText('Quantity: A whole number from 1 to 99.')).toBeVisible()
  },
}

/** Editing starts from the entry. */
export const Edit: Story = {
  args: { mode: 'edit', source: sword },
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'Edit item')
    await expect(sheet.getByLabelText('Name')).toHaveValue('Longsword')
    await expect(sheet.getByLabelText('Kind')).toHaveValue('weapon')
    await expect(sheet.getByLabelText('Reach')).toHaveDisplayValue('melee')
    await expect(sheet.getByLabelText('Damage')).toHaveValue('1d8')
    await expect(sheet.getByLabelText('Price')).toHaveValue('40')
    await userEvent.clear(sheet.getByLabelText('Price'))
    await userEvent.type(sheet.getByLabelText('Price'), '45')
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }))
    await expect(args.onSave).toHaveBeenCalledWith({ name: 'Longsword', descriptor: { kind: 'weapon', melee: true }, damage: '1d8', price: 45 })
  },
}

/** A consumable opens with its box ticked and its quantity. */
export const EditConsumable: Story = {
  tags: ['no-visual'],
  args: { mode: 'edit', source: byId('story-item-lantern-oil') },
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement, 'Edit item')
    await expect(sheet.getByLabelText('Kind')).toHaveValue('gear')
    await expect(sheet.getByLabelText('Consumable')).toBeChecked()
    await expect(sheet.getByLabelText('Quantity')).toHaveValue('3')
  },
}

/** A copy starts under a new name. */
export const Duplicate: Story = {
  args: { mode: 'duplicate', source: sword },
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement, 'New copy')
    await expect(sheet.getByLabelText('Name')).toHaveValue('Longsword (copy)')
    await expect(sheet.getByLabelText('Damage')).toHaveValue('1d8')
    await expect(sheet.getByRole('button', { name: 'Add' })).toBeEnabled()
  },
}

/** A copy of a long name is cut short so it still fits the 80-character limit and saves at once. */
export const DuplicateLongName: Story = {
  tags: ['no-visual'],
  args: { mode: 'duplicate', source: { ...sword, name: `Sword ${'x'.repeat(74)}` } },
  play: async ({ canvasElement, args }) => {
    const sheet = await dialog(canvasElement, 'New copy')
    const name = (sheet.getByLabelText('Name') as HTMLInputElement).value
    await expect(name).toHaveLength(80)
    await expect(name).toMatch(/ \(copy\)$/)
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(args.onSave).toHaveBeenCalledWith(expect.objectContaining({ name }))
  },
}

/** While the write is on its way the button waits. */
export const Saving: Story = {
  args: { mode: 'edit', source: sword, saving: true },
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement, 'Edit item')
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled()
  },
}

/** A refused write keeps what was typed and says so. */
export const Failed: Story = {
  args: { mode: 'edit', source: sword, failed: true },
  play: async ({ canvasElement }) => {
    const sheet = await dialog(canvasElement, 'Edit item')
    await expect(sheet.getByRole('alert')).toHaveTextContent('Couldn’t save the item. Try again.')
  },
}

export const Russian: Story = {
  globals: { locale: 'ru' },
  args: { mode: 'duplicate', source: sword },
}
