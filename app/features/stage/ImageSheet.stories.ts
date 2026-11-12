import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { ClientResponseError } from 'pocketbase'
import { ref } from 'vue'
import ImageSheet from './ImageSheet.vue'
import { crookhollow, CROOKHOLLOW_META, PARTY } from '@/stories/fixtures'
import { BRIDGE, manyImages, MAP, withImages } from '@/stories/images'
import { modalDocs } from '@/stories/docs'
import { noisePng, pictureFile } from '@/stories/scenes'
import { storyRouter } from '@/stories/router'
import { atRoute, withGameTable } from '@/stories/state'
import { useMediaStore } from '@/stores/media'
import { closeMedia } from '@/transport/media'
import { RECORDED } from '@/transport/recordedResponses'
import { pb, seedRecords, storedRecords } from '../../../.storybook/mocks/pb'
import { failUploadsWith, holdUploads, sentForms } from '../../../.storybook/mocks/upload'

const asMaster = withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)

const meta = {
  title: 'Features/Stage/ImageSheet',
  component: ImageSheet,
  parameters: { layout: 'centered', docs: modalDocs },
  args: { open: true, gameId: crookhollow.id },
  decorators: [withImages(), asMaster],
  beforeEach: async () => { await storyRouter.push(`/games/${crookhollow.id}`) },
  render: (args) => ({
    components: { ImageSheet },
    setup() {
      const open = ref(true)
      return { args, open }
    },
    template: `
      <button type="button" @click="open = true">Open sheet</button>
      <ImageSheet v-model:open="open" :game-id="args.gameId" :image="args.image" />`,
  }),
} satisfies Meta<typeof ImageSheet>

export default meta
type Story = StoryObj<typeof meta>

const body = (el: HTMLElement) => within(el.ownerDocument.body)
const user = userEvent.setup({ applyAccept: false })
const fileInput = (el: HTMLElement) => body(el).getByLabelText('Image', { selector: 'input' })
const closed = (el: HTMLElement) => waitFor(() => expect(body(el).queryByRole('dialog')).toBeNull())
const SERVER_REFUSES_TYPE = '{"data":{"file":{"code":"validation_invalid_mime_type","message":"mime type must be one of: image/jpeg, image/png, image/webp."}},"message":"Failed to create record.","status":400}'

/** A new image: nothing to upload until it has a picture; the caption is optional and counted. */
export const Add: Story = {
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await expect(await sheet.findByRole('dialog', { name: 'New image' })).toBeVisible()
    const upload = sheet.getByRole('button', { name: 'Upload' })
    await expect(upload).toBeDisabled()
    await expect(upload).toHaveAccessibleDescription('Choose an image.')
    await expect(sheet.getByText(/A picture over 2 MB is reduced automatically/)).toBeVisible()
    await expect(sheet.getByText('0 / 120')).toBeVisible()
    await expect(sheet.queryByText(/It is on the table now/)).toBeNull()
    await user.upload(fileInput(canvasElement), pictureFile())
    await expect(upload).toBeEnabled()
  },
}

/** A file of another type is refused at once, under the picture, and nothing is picked. */
export const WrongType: Story = {
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New image' })
    await user.upload(fileInput(canvasElement), new File(['x'], 'notes.pdf', { type: 'application/pdf' }))
    await expect(await sheet.findByText('This is not a JPEG, PNG or WebP picture.')).toBeVisible()
    await expect(sheet.queryByText('notes.pdf')).toBeNull()
    await expect(sheet.getByRole('button', { name: 'Upload' })).toBeDisabled()
  },
}

/** The counter counts the way the domain does, on the trimmed text: an emoji from outside the basic plane is two. */
export const CaptionCounterCountsLikeTheDomain: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New image' })
    const caption = sheet.getByRole('textbox', { name: 'Caption' })
    await user.type(caption, '   a😀   ')
    await expect(sheet.getByText('3 / 120')).toBeVisible()
  },
}

/** Over the limit is an error at the field, nothing is cut, and saving waits. */
export const CaptionOverTheLimitIsAnError: Story = {
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New image' })
    await user.upload(fileInput(canvasElement), pictureFile())
    const caption = sheet.getByRole('textbox', { name: 'Caption' })
    const long = 'x'.repeat(121)
    await user.click(caption)
    await user.paste(long)
    await expect(caption).toHaveValue(long)
    await expect(sheet.getByText('121 / 120')).toBeVisible()
    await expect(sheet.getByText('The caption is longer than 120 characters.')).toBeVisible()
    await expect(caption).toBeInvalid()
    await expect(sheet.getByRole('button', { name: 'Upload' })).toBeDisabled()
    await user.type(caption, '{Backspace}')
    await expect(sheet.queryByText(/longer than 120/)).toBeNull()
    await expect(sheet.getByRole('button', { name: 'Upload' })).toBeEnabled()
  },
}

/** The file goes up under a neutral name, whatever the picked one was called, and the caption goes as data. */
export const UploadsUnderANeutralName: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New image' })
    await user.upload(fileInput(canvasElement), pictureFile('traitor-ambush-map.png'))
    await user.type(sheet.getByRole('textbox', { name: 'Caption' }), 'The ambush')
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await closed(canvasElement)
    await expect(sentForms()).toHaveLength(1)
    const form = sentForms()[0]!
    await expect(form.method).toBe('POST')
    await expect(form.files.file!.name).toBe('image.png')
    await expect(JSON.stringify(form)).not.toMatch(/traitor|ambush-map/)
    await expect(JSON.parse(form.fields.data!)).toMatchObject({ caption: 'The ambush' })
    await expect(useMediaStore().images.list.map(i => i.caption)).toContain('The ambush')
  },
}

/** An image over 2 MB is not an error: it is shrunk before it goes up. */
export const BigImageIsFitted: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New image' })
    const big = await noisePng()
    await expect(big.size).toBeGreaterThan(2097152)
    await user.upload(fileInput(canvasElement), big)
    await expect(sheet.queryByRole('alert')).toBeNull()
    await expect(sheet.getByRole('button', { name: 'Upload' })).toBeEnabled()
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(sentForms()).toHaveLength(1), { timeout: 15000 })
    const file = sentForms()[0]!.files.file!
    await expect(file.size).toBeLessThan(2097152)
    await expect(file.type).toBe('image/webp')
    await expect(file.name).toBe('image.webp')
    await closed(canvasElement)
  },
}

/** A file the browser cannot decode says so under the picture. */
export const UndecodablePicture: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New image' })
    await user.upload(fileInput(canvasElement), new File([new Uint8Array(3 * 1024 * 1024)], 'broken.png', { type: 'image/png' }))
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await expect(await sheet.findByText('This image could not be read.')).toBeVisible()
    await expect(sheet.queryByText(/Check your connection/i)).toBeNull()
    await expect(sentForms()).toHaveLength(0)
    await expect(sheet.getByRole('button', { name: 'Upload' })).toBeEnabled()
  },
}

/** While it uploads: the picture shows the progress, the buttons are out, and the sheet stays until it is done. */
export const SavingShowsProgress: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const release = holdUploads()
    try {
      const sheet = body(canvasElement)
      await sheet.findByRole('dialog', { name: 'New image' })
      await user.upload(fileInput(canvasElement), pictureFile())
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

/** Editing shows the stored picture and the caption; a caption-only save sends no file. */
export const EditCaptionOnly: Story = {
  args: { image: BRIDGE },
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit image' })
    await expect(sheet.getByText('Image attached')).toBeVisible()
    const caption = sheet.getByRole('textbox', { name: 'Caption' })
    await expect(caption).toHaveValue('The old bridge at dusk')
    await user.clear(caption)
    await user.type(caption, 'The bridge at dawn')
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
    await expect(sentForms()[0]!.method).toBe('PATCH')
    await expect(sentForms()[0]!.files).toEqual({})
    await expect(useMediaStore().images.list.find(i => i.id === BRIDGE.id)?.caption).toBe('The bridge at dawn')
  },
}

/** An emptied caption saves as none. */
export const EmptyingTheCaptionRemovesIt: Story = {
  tags: ['no-visual'],
  args: { image: BRIDGE },
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit image' })
    await user.clear(sheet.getByRole('textbox', { name: 'Caption' }))
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
    await waitFor(() => expect(useMediaStore().images.list.find(i => i.id === BRIDGE.id)?.caption).toBeNull())
  },
}

/** Removing the stored picture asks for another: saving waits for it, and the caption is kept. */
export const ReplacingThePictureNeedsOne: Story = {
  tags: ['no-visual'],
  args: { image: BRIDGE },
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit image' })
    await user.click(sheet.getByRole('button', { name: 'Remove file: Image' }))
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled()
    await expect(sheet.getByRole('textbox', { name: 'Caption' })).toHaveValue('The old bridge at dusk')
    await user.upload(fileInput(canvasElement), pictureFile('cellar.png'))
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled()
  },
}

/** Editing the shown image says what reaches the table. */
export const EditShownSaysSo: Story = {
  decorators: [withImages({ shown: BRIDGE.id }), asMaster],
  args: { image: BRIDGE },
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit image' })
    await expect(sheet.getByText(/It is on the table now: changes show for everyone at once\. If it was shown without its caption, the caption stays hidden\./)).toBeVisible()
  },
}

/** An image that is not shown carries no such line. */
export const EditNotShownSaysNothing: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ shown: MAP.id }), asMaster],
  args: { image: BRIDGE },
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit image' })
    await expect(sheet.queryByText(/It is on the table now/)).toBeNull()
  },
}

/** The image is saved but the table did not get it: the sheet says so and offers to try again. */
export const PublishFailedAfterSave: Story = {
  tags: ['no-visual'],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  decorators: [withImages({ shown: BRIDGE.id }), asMaster],
  args: { image: BRIDGE },
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    const stages = [
      spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 })),
      spyOn(pb.collection('stages'), 'create').mockRejectedValue(new ClientResponseError({ status: 500 })),
    ]
    await sheet.findByRole('dialog', { name: 'Edit image' })
    await user.click(sheet.getByRole('button', { name: 'Remove file: Image' }))
    await user.upload(fileInput(canvasElement), pictureFile('cellar.png'))
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('The image is saved, but the table was not updated.')
    await expect(sheet.getByRole('dialog')).toBeVisible()
    await expect(sheet.queryByRole('button', { name: 'Save' })).toBeNull()
    await expect(storedRecords('images').find(r => r.id === BRIDGE.id)).toMatchObject({ file: 'image.png' })
    await user.click(sheet.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(sheet.getByRole('alert')).toHaveTextContent('the table still was not updated'))
    for (const spy of stages) spy.mockRestore()
    await user.click(sheet.getByRole('button', { name: 'Try again' }))
    await closed(canvasElement)
    await waitFor(() => expect((storedRecords('stages')[0]?.data as { image: { file: { name: string } } }).image.file.name).toBe('image.png'))
  },
}

/** The list is full: nothing is sent and the sheet says why. */
export const LimitReached: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ images: manyImages(30) }), asMaster],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New image' })
    await user.upload(fileInput(canvasElement), pictureFile())
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('You already have 30 images. Delete one first.')
    await expect(sentForms()).toHaveLength(0)
  },
}

/** The server reads the content, not the name: a file refused for its type is told under the picture. */
export const ServerRefusesTheFileType: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    failUploadsWith(400, SERVER_REFUSES_TYPE)
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'New image' })
    await user.upload(fileInput(canvasElement), pictureFile('tavern.png'))
    await user.type(sheet.getByRole('textbox', { name: 'Caption' }), 'Kept')
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await expect(await sheet.findByText('This is not a JPEG, PNG or WebP picture.')).toBeVisible()
    await expect(sheet.queryByText(/You may already have/)).toBeNull()
    await expect(sheet.getByRole('textbox', { name: 'Caption' })).toHaveValue('Kept')
    await expect(sheet.getByText('tavern.png')).toBeVisible()
  },
}

/** Someone else is the master now. */
export const NotMaster: Story = {
  tags: ['no-visual'],
  args: { image: BRIDGE },
  play: async ({ canvasElement }) => {
    seedRecords('games', [{ id: crookhollow.id, name: crookhollow.name, master: 'user-seva', invite_code: crookhollow.inviteCode }])
    failUploadsWith(RECORDED.updateNotFound.status, RECORDED.updateNotFound.body)
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit image' })
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('You are not the master of this game any more.')
    await expect(sheet.getByRole('textbox', { name: 'Caption' })).toHaveValue('The old bridge at dusk')
  },
}

/** Any other failure: a general sentence, and the sheet is usable again. */
export const SaveFailed: Story = {
  args: { image: BRIDGE },
  play: async ({ canvasElement }) => {
    failUploadsWith(500)
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit image' })
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('Couldn’t save the image.')
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled()
    failUploadsWith(null)
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
  },
}

/** The session ends during the upload: nothing is said, and the form can be used again. */
export const SessionEndsMidUpload: Story = {
  tags: ['no-visual'],
  args: { image: BRIDGE },
  play: async ({ canvasElement }) => {
    const release = holdUploads()
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit image' })
    await user.click(sheet.getByRole('button', { name: 'Remove file: Image' }))
    await user.upload(fileInput(canvasElement), pictureFile('cellar.png'))
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sheet.getByRole('progressbar')).toBeVisible())
    closeMedia()
    release()
    await waitFor(() => expect(sheet.queryByRole('progressbar')).toBeNull())
    await expect(sheet.queryByRole('alert')).toBeNull()
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled()
  },
}
