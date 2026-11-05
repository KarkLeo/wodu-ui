import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { onMounted, ref } from 'vue'
import ApplyHitPopover from './ApplyHitPopover.vue'
import type { ApplyTarget } from '@/composables/useApplyHit'
import type { RollRecord } from '@/types/dice'

const roll: RollRecord = {
  id: 'roll-2', timestamp: 0, notation: '1d6+1', dice: [{ sides: 6, value: 5 }], diceTotal: 5, modifier: 1, total: 6, label: '',
  purpose: { kind: 'damage', weaponName: 'Battle weapon', weaponTemplateId: 'battle_weapon', formula: '1d6+1' },
  characterId: 'story-brann', characterName: 'Brann Ironhide',
}

const ogre: ApplyTarget = { kind: 'monster', id: 'story-enc-ogre-1', name: 'Ogre #1', armor: 1, hp: 18, tempHp: 0 }

const meta = {
  title: 'Encounter/ApplyHitPopover',
  component: ApplyHitPopover,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: { roll, target: ogre, anchor: null, open: true, onApply: fn() },
  render: (args) => ({
    components: { ApplyHitPopover },
    setup() {
      const row = ref<HTMLElement | null>(null)
      const anchor = ref<HTMLElement | null>(null)
      const open = ref(true)
      onMounted(() => { anchor.value = row.value })
      return { args, row, anchor, open }
    },
    // Room on the left for the popup on a wide screen; on a phone the row just fits.
    template: `<div style="padding: 160px 24px 0 clamp(24px, 100vw - 340px, 360px)">
      <div ref="row" style="width: min(316px, 100%); padding: 10px 12px; border-radius: 12px; background: var(--vtt-elevated-a72); box-shadow: inset 0 0 0 1px var(--vtt-accent-a45); color: var(--vtt-text-primary)">Brann Ironhide · 6</div>
      <ApplyHitPopover v-bind="args" v-model:open="open" :anchor="anchor" />
    </div>`,
  }),
} satisfies Meta<typeof ApplyHitPopover>

export default meta
type Story = StoryObj<typeof meta>

const dialogIn = (el: HTMLElement, name: string) => within(el.ownerDocument.body).findByRole('dialog', { name })

export const Monster: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(await dialogIn(canvasElement, 'Ogre #1'))
    // The target is the heading; the source, its weapon and the total stay the first row under it.
    await expect(dialog.getByRole('heading', { name: 'Ogre #1' })).toBeVisible()
    const source = dialog.getByText('Brann Ironhide').closest('.apply-hit-source')
    await expect(source).toHaveTextContent('Brann IronhideMartial weapon6')
    await expect(dialog.getByRole('heading', { name: 'Ogre #1' }).compareDocumentPosition(source!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expect(dialog.getByRole('spinbutton', { name: 'Damage' })).toHaveValue(5)
    await expect(dialog.getByText('HP 18 → 13')).toBeVisible()
  },
}

export const CharacterWithTemp: Story = {
  args: { target: { kind: 'character', id: 'story-brann', name: 'Brann Ironhide', armor: 2, hp: 8, tempHp: 2 } },
  play: async ({ canvasElement }) => {
    const dialog = within(await dialogIn(canvasElement, 'Brann Ironhide'))
    await expect(dialog.getByText('−2 of 2')).toBeVisible()
    await expect(dialog.getByText('HP 8 → 6')).toBeVisible()
  },
}

/** Apply reports the amount and closes; Cancel only closes. */
export const AppliesAndCloses: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement, args }) => {
    const dialog = within(await dialogIn(canvasElement, 'Ogre #1'))
    await userEvent.click(dialog.getByRole('button', { name: 'Raise damage' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Apply' }))
    await expect(args.onApply).toHaveBeenCalledWith(6)
    await expect(within(canvasElement.ownerDocument.body).queryByRole('dialog')).toBeNull()
  },
}

/** On a phone the same content opens as a bottom sheet titled with the target. */
export const Mobile: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const dialog = within(await dialogIn(canvasElement, 'Ogre #1'))
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible()
    // The sheet's title already names the target.
    await expect(dialog.getAllByRole('heading', { name: 'Ogre #1' })).toHaveLength(1)
    await expect(dialog.getByText('HP 18 → 13')).toBeVisible()
  },
}
