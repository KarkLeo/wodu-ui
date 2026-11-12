import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { defineComponent, onUnmounted } from 'vue'
import ScenesPanel from './ScenesPanel.vue'
import { useMediaSession } from '@/composables/useMediaSession'
import { useTrayCards } from '@/composables/useTrayCards'
import { crookhollow, CROOKHOLLOW_META, olden, PARTY } from '@/stories/fixtures'
import { manyScenes, pictureFile, SCENES, sceneRow, TAVERN, withScenes } from '@/stories/scenes'
import { atRoute, withGameTable } from '@/stories/state'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { useToastsStore } from '@/stores/toasts'
import { useToolPanelsStore } from '@/stores/toolPanels'
import { closeMedia } from '@/transport/media'
import { clearPbRequests, pb, pbRequests, resetRecords, seedRecords, storedRecords } from '../../../.storybook/mocks/pb'
import { sentForms } from '../../../.storybook/mocks/upload'

const [, FOREST] = SCENES as [typeof TAVERN, typeof TAVERN, typeof TAVERN]

const card: Decorator = (story) => ({
  components: { story },
  template: '<div style="width: min(440px, 100vw - 32px); height: 640px"><story /></div>',
})

const asMaster = withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)
const route = atRoute(`/games/${crookhollow.id}`)

const meta = {
  title: 'Features/Stage/ScenesPanel',
  component: ScenesPanel,
  parameters: { layout: 'centered' },
  decorators: [card],
} satisfies Meta<typeof ScenesPanel>

export default meta
type Story = StoryObj<typeof meta>

const body = (el: HTMLElement) => within(el.ownerDocument.body)
const user = userEvent.setup({ applyAccept: false })
const rowOf = (el: HTMLElement, name: string) => {
  const li = within(el).getAllByRole('listitem').find(item => within(item).queryByText(name) !== null)
  if (!li) throw new Error(`no row for ${name}`)
  return within(li)
}
const names = (el: HTMLElement) => within(el).getAllByRole('listitem').map(li => li.querySelector('.sr-name')?.textContent)
const stageScene = () => (storedRecords('stages')[0]?.data as { scene: { id: string; image: { name: string } | null; sound: { name: string } | null } | null } | undefined)?.scene
const toastTexts = () => useToastsStore().items.map(t => t.text)
const STAGE_TOAST = 'Could not change what is shown at the table. Try again.'
const closed = (el: HTMLElement) => waitFor(() => expect(body(el).queryByRole('dialog')).toBeNull())

/** Three scenes, one of them on at the table, with the count and the add button. */
export const Default: Story = {
  decorators: [withScenes({ live: TAVERN.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Scenes' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Scenes' })).toBeVisible()
    await expect(canvas.getByText('3 / 20')).toBeVisible()
    await expect(canvas.getByRole('list')).toBeVisible()
    await expect(names(canvasElement)).toEqual(['Tavern', 'Night forest', 'Rain'])
    await expect(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Turn off' })).toBeVisible()
    await expect(rowOf(canvasElement, 'Night forest').getByRole('button', { name: 'Turn on' })).toBeVisible()
    await expect(canvas.getAllByRole('listitem').filter(li => li.getAttribute('aria-current') === 'true')).toHaveLength(1)
    await expect(canvas.getByRole('button', { name: 'Scene' })).toBeEnabled()
  },
}

/** No scenes yet: a one-line hint, and the add button still works. */
export const Empty: Story = {
  decorators: [withScenes({ scenes: [] }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/No scenes yet/)).toBeVisible()
    await expect(canvas.getByText('0 / 20')).toBeVisible()
    await expect(canvas.queryByRole('list')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Scene' })).toBeEnabled()
  },
}

export const Loading: Story = {
  tags: ['no-visual'],
  decorators: [withScenes({ status: 'loading' }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Loading scenes…')
    await expect(within(canvasElement).queryByRole('list')).toBeNull()
  },
}

// The store holds another game's scenes, as it does for a master of two games who has just moved to the second.
const holdingOtherGame: Decorator = (story) => ({
  components: { story },
  setup() {
    const media = useMediaStore()
    media.clearAll()
    media.startLoading(olden.id)
    media.setScenes(olden.id, structuredClone(SCENES))
  },
  template: '<story />',
})

/** Another game's scenes are never listed, and nothing can turn one of them on at this table. */
export const OtherGamesScenesAreNotShown: Story = {
  tags: ['no-visual'],
  decorators: [holdingOtherGame, withScenes({ status: 'idle' }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading scenes…')
    await expect(canvas.queryByRole('list')).toBeNull()
    await expect(canvas.queryByRole('button', { name: 'Turn on' })).toBeNull()
    await expect(canvas.queryByText('Tavern')).toBeNull()
  },
}

const SessionHarness = defineComponent({
  components: { ScenesPanel },
  setup() {
    useMediaSession()
    onUnmounted(closeMedia)
  },
  template: '<ScenesPanel />',
})

/** The load failed: a note and Try again, which loads the list. */
export const LoadFailedTryAgain: Story = {
  tags: ['no-visual'],
  render: () => ({ components: { SessionHarness }, template: '<SessionHarness />' }),
  decorators: [(story) => ({
    components: { story },
    setup() {
      spyOn(pb.collection('scenes'), 'getFullList').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    },
    template: '<story />',
  }), withScenes({ status: 'idle' }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Couldn’t load the scenes.')
    await expect(canvas.queryByRole('list')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(names(canvasElement)).toEqual(['Tavern', 'Night forest', 'Rain']))
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

/** Twenty scenes: the add button is out and a note says why. */
export const AtTheLimit: Story = {
  decorators: [withScenes({ scenes: manyScenes(20) }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('20 / 20')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Scene' })).toBeDisabled()
    await expect(canvas.getByText(/reached the limit of 20 scenes/)).toBeVisible()
  },
}

/** Turning a scene on writes the stage with this scene's two file references and no name. */
export const TurnOnPublishes: Story = {
  tags: ['no-visual'],
  decorators: [withScenes(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Turn on' }))
    await waitFor(() => expect(stageScene()).not.toBeNull())
    await expect(storedRecords('stages')[0]!.data).toEqual({
      id: crookhollow.id,
      scene: {
        id: TAVERN.id,
        image: { collection: 'scenes', record: TAVERN.id, name: 'image.jpg' },
        sound: { collection: 'scenes', record: TAVERN.id, name: 'sound.mp3' },
      },
      image: null,
      sound: null,
    })
    await expect(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Turn off' })).toBeEnabled()
  },
}

/** Turning another scene on replaces the one that is on. */
export const SwitchReplaces: Story = {
  tags: ['no-visual'],
  decorators: [withScenes({ live: TAVERN.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(rowOf(canvasElement, 'Night forest').getByRole('button', { name: 'Turn on' }))
    await waitFor(() => expect(stageScene()?.id).toBe(FOREST.id))
    await expect(stageScene()).toEqual({
      id: FOREST.id,
      image: { collection: 'scenes', record: FOREST.id, name: 'image.png' },
      sound: null,
    })
    await waitFor(() => expect(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Turn on' })).toBeVisible())
    await expect(rowOf(canvasElement, 'Night forest').getByRole('button', { name: 'Turn off' })).toBeVisible()
    await expect(within(canvasElement).getAllByRole('button', { name: 'Turn off' })).toHaveLength(1)
  },
}

/** Turning off writes a stage with no scene. */
export const TurnOff: Story = {
  tags: ['no-visual'],
  decorators: [withScenes({ live: TAVERN.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Turn off' }))
    await waitFor(() => expect(storedRecords('stages')).toHaveLength(1))
    await waitFor(() => expect(stageScene()).toBeNull())
    await expect(within(canvasElement).queryByRole('button', { name: 'Turn off' })).toBeNull()
    await expect(within(canvasElement).getAllByRole('button', { name: 'Turn on' })).toHaveLength(3)
  },
}

/** While a row's change is on its way its buttons are out; the other rows keep working. */
export const BusyRowOnly: Story = {
  tags: ['no-visual'],
  decorators: [withScenes(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    let release: () => void = () => {}
    spyOn(pb.collection('stages'), 'update').mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ id: crookhollow.id, updated: '' })
    }))
    await user.click(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Turn on' }))
    const tavern = rowOf(canvasElement, 'Tavern')
    await waitFor(() => expect(tavern.getByRole('button', { name: 'Turn off' })).toBeDisabled())
    await expect(tavern.getByRole('button', { name: 'Edit Tavern' })).toBeDisabled()
    await expect(tavern.getByRole('button', { name: 'Delete Tavern' })).toBeDisabled()
    await expect(rowOf(canvasElement, 'Rain').getByRole('button', { name: 'Turn on' })).toBeEnabled()
    await expect(rowOf(canvasElement, 'Rain').getByRole('button', { name: 'Edit Rain' })).toBeEnabled()
    release()
    await waitFor(() => expect(tavern.getByRole('button', { name: 'Turn off' })).toBeEnabled())
  },
}

/** A refused turn-on gets the one message the stage writer shows, and the row is usable again. */
export const TurnOnFailed: Story = {
  tags: ['no-visual'],
  decorators: [withScenes(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Turn on' }))
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await waitFor(() => expect(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Turn on' })).toBeEnabled())
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(toastTexts()).toEqual([STAGE_TOAST])
  },
}

export const TurnOffFailed: Story = {
  tags: ['no-visual'],
  decorators: [withScenes({ live: TAVERN.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    spyOn(pb.collection('stages'), 'create').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Turn off' }))
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await waitFor(() => expect(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Turn off' })).toBeEnabled())
  },
}

/** Delete asks first, and says what happens to a scene that is on. */
export const DeleteAsksFirst: Story = {
  decorators: [withScenes(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(rowOf(canvasElement, 'Rain').getByRole('button', { name: 'Delete Rain' }))
    const dialog = await body(canvasElement).findByRole('dialog')
    await expect(within(dialog).getByText('Delete Rain?')).toBeVisible()
    await expect(within(dialog).getByText(/default background/)).toBeVisible()
    await expect(pbRequests()).not.toContain('scenes.delete')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await closed(canvasElement)
    await expect(names(canvasElement)).toContain('Rain')
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(rowOf(canvasElement, 'Rain').getByRole('button', { name: 'Delete Rain' })))
  },
}

/** Deleting a scene that is on takes it off the table first, then removes it. */
export const DeleteLiveSceneClearsTheStageFirst: Story = {
  tags: ['no-visual'],
  decorators: [withScenes({ live: TAVERN.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Delete Tavern' }))
    const dialog = await body(canvasElement).findByRole('dialog')
    clearPbRequests()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(names(canvasElement)).toEqual(['Night forest', 'Rain']))
    const requests = pbRequests()
    const stageAt = Math.max(requests.indexOf('stages.update'), requests.indexOf('stages.create'))
    await expect(stageAt).toBeGreaterThanOrEqual(0)
    await expect(requests.indexOf('scenes.delete')).toBeGreaterThan(stageAt)
    await expect(stageScene()).toBeNull()
    await expect(storedRecords('scenes').map(r => r.id)).not.toContain(TAVERN.id)
    await expect(useStageStore().stageOf(crookhollow.id).scene).toBeNull()
    await closed(canvasElement)
    // The row is gone, so the focus goes to the add button.
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(within(canvasElement).getByRole('button', { name: 'Scene' })))
  },
}

/** A refused delete keeps the row and says so. */
export const DeleteFailed: Story = {
  tags: ['no-visual'],
  decorators: [withScenes(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('scenes'), 'delete').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(rowOf(canvasElement, 'Rain').getByRole('button', { name: 'Delete Rain' }))
    await user.click(within(await body(canvasElement).findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toContain('Couldn’t delete the scene. Check your connection.'))
    await closed(canvasElement)
    await expect(names(canvasElement)).toContain('Rain')
    await expect(rowOf(canvasElement, 'Rain').getByRole('button', { name: 'Delete Rain' })).toBeEnabled()
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(rowOf(canvasElement, 'Rain').getByRole('button', { name: 'Delete Rain' })))
    await expect(toastTexts()).toEqual(['Couldn’t delete the scene. Check your connection.'])
  },
}

/** A live scene whose take-off is refused stays, with the stage writer's message alone. */
export const DeleteOfLiveSceneRefusedByTheStage: Story = {
  tags: ['no-visual'],
  decorators: [withScenes({ live: TAVERN.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Delete Tavern' }))
    await user.click(within(await body(canvasElement).findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await closed(canvasElement)
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(toastTexts()).toEqual([STAGE_TOAST])
    await expect(pbRequests()).not.toContain('scenes.delete')
    await expect(names(canvasElement)).toContain('Tavern')
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Delete Tavern' })))
  },
}

/** Deleting after the mastership went elsewhere says so in its own words. */
export const DeleteNotMaster: Story = {
  tags: ['no-visual'],
  decorators: [withScenes(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    seedRecords('games', [{ id: crookhollow.id, name: crookhollow.name, master: 'user-seva', invite_code: crookhollow.inviteCode }])
    spyOn(pb.collection('scenes'), 'delete').mockRejectedValue(new ClientResponseError({ status: 404 }))
    await user.click(rowOf(canvasElement, 'Rain').getByRole('button', { name: 'Delete Rain' }))
    await user.click(within(await body(canvasElement).findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toEqual(['You are not the master of this game any more.']))
  },
}

/** Three quick switches with a slow server: the table ends on the last one, two writes go out, every row works again. */
export const FastSwitchingWritesTwice: Story = {
  tags: ['no-visual'],
  decorators: [withScenes(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const release: Array<() => void> = []
    const update = spyOn(pb.collection('stages'), 'update').mockImplementation(() => new Promise((resolve) => {
      release.push(() => resolve({ id: crookhollow.id, updated: '' }))
    }))
    const buttons = ['Tavern', 'Night forest', 'Rain'].map(n => rowOf(canvasElement, n).getByRole('button', { name: 'Turn on' }))
    for (const b of buttons) b.click()
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    await expect(useStageStore().stageOf(crookhollow.id).scene?.id).toBe('story-scene-rain')
    release[0]!()
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    release[1]!()
    await waitFor(() => expect(rowOf(canvasElement, 'Rain').getByRole('button', { name: 'Turn off' })).toBeEnabled())
    const sent = update.mock.calls.map(c => (c[1] as { data: { scene: { id: string } } }).data.scene.id)
    await expect(sent).toEqual(['story-scene-tavern', 'story-scene-rain'])
    for (const li of within(canvasElement).getAllByRole('listitem')) {
      for (const button of within(li).getAllByRole('button')) await expect(button).toBeEnabled()
    }
    await expect(within(canvasElement).getAllByRole('button', { name: 'Turn off' })).toHaveLength(1)
    await expect(toastTexts()).toEqual([])
  },
}

/** The same with a refused write: one message, the highlight back on the last confirmed scene. */
export const FastSwitchingFailsOnce: Story = {
  tags: ['no-visual'],
  decorators: [withScenes({ live: TAVERN.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    const forest = rowOf(canvasElement, 'Night forest').getByRole('button', { name: 'Turn on' })
    const rain = rowOf(canvasElement, 'Rain').getByRole('button', { name: 'Turn on' })
    forest.click()
    rain.click()
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await waitFor(() => expect(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Turn off' })).toBeEnabled())
    await expect(useStageStore().stageOf(crookhollow.id).scene?.id).toBe(TAVERN.id)
    for (const name of ['Night forest', 'Rain']) await expect(rowOf(canvasElement, name).getByRole('button', { name: 'Turn on' })).toBeEnabled()
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(toastTexts()).toEqual([STAGE_TOAST])
  },
}

/** Renaming the scene that is on changes no file, so the table is not written to. */
export const RenamingTheLiveSceneLeavesTheStage: Story = {
  tags: ['no-visual'],
  decorators: [withScenes({ live: TAVERN.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await user.click(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Edit Tavern' }))
    await sheet.findByRole('dialog', { name: 'Edit scene' })
    const name = sheet.getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'Inn')
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
    await waitFor(() => expect(names(canvasElement)).toContain('Inn'))
    await expect(pbRequests().filter(r => r.startsWith('stages.'))).toEqual([])
    await expect(rowOf(canvasElement, 'Inn').getByRole('button', { name: 'Turn off' })).toBeVisible()
  },
}

/** A new scene goes into the list, and the focus returns to the add button. */
export const AddAScene: Story = {
  tags: ['no-visual'],
  decorators: [withScenes({ scenes: [] }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sheet = body(canvasElement)
    await user.click(canvas.getByRole('button', { name: 'Scene' }))
    await sheet.findByRole('dialog', { name: 'New scene' })
    await user.type(sheet.getByRole('textbox', { name: 'Name' }), 'Crypt')
    await user.upload(sheet.getByLabelText('Picture', { selector: 'input' }), pictureFile('crypt.png'))
    await user.click(sheet.getByRole('button', { name: 'Add' }))
    await closed(canvasElement)
    await waitFor(() => expect(names(canvasElement)).toEqual(['Crypt']))
    await expect(canvas.getByText('1 / 20')).toBeVisible()
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Scene' })))
  },
}

/** Editing renames the scene in the list, and the focus returns to its edit button. */
export const EditAScene: Story = {
  tags: ['no-visual'],
  decorators: [withScenes(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await user.click(rowOf(canvasElement, 'Rain').getByRole('button', { name: 'Edit Rain' }))
    await sheet.findByRole('dialog', { name: 'Edit scene' })
    const name = sheet.getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'Downpour')
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
    await waitFor(() => expect(names(canvasElement)).toEqual(['Tavern', 'Night forest', 'Downpour']))
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(rowOf(canvasElement, 'Downpour').getByRole('button', { name: 'Edit Downpour' })))
    await expect(sentForms()[0]!.files).toEqual({})
    await expect(stageScene()).toBeUndefined()
  },
}

/** Closing the sheet without saving puts the focus back on the row's edit button. */
export const CancelReturnsFocus: Story = {
  tags: ['no-visual'],
  decorators: [withScenes(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(rowOf(canvasElement, 'Night forest').getByRole('button', { name: 'Edit Night forest' }))
    const sheet = body(canvasElement)
    await sheet.findByRole('dialog', { name: 'Edit scene' })
    await user.click(sheet.getByRole('button', { name: 'Cancel' }))
    await closed(canvasElement)
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(rowOf(canvasElement, 'Night forest').getByRole('button', { name: 'Edit Night forest' })))
  },
}

/** Changing the files of the scene that is on gives the table the new ones. */
export const EditLiveSceneRepublishes: Story = {
  tags: ['no-visual'],
  decorators: [withScenes({ live: TAVERN.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await user.click(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Edit Tavern' }))
    await sheet.findByRole('dialog', { name: 'Edit scene' })
    await user.click(sheet.getByRole('button', { name: 'Remove file: Picture' }))
    await user.upload(sheet.getByLabelText('Picture', { selector: 'input' }), pictureFile('cellar.png'))
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
    await expect(sentForms()[0]!.method).toBe('PATCH')
    await expect(sentForms()[0]!.files.image!.name).toBe('image.png')
    await waitFor(() => expect(stageScene()?.image?.name).toBe('image.png'))
    await expect(stageScene()!.sound!.name).toBe('sound.mp3')
    await expect(stageScene()!.id).toBe(TAVERN.id)
  },
}

/** The scene is saved but the table did not get it: the sheet says so and offers to try again. */
export const PublishFailedAfterSave: Story = {
  tags: ['no-visual'],
  decorators: [withScenes({ live: TAVERN.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    const stages = spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(rowOf(canvasElement, 'Tavern').getByRole('button', { name: 'Edit Tavern' }))
    await sheet.findByRole('dialog', { name: 'Edit scene' })
    await user.upload(sheet.getByLabelText('Picture', { selector: 'input' }), pictureFile('cellar.png'))
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await expect(await sheet.findByRole('alert')).toHaveTextContent('The scene is saved, but the table was not updated.')
    await expect(sheet.getByRole('dialog')).toBeVisible()
    await expect(sheet.queryByRole('button', { name: 'Save' })).toBeNull()
    await expect(storedRecords('scenes').find(r => r.id === TAVERN.id)).toMatchObject({ image: 'image.png' })
    // Another try while the server still refuses keeps the sheet open and says so.
    await user.click(sheet.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(sheet.getByRole('alert')).toHaveTextContent('the table still was not updated'))
    await expect(sheet.getByRole('dialog')).toBeVisible()
    stages.mockRestore()
    await user.click(sheet.getByRole('button', { name: 'Try again' }))
    await closed(canvasElement)
    await waitFor(() => expect(stageScene()?.image?.name).toBe('image.png'))
  },
}

/** Eighty characters in a 440 px card: one line ending in an ellipsis, buttons all in place. */
export const LongName: Story = {
  decorators: [withScenes({ scenes: [{ ...TAVERN, name: 'The long and winding road through the Mourning Marshes toward the drowned bell tower' }, ...SCENES.slice(1)], live: TAVERN.id }), asMaster],
  loaders: [route],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const li = within(canvasElement).getAllByRole('listitem')[0]!
    const name = li.querySelector<HTMLElement>('.sr-name')!
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
    await expect(name.getBoundingClientRect().height).toBeLessThan(24)
    const box = li.getBoundingClientRect()
    const card = canvasElement.querySelector('section')!.getBoundingClientRect()
    await expect(card.width).toBeGreaterThan(400)
    for (const button of within(li).getAllByRole('button')) {
      const rect = button.getBoundingClientRect()
      await expect(rect.right).toBeLessThanOrEqual(box.right + 0.5)
      await expect(rect.left).toBeGreaterThanOrEqual(box.left)
      await expect(rect.width).toBeGreaterThan(20)
    }
  },
}

/** A player's table: no scenes are asked for, and a card that was open shows nothing. */
export const PlayerRequestsNothing: Story = {
  tags: ['no-visual'],
  render: () => ({
    components: {},
    setup() {
      useMediaSession()
      useToolPanelsStore().open.scenes = true
      onUnmounted(closeMedia)
      return { cards: useTrayCards().cards }
    },
    template: '<div><component :is="c.component" v-for="c in cards" :key="c.key" /><p>player table</p></div>',
  }),
  decorators: [withScenes({ status: 'idle' }), withGameTable(olden, [], {})],
  loaders: [atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    resetRecords('scenes', [sceneRow(TAVERN, olden.id)])
    await new Promise(resolve => setTimeout(resolve, 200))
    await expect(within(canvasElement).getByText('player table')).toBeVisible()
    await expect(within(canvasElement).queryByRole('region', { name: 'Scenes' })).toBeNull()
    await expect(pbRequests().filter(r => r.startsWith('scenes.'))).toEqual([])
    await expect(useMediaStore().scenes.status).toBe('idle')
  },
}
