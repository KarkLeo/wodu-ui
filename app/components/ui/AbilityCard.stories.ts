import type { Meta, StoryObj } from '@storybook/vue3-vite'
import AbilityCard from './AbilityCard.vue'
import Button from './Button.vue'
import IconDice from './icons/IconDice.vue'

const FIGHTER_ABILITIES = [
  { id: 'skirmish', name: 'Skirmish', description: '+1 damage, worn armor counts as one class lighter.' },
  { id: 'hewing', name: 'Slay', description: '+2 melee damage.' },
  { id: 'toughness', name: 'Tough', description: '+1 armor.' },
  { id: 'sturdy', name: 'Hardy', description: '+6 HP.' },
]

const meta = {
  title: 'UI/AbilityCard',
  component: AbilityCard,
  render: (args) => ({
    components: { AbilityCard },
    setup: () => ({ args }),
    template: `
      <AbilityCard v-bind="args">
        You can neutralize poisons, lift curses, or heal wounds by touch.
      </AbilityCard>
    `,
  }),
  args: {
    title: 'Cure',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'reference'] },
  },
  decorators: [() => ({ template: '<div style="max-width: 420px"><story /></div>' })],
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/skills-abilities.html`',
      },
    },
  },
} satisfies Meta<typeof AbilityCard>

export default meta
type Story = StoryObj<typeof meta>

export const Display: Story = {}

export const WithLevel: Story = {
  args: { title: 'Summon', level: 'Lvl 3' },
  render: (args) => ({
    components: { AbilityCard },
    setup: () => ({ args }),
    template: `
      <AbilityCard v-bind="args">
        You can summon spirits known to you (see the magic rules).
      </AbilityCard>
    `,
  }),
}

export const TitleOnly: Story = {
  render: (args) => ({
    components: { AbilityCard },
    setup: () => ({ args }),
    template: '<AbilityCard v-bind="args" />',
  }),
  args: { title: 'Hardy' },
}

export const WithActions: Story = {
  render: (args) => ({
    components: { AbilityCard, Button, IconDice },
    setup: () => ({ args, IconDice }),
    template: `
      <AbilityCard v-bind="args">
        Once per day you can turn a miss into a partial success.
        <template #actions>
          <Button variant="hero" size="sm" :icon-left="IconDice">Use</Button>
          <Button variant="ghost" size="sm">Details</Button>
        </template>
      </AbilityCard>
    `,
  }),
  args: { title: 'Lucky' },
}

export const Reference: Story = {
  render: (args) => ({
    components: { AbilityCard },
    setup: () => ({ args, abilities: FIGHTER_ABILITIES }),
    template: `
      <div>
        <AbilityCard
          v-for="a in abilities"
          :key="a.id"
          v-bind="args"
          :title="a.name"
          variant="reference"
        >
          {{ a.description }}
        </AbilityCard>
      </div>
    `,
  }),
}
