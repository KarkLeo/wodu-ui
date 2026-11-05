import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import DiceRollRow from './DiceRollRow.vue'
import { STORY_NOW } from '@/stories/fixtures'
import type { RollRecord } from '@/types/dice'
import type { EncounterHit } from '@/types/encounter'

const base: RollRecord = {
  id: 'roll-a', timestamp: STORY_NOW, notation: '2d6', dice: [{ sides: 6, value: 4 }, { sides: 6, value: 5 }], diceTotal: 9, modifier: 1, total: 10,
  label: '', purpose: { kind: 'free', notation: '2d6' }, characterId: 'story-brann', characterName: 'Brann Ironhide',
}
const damage: RollRecord = {
  ...base, id: 'roll-d', notation: '1d6', dice: [{ sides: 6, value: 5 }], diceTotal: 5, modifier: 1, total: 6,
  purpose: { kind: 'damage', weaponName: 'Battle weapon', weaponTemplateId: 'battle_weapon', formula: '1d6+1' },
}
const hits: EncounterHit[] = [
  { id: 'hit-1', rollId: 'roll-d', target: { kind: 'monster', id: 'g2', name: 'Goblin #2' }, sourceName: 'Brann Ironhide', rollTotal: 6, armor: 0, amount: 6, at: 1 },
  { id: 'hit-2', rollId: 'roll-d', target: { kind: 'monster', id: 'o1', name: 'Ogre #1' }, sourceName: 'Brann Ironhide', rollTotal: 6, armor: 1, amount: 5, at: 2 },
]

const meta = {
  title: 'Layout/DiceRollRow',
  component: DiceRollRow,
  args: { roll: base, author: 'Brann Ironhide' },
  render: (args) => ({
    components: { DiceRollRow },
    setup: () => ({ args }),
    template: '<div style="width: 316px"><DiceRollRow v-bind="args" /></div>',
  }),
} satisfies Meta<typeof DiceRollRow>

export default meta
type Story = StoryObj<typeof meta>

const row = (el: HTMLElement) => el.querySelector<HTMLElement>('.dice-row')!

/** A free roll: kind, author and time, the expression with its dice, and the total. Not a button. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(row(canvasElement)).toHaveTextContent('2d6+1')
    await expect(row(canvasElement).querySelector('.dice-row-result')).toHaveTextContent('10')
    await expect(row(canvasElement).querySelector('.dice-row-meta-author')).toHaveTextContent('Brann Ironhide')
    await expect(row(canvasElement)).not.toHaveAttribute('role')
    await expect(row(canvasElement)).not.toHaveAttribute('tabindex')
  },
}

export const StatCrit: Story = {
  args: { roll: { ...base, id: 'roll-c', total: 12, purpose: { kind: 'stat', statKey: 'str', statBonus: 0 } } },
  play: async ({ canvasElement }) => {
    await expect(row(canvasElement)).toHaveClass('is-crit')
  },
}

export const StatFail: Story = {
  args: { roll: { ...base, id: 'roll-f', total: 5, purpose: { kind: 'stat', statKey: 'dex', statBonus: 0 } } },
  play: async ({ canvasElement }) => {
    await expect(row(canvasElement)).toHaveClass('is-fail')
  },
}

export const Advantage: Story = {
  args: { roll: { ...base, id: 'roll-v', rollMode: 'advantage', discardedTotal: 4 } },
  play: async ({ canvasElement }) => {
    await expect(row(canvasElement)).toHaveClass('is-advantage')
    await expect(row(canvasElement)).toHaveTextContent('4')
  },
}

/** A damage roll names the weapon, in the viewer's language. */
export const DamageWithWeapon: Story = {
  args: { roll: damage },
  play: async ({ canvasElement }) => {
    await expect(row(canvasElement)).toHaveClass('is-damage')
    await expect(row(canvasElement).querySelector('.dice-row-meta-weapon')).toHaveTextContent('Martial weapon')
  },
}

/** A monster's attack has no weapon line, and its number is styled apart. */
export const MonsterAttack: Story = {
  args: {
    author: 'Goblin #2',
    roll: { ...damage, id: 'roll-m', purpose: { kind: 'damage', weaponName: '', formula: '1d6' }, characterName: 'Goblin #2', monster: { id: 'g2', n: 2 } },
  },
  play: async ({ canvasElement }) => {
    await expect(row(canvasElement).querySelector('.dice-row-meta-secondary')).toBeNull()
    await expect(row(canvasElement).querySelector('.numbered-name-n')).toHaveTextContent('#2')
  },
}

/** Applicable: a button naming the target, opened by a press, Enter or Space, and only on the row itself. */
export const Applicable: Story = {
  args: { roll: damage, applyTo: 'Goblin #1', onOpen: fn() },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button')
    await expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(button.querySelector('.dice-row-go')).toHaveTextContent('→ Goblin #1')
    await userEvent.click(button)
    await expect(args.onOpen).toHaveBeenCalledTimes(1)
    await expect(args.onOpen).toHaveBeenCalledWith(button)
    button.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    await expect(args.onOpen).toHaveBeenCalledTimes(3)
  },
}

/** The row's popup is open: the button says so. */
export const ApplicableExpanded: Story = {
  args: { roll: damage, applyTo: 'Goblin #1', expanded: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  },
}

/** Not applicable: a press does nothing. */
export const PressDoesNothing: Story = {
  tags: ['no-visual'],
  args: { roll: damage, onOpen: fn() },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(row(canvasElement))
    await expect(args.onOpen).not.toHaveBeenCalled()
  },
}

/** Every hit the roll made sits under it. */
export const WithHits: Story = {
  args: { roll: damage, hits },
  play: async ({ canvasElement }) => {
    const lines = [...canvasElement.querySelectorAll('.dice-row-hit')].map(l => l.textContent)
    await expect(lines).toEqual(['→ Goblin #2 −6', '→ Ogre #1 −5'])
  },
}

const LONG_WEAPON = 'Two-handed executioner’s great axe of the northern pass'

/** The meta line is short of room: the weapon gives way first and the author stays whole, not "MA… · BR…". */
export const WeaponShrinksBeforeAuthor: Story = {
  args: { roll: { ...damage, id: 'roll-w', purpose: { kind: 'damage', weaponName: LONG_WEAPON, formula: '1d6+1' } } },
  render: (args) => ({
    components: { DiceRollRow },
    setup: () => ({ args }),
    template: '<div style="width: 460px"><DiceRollRow v-bind="args" /></div>',
  }),
  play: async ({ canvasElement }) => {
    const weapon = row(canvasElement).querySelector<HTMLElement>('.dice-row-meta-weapon')!
    const author = row(canvasElement).querySelector<HTMLElement>('.numbered-name-text')!
    await expect(weapon.scrollWidth).toBeGreaterThan(weapon.clientWidth)
    await expect(author.scrollWidth).toBeLessThanOrEqual(author.clientWidth)
  },
}

/** The log's own width: the weapon is out of the way before the author is cut at all. */
export const InTheLogsWidth: Story = {
  args: { roll: damage },
  play: async ({ canvasElement }) => {
    const weapon = row(canvasElement).querySelector<HTMLElement>('.dice-row-meta-secondary')!
    const author = row(canvasElement).querySelector<HTMLElement>('.numbered-name-text')!
    await expect(weapon.getBoundingClientRect().width).toBeLessThan(1)
    await expect(author.getBoundingClientRect().width).toBeGreaterThan(40)
  },
}

// Spelled out in code: a literal `#` followed by digits reads as a hex colour to tokens.test.ts.
const NUMBER = 148

/** Both long: the name is cut short at last, the number behind it never. */
export const LongAuthorKeepsNumber: Story = {
  args: {
    author: `${'Gargantuan '.repeat(7)}Beast #${NUMBER}`,
    roll: { ...damage, id: 'roll-l', purpose: { kind: 'damage', weaponName: LONG_WEAPON, formula: '1d6+1' } },
  },
  play: async ({ canvasElement }) => {
    const number = row(canvasElement).querySelector<HTMLElement>('.numbered-name-n')!
    await expect(number).toHaveTextContent(`#${NUMBER}`)
    await expect(number).toBeVisible()
    const text = row(canvasElement).querySelector<HTMLElement>('.numbered-name-text')!
    await expect(text.scrollWidth).toBeGreaterThan(text.clientWidth)
    await expect(number.getBoundingClientRect().right).toBeLessThanOrEqual(row(canvasElement).getBoundingClientRect().right)
  },
}

const bodyOf = (el: HTMLElement) => row(el).querySelector<HTMLElement>('.dice-row-body')!
const tooltipIn = (el: HTMLElement) => within(el.ownerDocument.body)
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

function tap(el: HTMLElement) {
  for (const type of ['pointerenter', 'pointerdown', 'pointerup', 'pointerleave']) {
    el.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', bubbles: type !== 'pointerenter' && type !== 'pointerleave' }))
  }
  el.click()
}

/** The weapon is out of the way at the log's width, so the pointer brings it back, with the whole row's text. */
export const TooltipNamesTheWeapon: Story = {
  tags: ['no-visual'],
  args: { roll: damage },
  play: async ({ canvasElement }) => {
    await userEvent.hover(bodyOf(canvasElement))
    const tip = await tooltipIn(canvasElement).findByRole('tooltip')
    await expect(tip).toHaveTextContent('Martial weapon')
    await expect(tip).toHaveTextContent('Brann Ironhide')
    await expect(tip).toHaveTextContent('1d6+1')
    await userEvent.unhover(bodyOf(canvasElement))
  },
}

/** A name cut short shows in full, in one tooltip and with no second one from the name itself. */
export const TooltipShowsTheWholeName: Story = {
  tags: ['no-visual'],
  args: { author: `${'Gargantuan '.repeat(7)}Beast #${NUMBER}`, roll: damage },
  play: async ({ canvasElement, args }) => {
    await userEvent.hover(row(canvasElement).querySelector<HTMLElement>('.numbered-name-text')!)
    await expect(await tooltipIn(canvasElement).findByRole('tooltip')).toHaveTextContent(args.author)
    await expect(canvasElement.ownerDocument.querySelectorAll('.ui-tooltip')).toHaveLength(1)
    await userEvent.unhover(bodyOf(canvasElement))
  },
}

/** Everything fits: a tooltip would only repeat the row. */
export const NoTooltipWhenAllFits: Story = {
  tags: ['no-visual'],
  render: (args) => ({
    components: { DiceRollRow },
    setup: () => ({ args }),
    template: '<div style="width: 560px"><DiceRollRow v-bind="args" /></div>',
  }),
  play: async ({ canvasElement }) => {
    await userEvent.hover(bodyOf(canvasElement))
    await pause(450)
    await expect(tooltipIn(canvasElement).queryByRole('tooltip')).toBeNull()
    await userEvent.unhover(bodyOf(canvasElement))
  },
}

/** A phone has no hover: a tap on the row shows it. */
export const TapShowsTooltip: Story = {
  tags: ['no-visual'],
  args: { roll: damage },
  play: async ({ canvasElement }) => {
    tap(bodyOf(canvasElement))
    await expect(await tooltipIn(canvasElement).findByRole('tooltip')).toHaveTextContent('Martial weapon')
    tap(bodyOf(canvasElement))
    await waitFor(() => expect(tooltipIn(canvasElement).queryByRole('tooltip')).toBeNull())
  },
}

/** On an applicable row a tap opens the popup, which names the weapon; no tooltip over it. */
export const TapOnApplicableOpensOnlyThePopup: Story = {
  tags: ['no-visual'],
  args: { roll: damage, applyTo: 'Goblin #1', onOpen: fn() },
  play: async ({ canvasElement, args }) => {
    // Vue drops a click on an outer listener attached no earlier than the click, and the stories' clock stands still.
    const { now } = Date
    Date.now = () => STORY_NOW + 1000
    try {
      tap(bodyOf(canvasElement))
    } finally {
      Date.now = now
    }
    await expect(args.onOpen).toHaveBeenCalledOnce()
    await pause(450)
    await expect(tooltipIn(canvasElement).queryByRole('tooltip')).toBeNull()
  },
}

/** A target's name cut short in a line under the row has its own tooltip. */
export const HitNameTooltip: Story = {
  tags: ['no-visual'],
  args: {
    roll: damage,
    hits: [{ ...hits[0]!, target: { kind: 'monster', id: 'g2', name: `${'Gargantuan '.repeat(7)}Beast #${NUMBER}` } }],
  },
  play: async ({ canvasElement }) => {
    await userEvent.hover(row(canvasElement).querySelector<HTMLElement>('.dice-row-hit .numbered-name-text')!)
    await expect(await tooltipIn(canvasElement).findByRole('tooltip')).toHaveTextContent(`Beast #${NUMBER}`)
    await userEvent.unhover(row(canvasElement).querySelector<HTMLElement>('.dice-row-hit .numbered-name-text')!)
  },
}
