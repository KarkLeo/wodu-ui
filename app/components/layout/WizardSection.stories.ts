import type { Meta, StoryObj } from '@storybook/vue3-vite'
import WizardSection from './WizardSection.vue'
import SectionHeader from '@/components/ui/SectionHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const meta = {
  title: 'Layout/WizardSection',
  component: WizardSection,
  args: { gap: 'md' },
  argTypes: { gap: { control: 'inline-radio', options: ['md', 'lg'] } },
  render: (args) => ({
    components: { WizardSection, SectionHeader, EmptyState },
    setup: () => ({ args }),
    template: `
      <WizardSection v-bind="args" style="max-width: 420px">
        <SectionHeader title="Gear" hint="What you carry from the start." />
        <EmptyState hint="Nothing bought yet." />
        <EmptyState hint="Nothing found yet." />
      </WizardSection>
    `,
  }),
  parameters: {
    docs: { description: { component: 'One block of a wizard step: a `<section>` that spaces its head and content.' } },
  },
} satisfies Meta<typeof WizardSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LargeGap: Story = {
  args: { gap: 'lg' },
}
