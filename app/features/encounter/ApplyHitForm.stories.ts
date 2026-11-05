import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import ApplyHitForm from './ApplyHitForm.vue'
import type { ApplyTarget } from '@/composables/useApplyHit'
import type { RollRecord } from '@/types/dice'

const roll: RollRecord = {
  id: 'roll-2', timestamp: 0, notation: '1d6+1', dice: [{ sides: 6, value: 5 }], diceTotal: 5, modifier: 1, total: 6, label: '',
  purpose: { kind: 'damage', weaponName: 'Battle weapon', weaponTemplateId: 'battle_weapon', formula: '1d6+1' },
  characterId: 'story-brann', characterName: 'Brann Ironhide',
}

const ogre: ApplyTarget = { kind: 'monster', id: 'story-enc-ogre-1', name: 'Ogre #1', armor: 1, hp: 18, tempHp: 0 }

const meta = {
  title: 'Encounter/ApplyHitForm',
  component: ApplyHitForm,
  args: { roll, target: ogre, onApply: fn(), onCancel: fn() },
  render: (args) => ({
    components: { ApplyHitForm },
    setup: () => ({ args }),
    template: '<div style="width: 280px"><ApplyHitForm v-bind="args" /></div>',
  }),
} satisfies Meta<typeof ApplyHitForm>

export default meta
type Story = StoryObj<typeof meta>

/** Roll 6, armor 1: 5 damage, 18 → 13. */
export const Monster: Story = {
  play: async ({ canvasElement }) => {
    const form = within(canvasElement)
    await expect(form.getByText('Brann Ironhide')).toBeVisible()
    await expect(form.getByText('Martial weapon')).toBeVisible()
    await expect(form.getByText('−1')).toBeVisible()
    await expect(form.getByRole('spinbutton', { name: 'Damage' })).toHaveValue(5)
    await expect(form.getByText('HP 18 → 13')).toBeVisible()
    await expect(form.queryByText('Temp HP')).toBeNull()
    await expect(form.queryByText(/defeated/)).toBeNull()
  },
}

/** Temp HP take the first points. */
export const CharacterWithTemp: Story = {
  args: { target: { kind: 'character', id: 'story-brann', name: 'Brann Ironhide', armor: 2, hp: 8, tempHp: 2 } },
  play: async ({ canvasElement }) => {
    const form = within(canvasElement)
    await expect(form.getByText('Temp HP')).toBeVisible()
    await expect(form.getByText('−2 of 2')).toBeVisible()
    await expect(form.getByText('HP 8 → 6')).toBeVisible()
  },
}

/** A hit that empties a monster says so; the same hit on a character does not. */
export const Lethal: Story = {
  args: { target: { ...ogre, id: 'story-enc-goblin-1', name: 'Goblin #1', armor: 0, hp: 3 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/HP 3 → 0 · It will be defeated\./)).toBeVisible()
  },
}

export const CharacterAtZero: Story = {
  args: { target: { kind: 'character', id: 'story-brann', name: 'Brann Ironhide', armor: 2, hp: 3, tempHp: 0 } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('HP 3 → 0')).toBeVisible()
  },
}

export const Emits: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    const form = within(canvasElement)
    await userEvent.click(form.getByRole('button', { name: 'Raise damage' }))
    await userEvent.dblClick(form.getByRole('button', { name: 'Apply' }))
    await expect(args.onApply).toHaveBeenCalledOnce()
    await expect(args.onApply).toHaveBeenCalledWith(6)
    await userEvent.click(form.getByRole('button', { name: 'Cancel' }))
    await expect(args.onCancel).toHaveBeenCalledOnce()
  },
}
