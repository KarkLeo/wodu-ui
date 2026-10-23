import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import StepSkill from './StepSkill.vue'
import StepAbility from './StepAbility.vue'
import StepStat from './StepStat.vue'
import StepHitDice from './StepHitDice.vue'
import StepSummary from './StepSummary.vue'
import { oda, wren } from '@/stories/fixtures'
import { ABILITY_IDS, SKILL_IDS } from '@/types/character'
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

export const Stat: StoryObj<typeof StepStat> = {
  render: (args) => ({ components: { StepStat }, setup: () => ({ args }), template: '<StepStat v-bind="args" />' }),
  args: { char: wren, currentStats: wren.stats, selected: null },
}

export const StatSelected: StoryObj<typeof StepStat> = {
  ...Stat,
  args: { char: wren, currentStats: wren.stats, selected: 'cha' },
}

export const HitDiceBeforeRoll: StoryObj<typeof StepHitDice> = {
  render: (args) => ({ components: { StepHitDice }, setup: () => ({ args }), template: '<StepHitDice v-bind="args" />' }),
  args: { numDice: oda.hitDice + 1, targetLevel: oda.level + 1, characterId: oda.id, characterName: oda.name, previousMaxHp: oda.maxHp },
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
