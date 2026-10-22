import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { fn } from 'storybook/test'
import SkillChip from './SkillChip.vue'
import IconLock from './icons/IconLock.vue'
import IconPlus from './icons/IconPlus.vue'

const meta = {
  title: 'UI/SkillChip',
  component: SkillChip,
  args: {
    label: 'Athletics',
    onToggle: fn(),
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['display', 'pick-multi', 'pick-single', 'add'] },
    state: { control: 'inline-radio', options: ['default', 'auto', 'selected', 'locked'] },
    icon: { control: false },
  },
  parameters: {
    docs: {
      description: {
        component: 'Design prototype: `materials/design-vtt/design/components/skills-abilities.html`',
      },
    },
  },
} satisfies Meta<typeof SkillChip>

export default meta
type Story = StoryObj<typeof meta>

export const Display: Story = {}

export const Auto: Story = {
  render: (args) => ({
    components: { SkillChip },
    setup: () => ({ args }),
    template: '<SkillChip v-bind="args" title="Granted by class" />',
  }),
  args: { label: 'Stealth', state: 'auto', icon: IconLock },
}

export const Selected: Story = {
  args: { label: 'Lore', mode: 'pick-multi', state: 'selected' },
}

export const Locked: Story = {
  args: { label: 'Leadership', mode: 'pick-multi', state: 'locked' },
}

export const Add: Story = {
  args: { label: 'Add skill', mode: 'add', icon: IconPlus },
}

export const States: Story = {
  render: (args) => ({
    components: { SkillChip },
    setup: () => ({ args, IconLock }),
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 8px">
        <SkillChip v-bind="args" label="Athletics" state="default" />
        <SkillChip v-bind="args" label="Stealth" state="auto" :icon="IconLock" />
        <SkillChip v-bind="args" label="Lore" state="selected" />
        <SkillChip v-bind="args" label="Leadership" state="locked" />
      </div>
    `,
  }),
  args: { mode: 'pick-multi' },
}

export const PickMulti: Story = {
  render: (args) => ({
    components: { SkillChip },
    setup() {
      const skills = ['Athletics', 'Awareness', 'Deception', 'Decipher', 'Heal', 'Lore', 'Stealth', 'Survival']
      const picked = ref<string[]>(['Awareness', 'Stealth'])
      function toggle(skill: string) {
        picked.value = picked.value.includes(skill)
          ? picked.value.filter((s) => s !== skill)
          : [...picked.value, skill]
        args.onToggle?.()
      }
      return { args, skills, picked, toggle }
    },
    template: `
      <div role="group" aria-label="Pick two skills" style="display: flex; flex-wrap: wrap; gap: 8px">
        <SkillChip
          v-for="skill in skills"
          :key="skill"
          v-bind="args"
          :label="skill"
          mode="pick-multi"
          :state="picked.includes(skill) ? 'selected' : picked.length >= 2 ? 'locked' : 'default'"
          @toggle="toggle(skill)"
        />
      </div>
    `,
  }),
}

export const PickSingle: Story = {
  render: (args) => ({
    components: { SkillChip },
    setup() {
      const skills = ['Heal', 'Lore', 'Survival']
      const picked = ref('Lore')
      function pick(skill: string) {
        picked.value = skill
        args.onToggle?.()
      }
      return { args, skills, picked, pick }
    },
    template: `
      <div role="radiogroup" aria-label="Level-up skill" style="display: flex; flex-wrap: wrap; gap: 8px">
        <SkillChip
          v-for="skill in skills"
          :key="skill"
          v-bind="args"
          :label="skill"
          mode="pick-single"
          :state="picked === skill ? 'selected' : 'default'"
          @toggle="pick(skill)"
        />
      </div>
    `,
  }),
}

export const SkillsRow: Story = {
  render: (args) => ({
    components: { SkillChip },
    setup: () => ({ args, IconLock }),
    template: `
      <div style="display: flex; flex-wrap: wrap; gap: 8px">
        <SkillChip v-bind="args" label="Stealth" state="auto" :icon="IconLock" title="Granted by class" />
        <SkillChip v-bind="args" label="Deception" state="auto" :icon="IconLock" title="Granted by class" />
        <SkillChip v-bind="args" label="Awareness" />
        <SkillChip v-bind="args" label="Athletics" />
      </div>
    `,
  }),
}
