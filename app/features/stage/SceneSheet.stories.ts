import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { ref } from 'vue'
import SceneSheet from './SceneSheet.vue'
import { crookhollow, CROOKHOLLOW_META, PARTY } from '@/stories/fixtures'
import { manyScenes, noisePng, pictureFile, soundFile, TAVERN, withScenes } from '@/stories/scenes'
import { modalDocs } from '@/stories/docs'
import { storyRouter } from '@/stories/router'
import { withGameTable } from '@/stories/state'
import { useMediaStore } from '@/stores/media'
import { closeMedia } from '@/transport/media'
import { seedRecords } from '../../../.storybook/mocks/pb'
import { failUploadsWith, holdUploads, sentForms } from '../../../.storybook/mocks/upload'

const asMaster = withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)

const meta = {
  title: 'Features/Stage/SceneSheet',
  component: SceneSheet,
  parameters: { layout: 'centered', docs: modalDocs },
  args: { open: true, gameId: crookhollow.id },
  decorators: [withScenes(), asMaster],
  beforeEach: async () => { await storyRouter.push(`/games/${crookhollow.id}`) },
  render: (args) => ({
    components: { SceneSheet },
    setup() {
      const open = ref(true)
      return { args, open }
    },
    template: `
      <button type="button" @click="open = true">Open sheet</button>
      <SceneSheet v-model:open="open" :game-id="args.gameId" :scene="args.scene" />`,
  }),
} satisfies Meta<typeof SceneSheet>

export default meta
type Story = StoryObj<typeof meta>

const body = (el: HTMLElement) => within(el.ownerDocument.body)
const user = userEvent.setup({ applyAccept: false })
const imageInput = (el: HTMLElement) => body(el).getByLabelText('Picture', { selector: 'input' })
const soundInput = (el: HTMLElement) => body(el).getByLabelText('Sound', { selector: 'input' })
const closed = (el: HTMLElement) => waitFor(() => expect(body(el).queryByRole('dialog')).toBeNull())

/** A new scene: nothing to save until it has a name and a picture or a sound. */
export const Add: Story = {
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await expect(await sheet.findByRole('dialog', { name: 'New scene' })).toBeVisible()
    const add = sheet.getByRole('button', { name: 'Add' })
    await expect(add).toBeDisabled()
    await expect(add).toHaveAccessibleDescription('Give the scene a name. Add a picture, a sound, or both.')
    await expect(sheet.getByText(/up to 2 MB/)).toBeVisible()
    await expect(sheet.getByText(/larger picture is reduced automatically/)).toBeVisible()
    await expect(sheet.getByText(/up to 20 MB/)).toBeVisible()
    await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Tavern')
    await expect(add).toBeDisabled()
    await expect(add).toHaveAccessibleDescription('Add a picture, a sound, or both.')
    await user.upload(soundInput(canvasElement), soundFile())
    await expect(add).toBeEnabled()
    await expect(sheet.queryByText('Add a picture, a sound, or both.')).toBeNull()
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

/** A file of another type is refused at once, under its own field, and nothing is picked. */
export const WrongTypes: Story = {
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New scene' })
    await user.upload(imageInput(canvasElement), pictureFile('notes.txt', 'text/plain'))
    await expect(await sheet.findByText('This is not a JPEG, PNG or WebP picture.')).toBeVisible()
    await expect(sheet.queryByText('notes.txt')).toBeNull()
    await user.upload(soundInput(canvasElement), soundFile('doc.pdf', 'application/pdf'))
    await expect(await sheet.findByText('This is not an MP3, M4A or AAC sound.')).toBeVisible()
    await expect(sheet.queryByText('doc.pdf')).toBeNull()
    await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Tavern')
    await expect(sheet.getByRole('button', { name: 'Add' })).toBeDisabled()
    // A good file takes the error away.
    await user.upload(imageInput(canvasElement), pictureFile())
    await waitFor(() => expect(sheet.queryByText('This is not a JPEG, PNG or WebP picture.')).toBeNull())
    await expect(sheet.getByRole('button', { name: 'Add' })).toBeEnabled()
  },
}

/** A sound over the limit is refused at once; a picture over it is fine, it is fitted on save. */
export const SoundTooLargeButBigImageFine: Story = {
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New scene' })
    await user.upload(soundInput(canvasElement), soundFile('long.mp3', 'audio/mpeg', 21 * 1024 * 1024))
    await expect(await sheet.findByText('The sound is larger than 20 MB.')).toBeVisible()
    await expect(sheet.queryByText('long.mp3')).toBeNull()
    await user.upload(imageInput(canvasElement), pictureFile('big.png', 'image/png', 3 * 1024 * 1024))
    await expect(await sheet.findByText('big.png')).toBeVisible()
    await expect(sheet.queryByText(/larger than 2 MB/)).toBeNull()
    await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Map')
    await expect(sheet.getByRole('button', { name: 'Add' })).toBeEnabled()
  },
}

/** The files go up under neutral names, whatever the picked ones were called. */
export const UploadsUnderNeutralNames: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New scene' })
    await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Traitor’s lair')
    await user.upload(imageInput(canvasElement), pictureFile('traitor-lair.png'))
    await user.upload(soundInput(canvasElement), soundFile('ambush.mp3'))
    await user.click(sheet.getByRole('button', { name: 'Add' }))
    await closed(canvasElement)
    await expect(sentForms()).toHaveLength(1)
    const form = sentForms()[0]!
    await expect(form.method).toBe('POST')
    await expect(form.fields.game).toBe(crookhollow.id)
    await expect(JSON.parse(form.fields.data!)).toMatchObject({ name: 'Traitor’s lair' })
    await expect(form.files.image!.name).toBe('image.png')
    await expect(form.files.sound!.name).toBe('sound.mp3')
    await expect(Object.values(form.files).map(f => f.name).join()).not.toMatch(/traitor|ambush/)
    await expect(useMediaStore().scenes.list.map(s => s.name)).toContain('Traitor’s lair')
  },
}

/** A picture over 2 MB is shrunk before it goes up. */
export const BigImageIsFitted: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New scene' })
    const big = await noisePng()
    await expect(big.size).toBeGreaterThan(2097152)
    await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Map')
    await user.upload(imageInput(canvasElement), big)
    await user.click(sheet.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(sentForms()).toHaveLength(1), { timeout: 15000 })
    const image = sentForms()[0]!.files.image!
    await expect(image.size).toBeLessThan(2097152)
    await expect(image.type).toBe('image/webp')
    await expect(image.name).toBe('image.webp')
    await closed(canvasElement)
  },
}

/** Where the browser cannot write WebP (it hands back a PNG), the picture is fitted as a JPEG instead. */
export const BigImageFallsBackToJpeg: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New scene' })
    const big = await noisePng()
    const toBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      toBlob.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality)
    }
    try {
      await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Map')
      await user.upload(imageInput(canvasElement), big)
      await user.click(sheet.getByRole('button', { name: 'Add' }))
      await waitFor(() => expect(sentForms()).toHaveLength(1), { timeout: 20000 })
    } finally {
      HTMLCanvasElement.prototype.toBlob = toBlob
    }
    const image = sentForms()[0]!.files.image!
    await expect(image.size).toBeLessThan(2097152)
    await expect(image.type).toBe('image/jpeg')
    await expect(image.name).toBe('image.jpg')
    await closed(canvasElement)
  },
}

/** A file the browser cannot decode says so under the picture, not "check your connection". */
export const UndecodablePicture: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New scene' })
    const junk = new File([new Uint8Array(3 * 1024 * 1024)], 'broken.png', { type: 'image/png' })
    await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Map')
    await user.upload(imageInput(canvasElement), junk)
    await user.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(await sheet.findByText('This picture could not be read.')).toBeVisible()
    await expect(sheet.queryByText(/Check your connection/i)).toBeNull()
    await expect(sentForms()).toHaveLength(0)
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('Map')
    await expect(sheet.getByRole('button', { name: 'Add' })).toBeEnabled()
  },
}

/** A picture that cannot be made small enough is told under the picture too. */
export const PictureCannotBeFitted: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New scene' })
    const big = await noisePng()
    const toBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (callback, type) {
      callback(new Blob([new Uint8Array(3 * 1024 * 1024)], { type: type ?? 'image/png' }))
    }
    try {
      await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Map')
      await user.upload(imageInput(canvasElement), big)
      await user.click(sheet.getByRole('button', { name: 'Add' }))
      await expect(await sheet.findByText('This picture could not be made small enough.', {}, { timeout: 15000 })).toBeVisible()
    } finally {
      HTMLCanvasElement.prototype.toBlob = toBlob
    }
    await expect(sentForms()).toHaveLength(0)
  },
}

/** Editing shows the stored files; each can be removed, but not both. */
export const EditStoredFiles: Story = {
  args: { scene: TAVERN },
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit scene' })
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('Tavern')
    await expect(sheet.getByText('Picture attached')).toBeVisible()
    await expect(sheet.getByText('Sound attached')).toBeVisible()
    await expect(sheet.queryByText('image.jpg')).toBeNull()
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled()
    await user.click(sheet.getByRole('button', { name: 'Remove file: Picture' }))
    await expect(sheet.getByRole('button', { name: 'Choose a file: Picture' })).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled()
    await user.click(sheet.getByRole('button', { name: 'Remove file: Sound' }))
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.upload(imageInput(canvasElement), pictureFile())
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled()
  },
}

/** Saving with a picture removed clears that file alone, and keeps the other. */
export const RemovingOneFile: Story = {
  tags: ['no-visual'],
  args: { scene: TAVERN },
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit scene' })
    await user.click(sheet.getByRole('button', { name: 'Remove file: Picture' }))
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
    const form = sentForms()[0]!
    await expect(form.method).toBe('PATCH')
    await expect(form.fields.image).toBe('')
    await expect(form.files).toEqual({})
    await expect('sound' in form.fields).toBe(false)
    await expect(useMediaStore().scenes.list.find(s => s.id === TAVERN.id)).toMatchObject({ image: null, sound: 'sound.mp3' })
  },
}

/** Picking a file over a stored one, then taking it back, shows the stored one again. */
export const TakingBackAPickKeepsTheStoredFile: Story = {
  tags: ['no-visual'],
  args: { scene: TAVERN },
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit scene' })
    await user.upload(imageInput(canvasElement), pictureFile('cellar.png'))
    await expect(await sheet.findByText('cellar.png')).toBeVisible()
    await expect(sheet.queryByText('Picture attached')).toBeNull()
    await user.click(sheet.getByRole('button', { name: 'Remove file: Picture' }))
    await expect(await sheet.findByText('Picture attached')).toBeVisible()
    await expect(sheet.queryByText('cellar.png')).toBeNull()
  },
}

/** While it uploads: both fields show the progress, Save and Cancel are out, and the sheet stays until it is done. */
export const SavingShowsProgress: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const release = holdUploads()
    try {
      const sheet = body(canvasElement)
      await sheet.findByRole('dialog', { name: 'New scene' })
      await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Tavern')
      await user.upload(imageInput(canvasElement), pictureFile())
      await user.upload(soundInput(canvasElement), soundFile())
      await user.click(sheet.getByRole('button', { name: 'Add' }))
      await waitFor(() => expect(sheet.getAllByRole('progressbar')).toHaveLength(2))
      for (const bar of sheet.getAllByRole('progressbar')) await expect(bar).toHaveAttribute('aria-valuenow', '40')
      await expect(sheet.getByRole('button', { name: 'Add' })).toBeDisabled()
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
  decorators: [withScenes({ scenes: manyScenes(20) })],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New scene' })
    await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'One too many')
    await user.upload(soundInput(canvasElement), soundFile())
    await user.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('You already have 20 scenes. Delete one first.')
    await expect(sentForms()).toHaveLength(0)
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('One too many')
  },
}

/** A refused create while this device counts fewer than the limit: its own sentence, and what was typed stays. */
export const LimitMayHaveChanged: Story = {
  play: async ({ canvasElement }) => {
    failUploadsWith(400)
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New scene' })
    await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Tavern')
    await user.upload(imageInput(canvasElement), pictureFile('tavern.png'))
    await user.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('You may already have 20 scenes')
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('Tavern')
    await expect(sheet.getByText('tavern.png')).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Add' })).toBeEnabled()
  },
}

/** The server reads the content, not the name: a file refused for its type is told under its own field, with the rest kept. */
export const ServerRefusesTheFileType: Story = {
  play: async ({ canvasElement }) => {
    failUploadsWith(400, { data: { image: { code: 'validation_invalid_mime_type' } } })
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New scene' })
    await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Tavern')
    await user.upload(imageInput(canvasElement), pictureFile('tavern.png'))
    await user.click(sheet.getByRole('button', { name: 'Add' }))
    await expect(await sheet.findByText('This is not a JPEG, PNG or WebP picture.')).toBeVisible()
    await expect(sheet.queryByText(/You may already have/)).toBeNull()
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('Tavern')
    await expect(sheet.getByText('tavern.png')).toBeVisible()
  },
}

/** Someone else is the master now. */
export const NotMaster: Story = {
  args: { scene: TAVERN },
  play: async ({ canvasElement }) => {
    seedRecords('games', [{ id: crookhollow.id, name: crookhollow.name, master: 'user-seva', invite_code: crookhollow.inviteCode }])
    failUploadsWith(404)
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit scene' })
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('You are not the master of this game any more.')
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('Tavern')
  },
}

/** Any other failure: a general sentence, and the sheet is usable again. */
export const SaveFailed: Story = {
  args: { scene: TAVERN },
  play: async ({ canvasElement }) => {
    failUploadsWith(500)
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit scene' })
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('Couldn’t save the scene.')
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled()
    failUploadsWith(null)
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
    await expect(sheet.queryByRole('alert')).toBeNull()
  },
}

/** The session ends during the upload: nothing is said, and the form can be used again. */
export const SessionEndsMidUpload: Story = {
  tags: ['no-visual'],
  args: { scene: TAVERN },
  play: async ({ canvasElement }) => {
    const release = holdUploads()
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit scene' })
    await user.upload(imageInput(canvasElement), pictureFile('cellar.png'))
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sheet.getAllByRole('progressbar')).toHaveLength(1))
    closeMedia()
    release()
    await waitFor(() => expect(sheet.queryByRole('progressbar')).toBeNull())
    await expect(sheet.queryByRole('alert')).toBeNull()
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled()
  },
}
