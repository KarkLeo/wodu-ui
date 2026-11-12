import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ref } from 'vue'
import SoundSheet from './SoundSheet.vue'
import { crookhollow, CROOKHOLLOW_META, PARTY } from '@/stories/fixtures'
import { modalDocs } from '@/stories/docs'
import { storyRouter } from '@/stories/router'
import { soundFile } from '@/stories/scenes'
import { BRAWL, manySounds, playableFile, withSounds } from '@/stories/sounds'
import { withGameTable } from '@/stories/state'
import { useMediaStore } from '@/stores/media'
import { RECORDED } from '@/transport/recordedResponses'
import { seedRecords } from '../../../.storybook/mocks/pb'
import { failUploadsWith, holdUploads, sentForms } from '../../../.storybook/mocks/upload'

const asMaster = withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)

const meta = {
  title: 'Features/Stage/SoundSheet',
  component: SoundSheet,
  parameters: { layout: 'centered', docs: modalDocs },
  args: { open: true, gameId: crookhollow.id },
  decorators: [withSounds(), asMaster],
  beforeEach: async () => { await storyRouter.push(`/games/${crookhollow.id}`) },
  render: (args) => ({
    components: { SoundSheet },
    setup() {
      const open = ref(true)
      return { args, open }
    },
    template: `
      <button type="button" @click="open = true">Open sheet</button>
      <SoundSheet v-model:open="open" :game-id="args.gameId" :sound="args.sound" />`,
  }),
} satisfies Meta<typeof SoundSheet>

export default meta
type Story = StoryObj<typeof meta>

const body = (el: HTMLElement) => within(el.ownerDocument.body)
const user = userEvent.setup({ applyAccept: false })
const fileInput = (el: HTMLElement) => body(el).getByLabelText('Sound file', { selector: 'input' })
const nameField = (el: HTMLElement) => body(el).getByRole('textbox', { name: 'Name' })
const closed = (el: HTMLElement) => waitFor(() => expect(body(el).queryByRole('dialog')).toBeNull())
const sentData = () => JSON.parse(sentForms()[0]!.fields.data!) as Record<string, unknown>
// PocketBase words a refusal of the `file` field of a sound this way.
const SOUND_REFUSED = { status: 400, body: '{"data":{"file":{"code":"validation_invalid_mime_type","message":"mime type must be one of: audio/mpeg."}},"message":"Failed to create record.","status":400}' }

/** A new sound: nothing to upload until it has a file and a name. */
export const Add: Story = {
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await expect(await sheet.findByRole('dialog', { name: 'New sound' })).toBeVisible()
    const add = sheet.getByRole('button', { name: 'Upload' })
    await expect(add).toBeDisabled()
    await expect(add).toHaveAccessibleDescription('Give the sound a name. Choose a sound file.')
    await expect(sheet.getByText(/MP3, M4A or AAC, up to 20 MB/)).toBeVisible()
    await expect(sheet.getByRole('switch', { name: 'Loop' })).not.toBeChecked()
    await user.upload(fileInput(canvasElement), soundFile('hearth.mp3'))
    await expect(nameField(canvasElement)).toHaveValue('hearth')
    await expect(add).toBeEnabled()
    await expect(sheet.queryByText(/Give the sound a name/)).toBeNull()
  },
}

/** The name starts as the file's name without its extension, and a name the person typed is never replaced. */
export const NameFollowsTheFileUntilTyped: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New sound' })
    await user.upload(fileInput(canvasElement), soundFile('ambient.rain.mp3'))
    await expect(nameField(canvasElement)).toHaveValue('ambient.rain')
    // Still the file's own name: another file replaces it.
    await user.upload(fileInput(canvasElement), soundFile('thunder.mp3'))
    await expect(nameField(canvasElement)).toHaveValue('thunder')
    await user.clear(nameField(canvasElement))
    await user.type(nameField(canvasElement), 'Storm')
    await user.upload(fileInput(canvasElement), soundFile('wind.mp3'))
    await expect(nameField(canvasElement)).toHaveValue('Storm')
  },
}

/** A file name over the limit is cut to 80 characters. */
export const LongFileNameIsCut: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await body(canvasElement).findByRole('dialog', { name: 'New sound' })
    await user.upload(fileInput(canvasElement), soundFile(`${'x'.repeat(95)}.mp3`))
    await expect(nameField(canvasElement)).toHaveValue('x'.repeat(80))
    await expect(body(canvasElement).getByRole('button', { name: 'Upload' })).toBeEnabled()
  },
}

/** The name field stops at the limit. */
export const NameStopsAtTheLimit: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const name = await body(canvasElement).findByRole('textbox', { name: 'Name' })
    await user.click(name)
    await user.paste('x'.repeat(95))
    await expect(name).toHaveValue('x'.repeat(80))
  },
}

/** A file of another type is refused at once, under the field, and nothing is picked. */
export const WrongType: Story = {
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New sound' })
    await user.upload(fileInput(canvasElement), soundFile('doc.pdf', 'application/pdf'))
    await expect(await sheet.findByText('This is not an MP3, M4A or AAC sound.')).toBeVisible()
    await expect(sheet.queryByText('doc.pdf')).toBeNull()
    await expect(nameField(canvasElement)).toHaveValue('')
    await expect(sheet.getByRole('button', { name: 'Upload' })).toBeDisabled()
    await user.upload(fileInput(canvasElement), soundFile('good.mp3'))
    await waitFor(() => expect(sheet.queryByText('This is not an MP3, M4A or AAC sound.')).toBeNull())
    await expect(sheet.getByRole('button', { name: 'Upload' })).toBeEnabled()
  },
}

/** A sound over 20 MB is refused at once: audio is never shrunk. */
export const TooLarge: Story = {
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New sound' })
    await user.upload(fileInput(canvasElement), soundFile('long.mp3', 'audio/mpeg', 21 * 1024 * 1024))
    await expect(await sheet.findByText('The sound is larger than 20 MB.')).toBeVisible()
    await expect(sheet.queryByText('long.mp3')).toBeNull()
    await expect(nameField(canvasElement)).toHaveValue('')
    await expect(sheet.getByRole('button', { name: 'Upload' })).toBeDisabled()
  },
}

/** The file goes up under a neutral name, with the name, the loop flag and the length the browser read. */
export const UploadsUnderANeutralName: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New sound' })
    await user.upload(fileInput(canvasElement), playableFile('traitor-ambush.mp3', 2))
    await user.clear(nameField(canvasElement))
    await user.type(nameField(canvasElement), 'Ambush')
    await user.click(sheet.getByRole('switch', { name: 'Loop' }))
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await closed(canvasElement)
    await expect(sentForms()).toHaveLength(1)
    const form = sentForms()[0]!
    await expect(form.method).toBe('POST')
    await expect(form.fields.game).toBe(crookhollow.id)
    await expect(sentData()).toMatchObject({ name: 'Ambush', loop: true })
    await expect(sentData().duration).toBeCloseTo(2, 1)
    await expect(form.files.file!.name).toBe('sound.mp3')
    await expect(JSON.stringify(form)).not.toMatch(/traitor/)
    await expect(useMediaStore().sounds.list.map(s => s.name)).toContain('Ambush')
  },
}

/** A file the browser cannot read the length of is still uploaded, with no length. */
export const UnreadableLengthIsLeftOut: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New sound' })
    await user.upload(fileInput(canvasElement), soundFile('noise.mp3'))
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await closed(canvasElement)
    await expect(sentData()).toMatchObject({ name: 'noise', loop: false })
    await expect('duration' in sentData()).toBe(false)
  },
}

/** While it uploads: the field shows the progress, the buttons are out, and the sheet stays until it is done. */
export const SavingShowsProgress: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const release = holdUploads()
    try {
      const sheet = body(canvasElement)
      await sheet.findByRole('dialog', { name: 'New sound' })
      await user.upload(fileInput(canvasElement), soundFile())
      await user.click(sheet.getByRole('button', { name: 'Upload' }))
      await waitFor(() => expect(sheet.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40'))
      await expect(sheet.getByRole('button', { name: 'Upload' })).toBeDisabled()
      await expect(sheet.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      await user.keyboard('{Escape}')
      await expect(sheet.getByRole('dialog')).toBeVisible()
    } finally {
      release()
    }
    await closed(canvasElement)
    await expect(sentForms()).toHaveLength(1)
  },
}

/** The list is full: nothing is sent and the sheet says why. */
export const LimitReached: Story = {
  decorators: [withSounds({ sounds: manySounds(15) })],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New sound' })
    await user.upload(fileInput(canvasElement), soundFile('one-too-many.mp3'))
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('You already have 15 sounds. Delete one first.')
    await expect(sentForms()).toHaveLength(0)
    await expect(nameField(canvasElement)).toHaveValue('one-too-many')
  },
}

/** A refused create while this device counts fewer than the limit: its own sentence, and the form stays. */
export const LimitMayHaveChanged: Story = {
  play: async ({ canvasElement }) => {
    failUploadsWith(RECORDED.create21st.status, RECORDED.create21st.body)
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New sound' })
    await user.upload(fileInput(canvasElement), soundFile('hearth.mp3'))
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('You may already have 15 sounds')
    await expect(nameField(canvasElement)).toHaveValue('hearth')
    await expect(sheet.getByText('hearth.mp3')).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Upload' })).toBeEnabled()
  },
}

/** The server reads the content, not the name: a file refused for its type is told under the field, with the rest kept. */
export const ServerRefusesTheFileType: Story = {
  play: async ({ canvasElement }) => {
    failUploadsWith(SOUND_REFUSED.status, SOUND_REFUSED.body)
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New sound' })
    await user.upload(fileInput(canvasElement), soundFile('hearth.mp3'))
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await expect(await sheet.findByText('This is not an MP3, M4A or AAC sound.')).toBeVisible()
    await expect(sheet.queryByRole('alert')).toBeNull()
    await expect(nameField(canvasElement)).toHaveValue('hearth')
    await expect(sheet.getByRole('button', { name: 'Upload' })).toBeEnabled()
  },
}

/** Any other failure: a general sentence, and a second try goes through under the same id. */
export const SaveFailed: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    failUploadsWith(500)
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New sound' })
    await user.upload(fileInput(canvasElement), soundFile('hearth.mp3'))
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('Couldn’t save the sound.')
    await expect(sheet.getByRole('button', { name: 'Upload' })).toBeEnabled()
    failUploadsWith(null)
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await closed(canvasElement)
    await expect(sentForms()).toHaveLength(2)
    await expect(sentForms()[0]!.fields.id).toBe(sentForms()[1]!.fields.id)
  },
}

/** Editing changes the name alone: no file field, no loop switch, and no file goes up. */
export const EditName: Story = {
  args: { sound: BRAWL },
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit sound' })
    await expect(nameField(canvasElement)).toHaveValue('Tavern brawl')
    await expect(sheet.queryByLabelText('Sound file', { selector: 'input' })).toBeNull()
    await expect(sheet.queryByRole('switch')).toBeNull()
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled()
    await user.clear(nameField(canvasElement))
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(nameField(canvasElement), 'Inn brawl')
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
    await expect(sentForms()[0]!.method).toBe('PATCH')
    await expect(sentForms()[0]!.files).toEqual({})
    await expect(sentData()).toEqual({ id: BRAWL.id, name: 'Inn brawl', loop: false, duration: 160 })
    await expect(useMediaStore().sounds.list.find(s => s.id === BRAWL.id)?.name).toBe('Inn brawl')
  },
}

/** Someone else is the master now. */
export const NotMaster: Story = {
  args: { sound: BRAWL },
  play: async ({ canvasElement }) => {
    seedRecords('games', [{ id: crookhollow.id, name: crookhollow.name, master: 'user-seva', invite_code: crookhollow.inviteCode }])
    failUploadsWith(RECORDED.updateNotFound.status, RECORDED.updateNotFound.body)
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit sound' })
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('You are not the master of this game any more.')
    await expect(nameField(canvasElement)).toHaveValue('Tavern brawl')
  },
}
