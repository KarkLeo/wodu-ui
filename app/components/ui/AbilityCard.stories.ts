import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { fn } from 'storybook/test'
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
    onToggle: fn(),
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['display', 'reference', 'pick-multi', 'pick-single'] },
    variant: { control: 'inline-radio', options: ['default', 'reference'] },
    state: { control: 'inline-radio', options: ['default', 'selected', 'locked'] },
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

export const Selected: Story = {
  args: { mode: 'pick-multi', state: 'selected' },
}

export const Locked: Story = {
  render: (args) => ({
    components: { AbilityCard },
    setup: () => ({ args }),
    template: `
      <AbilityCard v-bind="args">
        You can attempt to dominate any spirit, demon, and so on.
      </AbilityCard>
    `,
  }),
  args: { title: 'Command', mode: 'pick-multi', state: 'locked' },
}

export const PickMulti: Story = {
  render: (args) => ({
    components: { AbilityCard },
    setup() {
      const picked = ref<string[]>(['hewing'])
      function toggle(id: string) {
        picked.value = picked.value.includes(id)
          ? picked.value.filter((p) => p !== id)
          : [...picked.value, id]
        args.onToggle?.()
      }
      return { args, abilities: FIGHTER_ABILITIES, picked, toggle }
    },
    template: `
      <div role="group" aria-label="Fighter abilities" style="display: grid; gap: 8px">
        <AbilityCard
          v-for="a in abilities"
          :key="a.id"
          v-bind="args"
          :title="a.name"
          mode="pick-multi"
          :state="picked.includes(a.id) ? 'selected' : 'default'"
          @toggle="toggle(a.id)"
        >
          {{ a.description }}
        </AbilityCard>
      </div>
    `,
  }),
}

export const PickSingle: Story = {
  render: (args) => ({
    components: { AbilityCard },
    setup() {
      const picked = ref('skirmish')
      function pick(id: string) {
        picked.value = id
        args.onToggle?.()
      }
      return { args, abilities: FIGHTER_ABILITIES, picked, pick }
    },
    template: `
      <div role="radiogroup" aria-label="New ability" style="display: grid; gap: 8px">
        <AbilityCard
          v-for="a in abilities"
          :key="a.id"
          v-bind="args"
          :title="a.name"
          mode="pick-single"
          :state="a.id === 'sturdy' ? 'locked' : picked === a.id ? 'selected' : 'default'"
          @toggle="pick(a.id)"
        >
          {{ a.description }}
        </AbilityCard>
      </div>
    `,
  }),
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
