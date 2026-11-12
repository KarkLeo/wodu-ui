import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { defineComponent, onUnmounted } from 'vue'
import ImagesPanel from './ImagesPanel.vue'
import { useMediaSession } from '@/composables/useMediaSession'
import { useTrayCards } from '@/composables/useTrayCards'
import { crookhollow, CROOKHOLLOW_META, olden, PARTY } from '@/stories/fixtures'
import { BRIDGE, IMAGES, imageRow, manyImages, MAP, OGRE, recordImageSources, withImages } from '@/stories/images'
import { pictureFile } from '@/stories/scenes'
import { atRoute, withGameTable } from '@/stories/state'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { useToastsStore } from '@/stores/toasts'
import { useToolPanelsStore } from '@/stores/toolPanels'
import { closeMedia } from '@/transport/media'
import { clearPbRequests, pb, pbRequests, resetRecords, seedRecords, storedRecords } from '../../../.storybook/mocks/pb'
import { sentForms } from '../../../.storybook/mocks/upload'

const card: Decorator = (story) => ({
  components: { story },
  template: '<div style="width: min(440px, 100vw - 32px); height: 640px"><story /></div>',
})

const asMaster = withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)
const route = atRoute(`/games/${crookhollow.id}`)

const meta = {
  title: 'Features/Stage/ImagesPanel',
  component: ImagesPanel,
  parameters: { layout: 'centered' },
  decorators: [card],
} satisfies Meta<typeof ImagesPanel>

export default meta
type Story = StoryObj<typeof meta>

const body = (el: HTMLElement) => within(el.ownerDocument.body)
const user = userEvent.setup({ applyAccept: false })
const tile = (el: HTMLElement, caption: string | RegExp) => within(el).getByRole('radio', { name: caption })
const tiles = (el: HTMLElement) => within(el).queryAllByRole('radio')
const captions = (el: HTMLElement) => tiles(el).map(t => t.querySelector('.it-caption')?.textContent?.trim())
const stageImage = () => (storedRecords('stages')[0]?.data as { image: Record<string, unknown> | null } | undefined)?.image
const toastTexts = () => useToastsStore().items.map(t => t.text)
const STAGE_TOAST = 'The change did not reach the table. Try again.'
const closed = (el: HTMLElement) => waitFor(() => expect(body(el).queryByRole('dialog')).toBeNull())
const bar = (el: HTMLElement) => within(el).queryByRole('group', { name: /^Selected image/ })
const barButtons = (el: HTMLElement) => within(bar(el)!).getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent?.trim())

/** Three images, one shown at the table, with the count, the grid and nothing selected. */
export const Default: Story = {
  decorators: [withImages({ shown: BRIDGE.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Images' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Images' })).toBeVisible()
    await expect(canvas.getByText('3 / 30')).toBeVisible()
    await expect(canvas.getByRole('radiogroup', { name: 'Images' })).toBeVisible()
    await expect(captions(canvasElement)).toEqual(['The old bridge at dusk', 'No caption', 'Brakk the ogre, scarred and sullen'])
    await expect(canvas.getByRole('button', { name: 'Upload image' })).toBeEnabled()
    for (const t of tiles(canvasElement)) await expect(t).not.toBeChecked()
    const current = tiles(canvasElement).filter(t => t.getAttribute('aria-current') === 'true')
    await expect(current).toHaveLength(1)
    await expect(within(current[0]!).getByText('Shown')).toBeVisible()
    await expect(bar(canvasElement)).toBeNull()
    await expect(canvas.getByText(/Select an image to show it/)).toBeVisible()
  },
}

/** No images yet: a one-line hint, and the upload button still works. */
export const Empty: Story = {
  decorators: [withImages({ images: [] }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/No images yet/)).toBeVisible()
    await expect(canvas.getByText('0 / 30')).toBeVisible()
    await expect(canvas.queryByRole('radiogroup')).toBeNull()
    await expect(canvas.queryByText(/Select an image/)).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Upload image' })).toBeEnabled()
  },
}

export const Loading: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ status: 'loading' }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Loading images…')
    await expect(within(canvasElement).queryByRole('radiogroup')).toBeNull()
  },
}

// The store holds another game's images, as it does for a master of two games who has just moved to the second.
const holdingOtherGame: Decorator = (story) => ({
  components: { story },
  setup() {
    const media = useMediaStore()
    media.clearAll()
    media.startLoading(olden.id, ['images'])
    media.setList('images', olden.id, structuredClone(IMAGES))
  },
  template: '<story />',
})

/** Another game's images are never listed, and nothing can put one of them on this table. */
export const OtherGamesImagesAreNotShown: Story = {
  tags: ['no-visual'],
  decorators: [holdingOtherGame, withImages({ status: 'idle' }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading images…')
    await expect(canvas.queryByRole('radiogroup')).toBeNull()
    await expect(canvas.queryByText('The old bridge at dusk')).toBeNull()
  },
}

const SessionHarness = defineComponent({
  components: { ImagesPanel },
  setup() {
    useMediaSession()
    onUnmounted(closeMedia)
  },
  template: '<ImagesPanel />',
})

/** The load failed: a note and Try again, which loads the list. */
export const LoadFailedTryAgain: Story = {
  tags: ['no-visual'],
  render: () => ({ components: { SessionHarness }, template: '<SessionHarness />' }),
  decorators: [(story) => ({
    components: { story },
    setup() {
      spyOn(pb.collection('images'), 'getFullList').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    },
    template: '<story />',
  }), withImages({ status: 'idle' }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Couldn’t load the images.')
    await expect(canvas.queryByRole('radiogroup')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(captions(canvasElement)).toHaveLength(3))
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

/** Thirty images: the upload button is out and a note says why. */
export const AtTheLimit: Story = {
  decorators: [withImages({ images: manyImages(30) }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('30 / 30')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Upload image' })).toBeDisabled()
    await expect(canvas.getByText(/reached the limit of 30 images/)).toBeVisible()
  },
}

/** Three columns in the 440 px card, every tile the same size. */
export const ThreeColumns: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ images: manyImages(7) }), asMaster],
  loaders: [route],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const rects = tiles(canvasElement).map(t => t.getBoundingClientRect())
    await expect(new Set(rects.slice(0, 3).map(r => Math.round(r.top))).size).toBe(1)
    await expect(rects[3]!.top).toBeGreaterThan(rects[0]!.bottom - 1)
    await expect(Math.abs(rects[0]!.left - rects[3]!.left)).toBeLessThan(1)
    for (const r of rects) await expect(Math.abs(r.width - rects[0]!.width)).toBeLessThan(1)
  },
}

/** Selecting a tile shows its bar: Show, Show without caption (it has one), Edit, Delete. */
export const SelectingShowsTheBar: Story = {
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(tile(canvasElement, /The old bridge/))
    await expect(tile(canvasElement, /The old bridge/)).toBeChecked()
    await expect(barButtons(canvasElement)).toEqual(['Show', 'Show without caption', 'Edit', 'Delete'])
    await expect(within(canvasElement).queryByText(/Select an image to show it/)).toBeNull()
    await user.click(tile(canvasElement, /Brakk/))
    await expect(tile(canvasElement, /The old bridge/)).not.toBeChecked()
    await expect(within(canvasElement).getAllByRole('radio', { checked: true })).toHaveLength(1)
  },
}

/** An image without a caption has one Show button. */
export const NoCaptionHasOneShowButton: Story = {
  tags: ['no-visual'],
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(tile(canvasElement, /No caption/))
    await expect(barButtons(canvasElement)).toEqual(['Show', 'Edit', 'Delete'])
  },
}

/** One tab stop and arrow keys: the first tile takes the tab, the arrows select and move. */
export const ArrowKeysSelect: Story = {
  tags: ['no-visual'],
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const first = tile(canvasElement, /The old bridge/)
    await expect(first).toHaveAttribute('tabindex', '0')
    await expect(tile(canvasElement, /No caption/)).toHaveAttribute('tabindex', '-1')
    first.focus()
    await user.keyboard('{ArrowRight}')
    await expect(tile(canvasElement, /No caption/)).toBeChecked()
    await expect(tile(canvasElement, /No caption/)).toHaveFocus()
    await user.keyboard('{End}')
    await expect(tile(canvasElement, /Brakk/)).toBeChecked()
    await expect(within(canvasElement).getAllByRole('radio', { checked: true })).toHaveLength(1)
  },
}

/** Show writes the stage with the image's file reference, its caption and the time, and nothing else about it. */
export const ShowPublishesWithCaption: Story = {
  tags: ['no-visual'],
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(tile(canvasElement, /The old bridge/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Show' }))
    await waitFor(() => expect(stageImage()).not.toBeNull())
    await expect(stageImage()).toEqual({
      id: BRIDGE.id,
      file: { collection: 'images', record: BRIDGE.id, name: 'image.jpg' },
      caption: 'The old bridge at dusk',
      shownAt: expect.any(String),
    })
    await expect(Number.isNaN(Date.parse(stageImage()!.shownAt as string))).toBe(false)
    // The same button now hides it, and the tile carries the mark.
    await waitFor(() => expect(barButtons(canvasElement)).toEqual(['Hide', 'Edit', 'Delete']))
    await expect(tile(canvasElement, /The old bridge/)).toHaveAttribute('aria-current', 'true')
    await expect(canvasElement.ownerDocument.activeElement).toBe(within(bar(canvasElement)!).getByRole('button', { name: 'Hide' }))
  },
}

/** Without the caption the stage write has `caption: null` and the caption's text is nowhere in what was sent. */
export const ShowWithoutCaptionCarriesNoText: Story = {
  tags: ['no-visual'],
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('stages'), 'update')
    const create = spyOn(pb.collection('stages'), 'create')
    await user.click(tile(canvasElement, /Brakk/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Show without caption' }))
    await waitFor(() => expect(stageImage()).not.toBeNull())
    await expect(stageImage()).toEqual({
      id: OGRE.id,
      file: { collection: 'images', record: OGRE.id, name: 'image.webp' },
      caption: null,
      shownAt: expect.any(String),
    })
    const sent = JSON.stringify([...update.mock.calls, ...create.mock.calls])
    await expect(sent).toContain(OGRE.id)
    await expect(sent).not.toContain('Brakk')
    await expect(sent).not.toContain('scarred')
    await expect(JSON.stringify(storedRecords('stages'))).not.toContain('Brakk')
    // Shown without its caption, the master's own grid still names it, and the bar offers Hide only.
    await waitFor(() => expect(barButtons(canvasElement)).toEqual(['Hide', 'Edit', 'Delete']))
    await expect(captions(canvasElement)[2]).toBe('Brakk the ogre, scarred and sullen')
  },
}

/** Hide takes the image off the table. */
export const HideClears: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ shown: BRIDGE.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(tile(canvasElement, /The old bridge/))
    await expect(barButtons(canvasElement)).toEqual(['Hide', 'Edit', 'Delete'])
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Hide' }))
    await waitFor(() => expect(storedRecords('stages')).toHaveLength(1))
    await expect(stageImage()).toBeNull()
    await waitFor(() => expect(barButtons(canvasElement)).toEqual(['Show', 'Show without caption', 'Edit', 'Delete']))
    await expect(within(canvasElement).queryByText('Shown')).toBeNull()
  },
}

/** Showing another image while one is shown replaces it in one write. */
export const ShowAnotherReplaces: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ shown: BRIDGE.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(tile(canvasElement, /Brakk/))
    await expect(barButtons(canvasElement)).toEqual(['Show', 'Show without caption', 'Edit', 'Delete'])
    clearPbRequests()
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Show' }))
    await waitFor(() => expect(stageImage()?.id).toBe(OGRE.id))
    // The mock has no stage row yet, so the one publish is an update answered 404 and a create.
    await expect(pbRequests().filter(r => r === 'stages.update')).toHaveLength(1)
    await expect(tiles(canvasElement).filter(t => t.getAttribute('aria-current') === 'true')).toHaveLength(1)
    await expect(tile(canvasElement, /Brakk/)).toHaveAttribute('aria-current', 'true')
    await expect(tile(canvasElement, /The old bridge/)).not.toHaveAttribute('aria-current')
  },
}

/** While the selected image's switch is on its way its buttons are out; the grid and the upload button keep working. */
export const BusyOnlyTheSelectedImage: Story = {
  tags: ['no-visual'],
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    let release: () => void = () => {}
    spyOn(pb.collection('stages'), 'update').mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ id: crookhollow.id, updated: '' })
    }))
    spyOn(pb.collection('stages'), 'create').mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ id: crookhollow.id, created: '', updated: '' })
    }))
    await user.click(tile(canvasElement, /The old bridge/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Show' }))
    const actions = within(bar(canvasElement)!)
    await waitFor(() => expect(actions.getByRole('button', { name: 'Hide' })).toBeDisabled())
    await expect(actions.getByRole('button', { name: 'Edit' })).toBeDisabled()
    await expect(actions.getByRole('button', { name: 'Delete' })).toBeDisabled()
    await expect(within(canvasElement).getByRole('button', { name: 'Upload image' })).toBeEnabled()
    await user.click(tile(canvasElement, /Brakk/))
    await expect(tile(canvasElement, /Brakk/)).toBeChecked()
    await expect(within(bar(canvasElement)!).getByRole('button', { name: 'Show' })).toBeEnabled()
    release()
    await waitFor(() => expect(tile(canvasElement, /The old bridge/)).toHaveAttribute('aria-current', 'true'))
  },
}

/** A refused show gets the one message the stage writer shows, and the panel is as it was. */
export const ShowFailed: Story = {
  tags: ['no-visual'],
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    spyOn(pb.collection('stages'), 'create').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(tile(canvasElement, /The old bridge/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Show' }))
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await waitFor(() => expect(within(bar(canvasElement)!).getByRole('button', { name: 'Show' })).toBeEnabled())
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(toastTexts()).toEqual([STAGE_TOAST])
    await expect(tiles(canvasElement).filter(t => t.getAttribute('aria-current') === 'true')).toHaveLength(0)
    await expect(tile(canvasElement, /The old bridge/)).toBeChecked()
    await expect(useStageStore().stageOf(crookhollow.id).image).toBeNull()
  },
}

export const HideFailed: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ shown: BRIDGE.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    spyOn(pb.collection('stages'), 'create').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(tile(canvasElement, /The old bridge/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Hide' }))
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await waitFor(() => expect(within(bar(canvasElement)!).getByRole('button', { name: 'Hide' })).toBeEnabled())
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(toastTexts()).toEqual([STAGE_TOAST])
    await expect(tile(canvasElement, /The old bridge/)).toHaveAttribute('aria-current', 'true')
  },
}

/** Delete asks first, and a Cancel puts the focus back on the Delete button. */
export const DeleteAsksFirst: Story = {
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(tile(canvasElement, /No caption/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Delete' }))
    const dialog = await body(canvasElement).findByRole('dialog')
    await expect(within(dialog).getByText('Delete this image?')).toBeVisible()
    await expect(within(dialog).getByText('The image is removed with its file.')).toBeVisible()
    await expect(pbRequests()).not.toContain('images.delete')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await closed(canvasElement)
    await expect(tiles(canvasElement)).toHaveLength(3)
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(within(bar(canvasElement)!).getByRole('button', { name: 'Delete' })))
  },
}

/** Deleting the shown image says it will be hidden for everyone, takes it off the table first, then removes it. */
export const DeleteShownHidesFirst: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ shown: BRIDGE.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(tile(canvasElement, /The old bridge/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Delete' }))
    const dialog = await body(canvasElement).findByRole('dialog')
    await expect(within(dialog).getByText(/hidden for everyone/)).toBeVisible()
    clearPbRequests()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(captions(canvasElement)).toEqual(['No caption', 'Brakk the ogre, scarred and sullen']))
    const requests = pbRequests()
    const stageAt = Math.max(requests.indexOf('stages.update'), requests.indexOf('stages.create'))
    await expect(stageAt).toBeGreaterThanOrEqual(0)
    await expect(requests.indexOf('images.delete')).toBeGreaterThan(stageAt)
    await expect(stageImage()).toBeNull()
    await expect(storedRecords('images').map(r => r.id)).not.toContain(BRIDGE.id)
    await expect(useStageStore().stageOf(crookhollow.id).image).toBeNull()
    await closed(canvasElement)
    // The tile and its bar are gone: nothing is selected, and the focus goes to the tile that took its place.
    await expect(bar(canvasElement)).toBeNull()
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(tiles(canvasElement)[0]))
  },
}

/** A refused delete keeps the image, says so once, and the focus is back on Delete. */
export const DeleteFailed: Story = {
  tags: ['no-visual'],
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('images'), 'delete').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(tile(canvasElement, /No caption/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Delete' }))
    await user.click(within(await body(canvasElement).findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toContain('Couldn’t delete the image. Check your connection.'))
    await closed(canvasElement)
    await expect(tiles(canvasElement)).toHaveLength(3)
    await expect(tile(canvasElement, /No caption/)).toBeChecked()
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(within(bar(canvasElement)!).getByRole('button', { name: 'Delete' })))
    await expect(toastTexts()).toEqual(['Couldn’t delete the image. Check your connection.'])
  },
}

/** The shown image whose take-down is refused stays, with the stage writer's message alone. */
export const DeleteOfShownImageRefusedByTheStage: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ shown: BRIDGE.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(tile(canvasElement, /The old bridge/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Delete' }))
    await user.click(within(await body(canvasElement).findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await closed(canvasElement)
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(toastTexts()).toEqual([STAGE_TOAST])
    await expect(pbRequests()).not.toContain('images.delete')
    await expect(tiles(canvasElement)).toHaveLength(3)
  },
}

/** Deleting after the mastership went elsewhere says so in its own words. */
export const DeleteNotMaster: Story = {
  tags: ['no-visual'],
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    seedRecords('games', [{ id: crookhollow.id, name: crookhollow.name, master: 'user-seva', invite_code: crookhollow.inviteCode }])
    spyOn(pb.collection('images'), 'delete').mockRejectedValue(new ClientResponseError({ status: 404 }))
    await user.click(tile(canvasElement, /No caption/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Delete' }))
    await user.click(within(await body(canvasElement).findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toEqual(['You are not the master of this game any more.']))
  },
}

/** A new image goes into the grid, and the focus returns to the upload button. */
export const AddAnImage: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ images: [] }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sheet = body(canvasElement)
    await user.click(canvas.getByRole('button', { name: 'Upload image' }))
    await sheet.findByRole('dialog', { name: 'New image' })
    await user.upload(sheet.getByLabelText('Image', { selector: 'input' }), pictureFile('crypt.png'))
    await user.type(sheet.getByRole('textbox', { name: 'Caption' }), 'The crypt door')
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await closed(canvasElement)
    await waitFor(() => expect(captions(canvasElement)).toEqual(['The crypt door']))
    await expect(canvas.getByText('1 / 30')).toBeVisible()
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Upload image' })))
  },
}

/** Editing the shown image's picture re-publishes it with the same `shownAt`, so the table does not treat it as a new show. */
export const EditShownRepublishesSameShownAt: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ shown: BRIDGE.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    const before = useStageStore().stageOf(crookhollow.id).image!.shownAt
    await user.click(tile(canvasElement, /The old bridge/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Edit' }))
    await sheet.findByRole('dialog', { name: 'Edit image' })
    await user.click(sheet.getByRole('button', { name: 'Remove file: Image' }))
    await user.upload(sheet.getByLabelText('Image', { selector: 'input' }), pictureFile('cellar.png'))
    const caption = sheet.getByRole('textbox', { name: 'Caption' })
    await user.clear(caption)
    await user.type(caption, 'The new bridge')
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
    await expect(sentForms()[0]!.method).toBe('PATCH')
    await waitFor(() => expect(stageImage()?.file).toEqual({ collection: 'images', record: BRIDGE.id, name: 'image.png' }))
    await expect(stageImage()).toEqual({
      id: BRIDGE.id,
      file: { collection: 'images', record: BRIDGE.id, name: 'image.png' },
      caption: 'The new bridge',
      shownAt: before,
    })
    await waitFor(() => expect(captions(canvasElement)[0]).toBe('The new bridge'))
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(within(bar(canvasElement)!).getByRole('button', { name: 'Edit' })))
  },
}

/** A caption edited on an image shown without it never reaches the table: the stage is not written at all. */
export const EditCaptionOfImageShownWithoutOneWritesNothing: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ shown: BRIDGE.id, withoutCaption: true }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await user.click(tile(canvasElement, /The old bridge/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Edit' }))
    await sheet.findByRole('dialog', { name: 'Edit image' })
    const caption = sheet.getByRole('textbox', { name: 'Caption' })
    await user.clear(caption)
    await user.type(caption, 'A secret the players must not read')
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
    await waitFor(() => expect(captions(canvasElement)[0]).toBe('A secret the players must not read'))
    await expect(pbRequests().filter(r => r.startsWith('stages.'))).toEqual([])
    await expect(useStageStore().stageOf(crookhollow.id).image!.caption).toBeNull()
  },
}

/** A player's table: no images are asked for, and a card that was open shows nothing, nor does the row. */
export const PlayerRequestsNothing: Story = {
  tags: ['no-visual'],
  render: () => ({
    components: {},
    setup() {
      useMediaSession()
      useToolPanelsStore().open.images = true
      onUnmounted(closeMedia)
      return { cards: useTrayCards().cards }
    },
    template: '<div><component :is="c.component" v-for="c in cards" :key="c.key" /><p>player table</p></div>',
  }),
  decorators: [withImages({ status: 'idle' }), withGameTable(olden, [], {})],
  loaders: [atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    resetRecords('images', [imageRow(BRIDGE, olden.id)])
    await new Promise(resolve => setTimeout(resolve, 200))
    await expect(within(canvasElement).getByText('player table')).toBeVisible()
    await expect(within(canvasElement).queryByRole('region', { name: 'Images' })).toBeNull()
    await expect(pbRequests().filter(r => r.startsWith('images.'))).toEqual([])
    await expect(useMediaStore().images.status).toBe('idle')
  },
}

/** The control of the story above: the same harness at a table whose master I am does ask for the images. */
export const MasterRequestsImages: Story = {
  tags: ['no-visual'],
  render: () => ({
    components: {},
    setup() {
      useMediaSession()
      useToolPanelsStore().open.images = true
      onUnmounted(closeMedia)
      return { cards: useTrayCards().cards }
    },
    template: '<div><component :is="c.component" v-for="c in cards" :key="c.key" /></div>',
  }),
  decorators: [withImages({ status: 'idle' }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(useMediaStore().images.status).toBe('ready'))
    await expect(pbRequests().filter(r => r.startsWith('images.'))).not.toEqual([])
    await expect(await within(canvasElement).findByRole('region', { name: 'Images' })).toBeVisible()
    await waitFor(() => expect(tiles(canvasElement)).toHaveLength(3))
  },
}

/** The tiles ask the server for the one thumbnail the collection configures, never another size (which would send the original). */
export const TilesAskForTheConfiguredThumbnail: Story = {
  tags: ['no-visual'],
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async () => {
    const recorded = recordImageSources()
    try {
      useMediaStore().setList('images', crookhollow.id, [{ ...BRIDGE, file: 'image-other.jpg' }, { ...MAP, file: 'image-other.png' }, OGRE])
      await waitFor(() => expect(recorded.urls.length).toBeGreaterThanOrEqual(2))
      for (const url of recorded.urls) await expect(url).toMatch(/thumb=320x0$/)
    } finally {
      recorded.restore()
    }
  },
}

/** The action bar is named after the selected image: its caption, or its place when it has none. */
export const BarIsNamedAfterTheImage: Story = {
  tags: ['no-visual'],
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await user.click(tile(canvasElement, /The old bridge/))
    await expect(canvas.getByRole('group', { name: 'Selected image: The old bridge at dusk' })).toBeVisible()
    await user.click(tile(canvasElement, /No caption/))
    await expect(canvas.getByRole('group', { name: 'Selected image: image 2 of 3' })).toBeVisible()
  },
}

/** Tiles without a caption are told apart by their place, and the shown one says so. */
export const TilesAreNamedByPlaceAndShown: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ images: [MAP, { ...MAP, id: 'story-image-map-2' }, BRIDGE], shown: 'story-image-map-2' }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await expect(tile(canvasElement, 'No caption, image 1 of 3')).toBeVisible()
    await expect(tile(canvasElement, 'No caption, image 2 of 3, shown')).toBeVisible()
    await expect(tile(canvasElement, 'The old bridge at dusk')).toBeVisible()
  },
}

/** After deleting the selected tile the focus goes to the tile that took its place; the upload button only when none is left. */
export const DeleteMovesFocusToTheGrid: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ images: [BRIDGE, MAP] }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const remove = async (caption: string | RegExp) => {
      await user.click(tile(canvasElement, caption))
      await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Delete' }))
      await user.click(within(await body(canvasElement).findByRole('dialog')).getByRole('button', { name: 'Delete' }))
      await closed(canvasElement)
    }
    await remove(/The old bridge/)
    await waitFor(() => expect(tiles(canvasElement)).toHaveLength(1))
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(tile(canvasElement, /No caption/)))
    await remove(/No caption/)
    await waitFor(() => expect(tiles(canvasElement)).toHaveLength(0))
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(within(canvasElement).getByRole('button', { name: 'Upload image' })))
  },
}

/** A refused "Show without caption" leaves the focus on that button. */
export const FailedShowWithoutCaptionKeepsFocus: Story = {
  tags: ['no-visual'],
  decorators: [withImages(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    spyOn(pb.collection('stages'), 'create').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(tile(canvasElement, /The old bridge/))
    await user.click(within(bar(canvasElement)!).getByRole('button', { name: 'Show without caption' }))
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await new Promise(resolve => setTimeout(resolve, 100))
    // The button may be a new element after the rollback: what counts is that the focus is on "Show without caption".
    const plain = within(bar(canvasElement)!).getByRole('button', { name: 'Show without caption' })
    await expect(plain).toBeEnabled()
    await expect(canvasElement.ownerDocument.activeElement).toBe(plain)
  },
}

const noticeText = 'An image that is no longer in the gallery is on the table.'

/** The shown image is not in the gallery: a notice with Hide, so the master can always clear the table. */
export const OrphanedShownImageCanBeHidden: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ shown: BRIDGE.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText(noticeText)).toBeNull()
    useMediaStore().setList('images', crookhollow.id, [MAP, OGRE])
    const notice = await canvas.findByRole('alert')
    await expect(notice).toHaveTextContent(noticeText)
    await user.click(within(notice).getByRole('button', { name: 'Hide' }))
    await waitFor(() => expect(stageImage()).toBeNull())
    await waitFor(() => expect(canvas.queryByText(noticeText)).toBeNull())
    await expect(toastTexts()).toEqual([])
    // The notice and its button are gone: the focus goes to the panel's upload button, not to the page.
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Upload image' })))
  },
}

/** The same notice when the list did not load at all. */
export const OrphanNoticeWhenTheListFailed: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ images: [BRIDGE], shown: BRIDGE.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    useMediaStore().setList('images', crookhollow.id, [])
    useMediaStore().setFailed('images', crookhollow.id)
    await expect(await within(canvasElement).findByText(noticeText)).toBeVisible()
    await expect(within(canvasElement).getByRole('button', { name: 'Hide' })).toBeEnabled()
  },
}

/** A refused hide from the notice gives the stage writer's message alone, and the notice stays. */
export const OrphanHideFailed: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ images: [BRIDGE, MAP], shown: BRIDGE.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    useMediaStore().setList('images', crookhollow.id, [MAP])
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    spyOn(pb.collection('stages'), 'create').mockRejectedValue(new ClientResponseError({ status: 500 }))
    const canvas = within(canvasElement)
    await user.click(await canvas.findByRole('button', { name: 'Hide' }))
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(toastTexts()).toEqual([STAGE_TOAST])
    await expect(canvas.getByText(noticeText)).toBeVisible()
  },
}

/** No notice while the shown image is in the grid, or nothing is shown. */
export const NoNoticeWhileTheShownImageIsListed: Story = {
  tags: ['no-visual'],
  decorators: [withImages({ shown: BRIDGE.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(noticeText)).toBeNull()
    await expect(within(canvasElement).queryByRole('alert')).toBeNull()
  },
}
