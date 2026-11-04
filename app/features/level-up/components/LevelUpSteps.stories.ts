import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import StepSkill from './StepSkill.vue'
import StepAbility from './StepAbility.vue'
import StepStat from './StepStat.vue'
import StepHitDice from './StepHitDice.vue'
import StepSummary from './StepSummary.vue'
import { oda, wren } from '@/stories/fixtures'
import { withStores } from '@/stories/state'
import { MAX_STAT_BONUS } from '@/data/xpTable'
import { ABILITY_IDS, SKILL_IDS } from '@/types/character'
import { t } from '@/locales'
import { tamsin } from '../LevelUpView.stories'

const padded: Decorator = (story) => ({
  components: { story },
  template: '<div style="padding: 20px 16px; color: var(--vtt-text-primary)"><story /></div>',
})

const meta = {
  title: 'Screens/LevelUp/Steps',
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  decorators: [padded],
} satisfies Meta

export default meta

/** One tab stop on the group, on the pick once there is one; the arrow keys move and pick, and wrap around. */
async function expectRadioKeyboard(canvasElement: HTMLElement) {
  const view = within(canvasElement)
  const radios = view.getAllByRole('radio')
  const first = radios[0]
  const second = radios[1]
  const last = radios[radios.length - 1]

  await userEvent.tab()
  await expect(first).toHaveFocus()
  await expect(view.queryAllByRole('radio', { checked: true })).toHaveLength(0)
  await userEvent.keyboard('{ArrowDown}')
  await expect(second).toHaveFocus()
  await expect(second).toBeChecked()
  await userEvent.keyboard('{ArrowUp}{ArrowUp}')
  await expect(last).toHaveFocus()
  await expect(last).toBeChecked()
  await expect(view.getAllByRole('radio', { checked: true })).toHaveLength(1)
  await userEvent.tab()
  await expect(radios.includes(document.activeElement as HTMLElement)).toBe(false)
  await userEvent.tab({ shift: true })
  await expect(last).toHaveFocus()
}

export const Skill: StoryObj<typeof StepSkill> = {
  render: (args) => ({ components: { StepSkill }, setup: () => ({ args }), template: '<StepSkill v-bind="args" />' }),
  args: { char: oda, currentSkillIds: oda.skillIds, selected: null },
}

export const SkillSelected: StoryObj<typeof StepSkill> = {
  ...Skill,
  args: { char: oda, currentSkillIds: oda.skillIds, selected: 'lore' },
}

export const SkillNoneLeft: StoryObj<typeof StepSkill> = {
  ...Skill,
  args: { char: oda, currentSkillIds: SKILL_IDS, selected: null },
}

export const SkillKeyboard: StoryObj<typeof StepSkill> = {
  ...Skill,
  tags: ['no-visual'],
  play: async ({ canvasElement }) => expectRadioKeyboard(canvasElement),
}

export const Ability: StoryObj<typeof StepAbility> = {
  render: (args) => ({ components: { StepAbility }, setup: () => ({ args }), template: '<StepAbility v-bind="args" />' }),
  args: { char: wren, currentAbilityIds: wren.abilityIds, selected: null },
}

export const AbilitySelected: StoryObj<typeof StepAbility> = {
  ...Ability,
  args: { char: wren, currentAbilityIds: wren.abilityIds, selected: 'sturdy' },
}

export const AbilityNoneLeft: StoryObj<typeof StepAbility> = {
  ...Ability,
  args: { char: wren, currentAbilityIds: ABILITY_IDS, selected: null },
}

export const AbilityKeyboard: StoryObj<typeof StepAbility> = {
  ...Ability,
  tags: ['no-visual'],
  play: async ({ canvasElement }) => expectRadioKeyboard(canvasElement),
}

export const Stat: StoryObj<typeof StepStat> = {
  render: (args) => ({ components: { StepStat }, setup: () => ({ args }), template: '<StepStat v-bind="args" />' }),
  args: { char: wren, currentStats: wren.stats, selected: null },
}

export const StatSelected: StoryObj<typeof StepStat> = {
  ...Stat,
  args: { char: wren, currentStats: wren.stats, selected: 'cha' },
}

/** The arrow keys skip a stat at its maximum, which cannot be picked. */
export const StatKeyboard: StoryObj<typeof StepStat> = {
  ...Stat,
  tags: ['no-visual'],
  args: { char: wren, currentStats: { ...wren.stats, str: MAX_STAT_BONUS, con: MAX_STAT_BONUS }, selected: null },
  play: async ({ canvasElement }) => {
    const view = within(canvasElement)
    const radios = view.getAllByRole('radio')
    const [first, second] = radios.filter(r => !r.hasAttribute('disabled'))
    await expect(view.getByRole('radio', { name: /^STR/ })).toBeDisabled()
    await expect(view.getByRole('radio', { name: /^CON/ })).toBeDisabled()
    await userEvent.tab()
    await expect(first).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(second).toHaveFocus()
    await expect(second).toBeChecked()
    await userEvent.keyboard('{ArrowLeft}')
    await expect(first).toHaveFocus()
    await expect(first).toBeChecked()
    await expect(view.getAllByRole('radio', { checked: true })).toHaveLength(1)
  },
}

export const HitDiceBeforeRoll: StoryObj<typeof StepHitDice> = {
  render: (args) => ({ components: { StepHitDice }, setup: () => ({ args }), template: '<StepHitDice v-bind="args" />' }),
  args: { numDice: oda.hitDice + 1, targetLevel: oda.level + 1, characterId: oda.id, characterName: oda.name, previousMaxHp: oda.maxHp },
}

/** Rolled: the dice kept and dropped, and the new maximum. The dice engine draws from Math.random, so a fixed sequence gives the same dice on every run. */
export const HitDiceAfterRoll: StoryObj<typeof StepHitDice> = {
  ...HitDiceBeforeRoll,
  decorators: [withStores({ characters: [oda] })],
  beforeEach() {
    const real = Math.random
    const draws = [0.9, 0.1, 0.5]
    let next = 0
    Math.random = () => draws[next++ % draws.length]
    return () => {
      Math.random = real
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: t('levelUp.steps.hitDice.roll') }))
    await expect(await canvas.findByText(t('levelUp.steps.hitDice.resultLabel'))).toBeVisible()
    await expect(canvasElement.querySelectorAll('.lu-die.is-kept')).toHaveLength(oda.level + 1)
    await expect(canvas.getByRole('button', { name: t('levelUp.steps.hitDice.reroll') })).toBeEnabled()
  },
}

const renderSummary: StoryObj<typeof StepSummary>['render'] = (args) => ({
  components: { StepSummary },
  setup: () => ({ args }),
  template: '<StepSummary v-bind="args" />',
})

export const SummaryHitDice: StoryObj<typeof StepSummary> = {
  render: renderSummary,
  args: {
    char: oda,
    targetLevel: 2,
    pending: {
      maxHp: 10,
      currentHp: 10,
      hitDice: 2,
      hpHistory: [...(oda.hpHistory ?? []), { level: 2, roll: 3, source: 'dice' }],
    },
  },
}

export const SummaryStatAndHitDice: StoryObj<typeof StepSummary> = {
  render: renderSummary,
  args: {
    char: wren,
    targetLevel: 4,
    pending: {
      stats: { ...wren.stats, cha: wren.stats.cha + 1 },
      maxHp: wren.maxHp + 2,
      currentHp: wren.currentHp + 2,
      hitDice: wren.hitDice + 1,
      hpHistory: [...(wren.hpHistory ?? []), { level: 4, roll: 2, source: 'dice' }],
    },
  },
}

export const SummarySkillAndAbility: StoryObj<typeof StepSummary> = {
  render: renderSummary,
  args: {
    char: tamsin,
    targetLevel: 3,
    pending: {
      skillIds: [...tamsin.skillIds, 'lore'],
      abilityIds: [...tamsin.abilityIds, 'summoning'],
      magic: { spirits: [], rituals: [], cantrips: [] },
    },
  },
}
