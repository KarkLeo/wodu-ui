import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ref, watch } from 'vue'
import FileField from './FileField.vue'

const THUMB = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="%23888"/></svg>'

const meta = {
  title: 'UI/FileField',
  component: FileField,
  args: {
    modelValue: null,
    label: 'Scene image',
    accept: ['image/png', 'image/jpeg', 'image/webp'],
    'onUpdate:modelValue': fn(),
    onClear: fn(),
  },
  render: (args) => ({
    components: { FileField },
    setup() {
      const value = ref(args.modelValue)
      watch(() => args.modelValue, (v) => { value.value = v })
      return { args, value }
    },
    template: `<FileField v-bind="args" v-model="value" @update:model-value="args['onUpdate:modelValue']" @clear="args.onClear" />`,
  }),
  decorators: [() => ({ template: '<div style="max-width: 360px"><story /></div>' })],
} satisfies Meta<typeof FileField>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { hint: 'PNG, JPEG or WebP' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /choose a file/i })).toBeInTheDocument()
    await expect(canvas.getByLabelText('Scene image', { selector: 'input' })).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp')
    await expect(canvas.getByText('PNG, JPEG or WebP')).toBeVisible()
  },
}

export const Picked: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const file = new File(['x'.repeat(2048)], 'tavern.png', { type: 'image/png' })
    await userEvent.upload(canvas.getByLabelText('Scene image', { selector: 'input' }), file)
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(file)
    await expect(canvas.getByText('tavern.png')).toBeVisible()
    await expect(canvas.getByText(/2(\.0)? KB/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: /remove file/i }))
    await expect(args['onUpdate:modelValue']).toHaveBeenLastCalledWith(null)
    await expect(canvas.queryByText('tavern.png')).toBeNull()
    await expect(canvas.getByRole('button', { name: /choose a file/i })).toBeInTheDocument()
  },
}

export const Stored: Story = {
  args: { currentName: 'cellar.webp', currentThumb: THUMB },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('cellar.webp')).toBeVisible()
    await expect(canvasElement.querySelector('img')).toHaveAttribute('src', THUMB)
    await userEvent.click(canvas.getByRole('button', { name: /remove file/i }))
    await expect(args.onClear).toHaveBeenCalledTimes(1)
    await expect(args['onUpdate:modelValue']).not.toHaveBeenCalled()
  },
}

export const StoredWithoutThumb: Story = {
  args: { currentName: 'theme.mp3', accept: ['audio/mpeg'], label: 'Music' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('theme.mp3')).toBeVisible()
    await expect(canvasElement.querySelector('img')).toBeNull()
  },
}

/** A picked file wins over the stored one. */
export const ReplacingStored: Story = {
  args: { currentName: 'cellar.webp', modelValue: new File(['x'], 'crypt.png', { type: 'image/png' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('crypt.png')).toBeVisible()
    await expect(canvas.queryByText('cellar.webp')).toBeNull()
  },
}

export const Uploading: Story = {
  args: { modelValue: new File(['x'.repeat(4096)], 'tavern.png', { type: 'image/png' }), progress: 0.4 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Scene image', { selector: 'input' })).toBeDisabled()
    const bar = canvas.getByRole('progressbar')
    await expect(bar).toHaveAttribute('aria-valuemin', '0')
    await expect(bar).toHaveAttribute('aria-valuemax', '100')
    await expect(bar).toHaveAttribute('aria-valuenow', '40')
    await expect(canvas.getByRole('button', { name: /remove file/i })).toBeDisabled()
  },
}

export const Failed: Story = {
  args: { error: 'The file is too large' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('The file is too large')).toBeVisible()
    await expect(canvas.getByLabelText('Scene image', { selector: 'input' })).toBeInvalid()
    await expect(canvas.getByLabelText('Scene image', { selector: 'input' })).toHaveAccessibleDescription('The file is too large')
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText('Scene image', { selector: 'input' })).toBeDisabled()
  },
}
