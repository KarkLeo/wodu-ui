import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import { defineComponent, onUnmounted } from 'vue'
import SoundsPanel from './SoundsPanel.vue'
import { useMediaSession } from '@/composables/useMediaSession'
import { useTrayCards } from '@/composables/useTrayCards'
import { crookhollow, CROOKHOLLOW_META, olden, PARTY, STORY_NOW } from '@/stories/fixtures'
import { soundFile } from '@/stories/scenes'
import { BRAWL, HEARTH, manySounds, SOUNDS, soundRow, withSounds } from '@/stories/sounds'
import { atRoute, withGameTable } from '@/stories/state'
import { useMediaStore } from '@/stores/media'
import { useStageStore } from '@/stores/stage'
import { useToastsStore } from '@/stores/toasts'
import { useToolPanelsStore } from '@/stores/toolPanels'
import { closeMedia } from '@/transport/media'
import { RECORDED } from '@/transport/recordedResponses'
import { clearPbRequests, pb, pbRequests, resetRecords, seedRecords, storedRecords } from '../../../.storybook/mocks/pb'
import { failUploadsWith, holdUploads, sentForms } from '../../../.storybook/mocks/upload'

const ROAR = SOUNDS[2]!

const card: Decorator = (story) => ({
  components: { story },
  template: '<div style="width: min(440px, 100vw - 32px); height: 640px"><story /></div>',
})

const asMaster = withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)
const route = atRoute(`/games/${crookhollow.id}`)

const meta = {
  title: 'Features/Stage/SoundsPanel',
  component: SoundsPanel,
  parameters: { layout: 'centered' },
  decorators: [card],
} satisfies Meta<typeof SoundsPanel>

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
type StageSoundData = { id: string; file: { collection: string; record: string; name: string }; loop: boolean; startedAt: string }
const stageSound = () => (storedRecords('stages')[0]?.data as { sound: StageSoundData | null } | undefined)?.sound
const toastTexts = () => useToastsStore().items.map(t => t.text)
const STAGE_TOAST = 'The change did not reach the table. Try again.'
// The preview freezes the clock; a later start needs a later time. The preview puts the real clock back after the story.
function advanceClock(ms: number) {
  const frozen = globalThis.Date
  class Later extends frozen {
    constructor(...args: ConstructorParameters<DateConstructor> | []) {
      if (args.length === 0) super(STORY_NOW + ms)
      else super(...(args as ConstructorParameters<DateConstructor>))
    }
    static override now() { return STORY_NOW + ms }
  }
  globalThis.Date = Later as DateConstructor
}
const closed = (el: HTMLElement) => waitFor(() => expect(body(el).queryByRole('dialog')).toBeNull())
const playButton = (el: HTMLElement, name: string) => rowOf(el, name).getByRole('button', { name: `Play ${name}` })
const stopButton = (el: HTMLElement, name: string) => rowOf(el, name).getByRole('button', { name: `Stop ${name}` })

/** Three sounds, one of them playing at the table, with the count and the upload button. */
export const Default: Story = {
  decorators: [withSounds({ playing: BRAWL.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Sounds' })).toBeVisible()
    await expect(canvas.getByRole('heading', { name: 'Sounds' })).toBeVisible()
    await expect(canvas.getByText('3 / 15')).toBeVisible()
    await expect(names(canvasElement)).toEqual(['Hum and hearth', 'Tavern brawl', 'Ogre roar'])
    await expect(stopButton(canvasElement, 'Tavern brawl')).toBeVisible()
    await expect(playButton(canvasElement, 'Hum and hearth')).toBeVisible()
    await expect(canvas.getAllByRole('listitem').filter(li => li.getAttribute('aria-current') === 'true')).toHaveLength(1)
    await expect(canvas.getByText('Plays for everyone')).toBeVisible()
    for (const button of canvas.getAllByRole('button', { name: /^(Play|Stop) / })) await expect(button).not.toHaveAttribute('aria-pressed')
    await expect(canvas.getAllByRole('switch', { name: /^Loop: / })).toHaveLength(3)
    await expect(canvas.getByRole('button', { name: 'Upload sound' })).toBeEnabled()
  },
}

/** No sounds yet: a one-line hint, and the upload button still works. */
export const Empty: Story = {
  decorators: [withSounds({ sounds: [] }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/No sounds yet/)).toBeVisible()
    await expect(canvas.getByText('0 / 15')).toBeVisible()
    await expect(canvas.queryByRole('list')).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Upload sound' })).toBeEnabled()
  },
}

export const Loading: Story = {
  tags: ['no-visual'],
  decorators: [withSounds({ status: 'loading' }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Loading sounds…')
    await expect(within(canvasElement).queryByRole('list')).toBeNull()
  },
}

// The store holds another game's sounds, as it does for a master of two games who has just moved to the second.
const holdingOtherGame: Decorator = (story) => ({
  components: { story },
  setup() {
    const media = useMediaStore()
    media.clearAll()
    media.startLoading(olden.id, ['sounds'])
    media.setList('sounds', olden.id, structuredClone(SOUNDS))
  },
  template: '<story />',
})

/** Another game's sounds are never listed, and nothing can play one of them at this table. */
export const OtherGamesSoundsAreNotShown: Story = {
  tags: ['no-visual'],
  decorators: [holdingOtherGame, withSounds({ status: 'idle' }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading sounds…')
    await expect(canvas.queryByRole('list')).toBeNull()
    await expect(canvas.queryByText('Tavern brawl')).toBeNull()
  },
}

const SessionHarness = defineComponent({
  components: { SoundsPanel },
  setup() {
    useMediaSession()
    onUnmounted(closeMedia)
  },
  template: '<SoundsPanel />',
})

/** The load failed: a note and Try again, which loads the list. */
export const LoadFailedTryAgain: Story = {
  tags: ['no-visual'],
  render: () => ({ components: { SessionHarness }, template: '<SessionHarness />' }),
  decorators: [(story) => ({
    components: { story },
    setup() {
      spyOn(pb.collection('sounds'), 'getFullList').mockRejectedValueOnce(new ClientResponseError({ status: 500 }))
    },
    template: '<story />',
  }), withSounds({ status: 'idle' }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Couldn’t load the sounds.')
    await expect(canvas.queryByRole('list')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(names(canvasElement)).toEqual(['Hum and hearth', 'Tavern brawl', 'Ogre roar']))
    await expect(canvas.queryByRole('alert')).toBeNull()
  },
}

/** Fifteen sounds: the upload button is out and a note says why. */
export const AtTheLimit: Story = {
  decorators: [withSounds({ sounds: manySounds(15) }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('15 / 15')).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Upload sound' })).toBeDisabled()
    await expect(canvas.getByText(/reached the limit of 15 sounds/)).toBeVisible()
  },
}

/** Playing writes the stage with this sound's file reference and loop flag, and its name appears nowhere in the request. */
export const PlayPublishes: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('stages'), 'update')
    const create = spyOn(pb.collection('stages'), 'create')
    await user.click(playButton(canvasElement, 'Tavern brawl'))
    await waitFor(() => expect(stageSound()).toBeTruthy())
    const sound = stageSound()!
    await expect(sound).toEqual({
      id: BRAWL.id,
      file: { collection: 'sounds', record: BRAWL.id, name: 'sound.mp3' },
      loop: false,
      startedAt: expect.any(String),
    })
    await expect(Number.isNaN(Date.parse(sound.startedAt))).toBe(false)
    await expect(storedRecords('stages')[0]!.data).toMatchObject({ id: crookhollow.id, scene: null, image: null })
    const sent = JSON.stringify([...update.mock.calls, ...create.mock.calls])
    await expect(sent).toContain(BRAWL.id)
    await expect(sent).not.toMatch(/Tavern brawl/)
    await expect(stopButton(canvasElement, 'Tavern brawl')).toBeVisible()
    await expect(within(canvasElement).getByText('Plays for everyone')).toBeVisible()
  },
}

/** A looping sound carries its flag into the stage. */
export const PlayCarriesTheLoopFlag: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(playButton(canvasElement, 'Hum and hearth'))
    await waitFor(() => expect(stageSound()?.loop).toBe(true))
  },
}

/** Another sound replaces the one that plays. */
export const PlayingAnotherReplaces: Story = {
  tags: ['no-visual'],
  decorators: [withSounds({ playing: BRAWL.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(playButton(canvasElement, 'Ogre roar'))
    await waitFor(() => expect(stageSound()?.id).toBe(ROAR.id))
    await waitFor(() => expect(playButton(canvasElement, 'Tavern brawl')).toBeVisible())
    await expect(within(canvasElement).getAllByRole('button', { name: /^Stop / })).toHaveLength(1)
  },
}

/** There is no replay control: stopping clears the stage, and playing the same sound again is a new start with a later start time. */
export const StopThenPlayStartsAgain: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(playButton(canvasElement, 'Ogre roar'))
    await waitFor(() => expect(stageSound()?.id).toBe(ROAR.id))
    const first = stageSound()!.startedAt
    await expect(within(canvasElement).queryByRole('button', { name: 'Replay Ogre roar' })).toBeNull()
    await user.click(stopButton(canvasElement, 'Ogre roar'))
    await waitFor(() => expect(stageSound()).toBeNull())
    await expect(playButton(canvasElement, 'Ogre roar')).toBeEnabled()
    advanceClock(5000)
    await user.click(playButton(canvasElement, 'Ogre roar'))
    await waitFor(() => expect(stageSound()?.id).toBe(ROAR.id))
    await expect(Date.parse(stageSound()!.startedAt)).toBeGreaterThan(Date.parse(first))
  },
}

/** Stopping writes a stage with no sound, and the row is a play button again. */
export const StopClears: Story = {
  tags: ['no-visual'],
  decorators: [withSounds({ playing: BRAWL.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(stopButton(canvasElement, 'Tavern brawl'))
    await waitFor(() => expect(storedRecords('stages')).toHaveLength(1))
    await waitFor(() => expect(stageSound()).toBeNull())
    await expect(within(canvasElement).queryByRole('button', { name: /^Stop / })).toBeNull()
    await expect(within(canvasElement).getAllByRole('button', { name: /^Play / })).toHaveLength(3)
    await expect(within(canvasElement).queryByText('Plays for everyone')).toBeNull()
  },
}

/** While a row's change is on its way its buttons are out; the other rows keep working. */
export const BusyRowOnly: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    let release: () => void = () => {}
    spyOn(pb.collection('stages'), 'update').mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ id: crookhollow.id, updated: '' })
    }))
    await user.click(playButton(canvasElement, 'Tavern brawl'))
    const brawl = rowOf(canvasElement, 'Tavern brawl')
    await waitFor(() => expect(brawl.getByRole('button', { name: 'Stop Tavern brawl' })).toBeDisabled())
    await expect(brawl.getByRole('button', { name: 'Edit Tavern brawl' })).toBeDisabled()
    await expect(brawl.getByRole('button', { name: 'Delete Tavern brawl' })).toBeDisabled()
    await expect(playButton(canvasElement, 'Ogre roar')).toBeEnabled()
    await expect(rowOf(canvasElement, 'Ogre roar').getByRole('button', { name: 'Edit Ogre roar' })).toBeEnabled()
    release()
    await waitFor(() => expect(brawl.getByRole('button', { name: 'Stop Tavern brawl' })).toBeEnabled())
  },
}

/** A refused play gets the one message the stage writer shows, and the row is as it was. */
export const PlayFailed: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    spyOn(pb.collection('stages'), 'create').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(playButton(canvasElement, 'Tavern brawl'))
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await waitFor(() => expect(playButton(canvasElement, 'Tavern brawl')).toBeEnabled())
    await expect(playButton(canvasElement, 'Tavern brawl')).toBeVisible()
    await expect(canvasElement.querySelector('li[aria-current]')).toBeNull()
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(toastTexts()).toEqual([STAGE_TOAST])
  },
}

/** A refused stop gets the same one message, and the sound is still marked as playing. */
export const StopFailed: Story = {
  tags: ['no-visual'],
  decorators: [withSounds({ playing: BRAWL.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    spyOn(pb.collection('stages'), 'create').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(stopButton(canvasElement, 'Tavern brawl'))
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await waitFor(() => expect(stopButton(canvasElement, 'Tavern brawl')).toBeEnabled())
    await expect(stopButton(canvasElement, 'Tavern brawl')).toBeVisible()
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(toastTexts()).toEqual([STAGE_TOAST])
  },
}

/** The loop switch saves the sound's data alone: no stage write, and the list shows the new value. */
export const LoopToggleSavesData: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const toggle = rowOf(canvasElement, 'Tavern brawl').getByRole('switch', { name: 'Loop: Tavern brawl' })
    await expect(toggle).not.toBeChecked()
    await user.click(toggle)
    await waitFor(() => expect(sentForms()).toHaveLength(1))
    const form = sentForms()[0]!
    await expect(form.method).toBe('PATCH')
    await expect(form.files).toEqual({})
    await expect(JSON.parse(form.fields.data!)).toEqual({ id: BRAWL.id, name: 'Tavern brawl', loop: true, duration: 160 })
    await waitFor(() => expect(useMediaStore().sounds.list.find(s => s.id === BRAWL.id)?.loop).toBe(true))
    await waitFor(() => expect(toggle).toBeEnabled())
    await expect(toggle).toBeChecked()
    await expect(pbRequests().filter(r => r.startsWith('stages.'))).toEqual([])
    await expect(storedRecords('stages')).toHaveLength(0)
    await expect(toastTexts()).toEqual([])
  },
}

/** Changing the loop of the sound that plays leaves it playing and says the change applies from the next play. */
export const LoopOfThePlayingSoundWaits: Story = {
  decorators: [withSounds({ playing: HEARTH.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const toggle = rowOf(canvasElement, 'Hum and hearth').getByRole('switch', { name: 'Loop: Hum and hearth' })
    await expect(toggle).toBeChecked()
    await expect(within(canvasElement).queryByText('The loop applies from the next play')).toBeNull()
    await user.click(toggle)
    await expect(await within(canvasElement).findByText('The loop applies from the next play')).toBeVisible()
    await expect(toggle).not.toBeChecked()
    await expect(stopButton(canvasElement, 'Hum and hearth')).toBeVisible()
    await expect(useStageStore().stageOf(crookhollow.id).sound?.loop).toBe(true)
    await expect(pbRequests().filter(r => r.startsWith('stages.'))).toEqual([])
    // Putting it back removes the note.
    await user.click(toggle)
    await waitFor(() => expect(within(canvasElement).queryByText('The loop applies from the next play')).toBeNull())
  },
}

/** While the loop is being saved the switch stays usable and focused, a second change is ignored, and the stored value is the one shown. */
export const LoopSwitchWaitsForTheAnswer: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const release = holdUploads()
    const toggle = rowOf(canvasElement, 'Tavern brawl').getByRole('switch', { name: 'Loop: Tavern brawl' })
    try {
      toggle.focus()
      await user.keyboard(' ')
      await waitFor(() => expect(toggle).toHaveAttribute('aria-busy', 'true'))
      await expect(toggle).toBeEnabled()
      await expect(toggle).toBeChecked()
      await expect(canvasElement.ownerDocument.activeElement).toBe(toggle)
      // A second change while the first is in flight goes nowhere, and the switch keeps what was asked.
      await user.keyboard(' ')
      await user.click(toggle)
      await expect(toggle).toBeChecked()
      await expect(canvasElement.ownerDocument.activeElement).toBe(toggle)
      await expect(sentForms()).toHaveLength(1)
      await expect(playButton(canvasElement, 'Tavern brawl')).toBeEnabled()
    } finally {
      release()
    }
    await waitFor(() => expect(toggle).not.toHaveAttribute('aria-busy'))
    await expect(toggle).toBeChecked()
    await expect(canvasElement.ownerDocument.activeElement).toBe(toggle)
    await expect(sentForms()).toHaveLength(1)
    await expect(useMediaStore().sounds.list.find(s => s.id === BRAWL.id)?.loop).toBe(true)
  },
}

/** While a loop save is in flight the row's edit and delete wait, so a late answer cannot meet a deleted sound. */
export const EditAndDeleteWaitForTheLoopSave: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const release = holdUploads()
    const row = rowOf(canvasElement, 'Tavern brawl')
    try {
      await user.click(row.getByRole('switch', { name: 'Loop: Tavern brawl' }))
      await waitFor(() => expect(row.getByRole('button', { name: 'Delete Tavern brawl' })).toBeDisabled())
      await expect(row.getByRole('button', { name: 'Edit Tavern brawl' })).toBeDisabled()
      await expect(rowOf(canvasElement, 'Ogre roar').getByRole('button', { name: 'Delete Ogre roar' })).toBeEnabled()
    } finally {
      release()
    }
    await waitFor(() => expect(row.getByRole('button', { name: 'Delete Tavern brawl' })).toBeEnabled())
    await expect(row.getByRole('button', { name: 'Edit Tavern brawl' })).toBeEnabled()
    await expect(toastTexts()).toEqual([])
  },
}

/** While the sound's own delete is under way its loop switch stays usable but does nothing, so no save follows it. */
export const LoopSwitchIsOutWhileDeleting: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    let release: () => void = () => {}
    spyOn(pb.collection('sounds'), 'delete').mockImplementation(() => new Promise((resolve) => { release = () => resolve(true) }))
    await user.click(rowOf(canvasElement, 'Ogre roar').getByRole('button', { name: 'Delete Ogre roar' }))
    await user.click(within(await body(canvasElement).findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    const row = rowOf(canvasElement, 'Ogre roar')
    const toggle = row.getByRole('switch', { name: 'Loop: Ogre roar' })
    await waitFor(() => expect(row.getByRole('button', { name: 'Delete Ogre roar' })).toBeDisabled())
    await expect(toggle).toBeEnabled()
    await user.click(toggle)
    await expect(toggle).not.toBeChecked()
    await expect(sentForms()).toHaveLength(0)
    release()
    await waitFor(() => expect(names(canvasElement)).toEqual(['Hum and hearth', 'Tavern brawl']))
    await expect(sentForms()).toHaveLength(0)
    await expect(toastTexts()).toEqual([])
  },
}

/** A refused loop save keeps the focus on the switch, which returns to the stored value. */
export const LoopSaveFailedKeepsFocus: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    failUploadsWith(500)
    const toggle = rowOf(canvasElement, 'Tavern brawl').getByRole('switch', { name: 'Loop: Tavern brawl' })
    toggle.focus()
    await user.keyboard(' ')
    await waitFor(() => expect(toastTexts()).toEqual(['Couldn’t save the sound. Check your connection.']))
    await waitFor(() => expect(toggle).not.toHaveAttribute('aria-busy'))
    await expect(toggle).not.toBeChecked()
    await expect(canvasElement.ownerDocument.activeElement).toBe(toggle)
  },
}

/** A refused save puts the switch back on the stored value and says so. */
export const LoopSaveFailed: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    failUploadsWith(500)
    const toggle = rowOf(canvasElement, 'Tavern brawl').getByRole('switch', { name: 'Loop: Tavern brawl' })
    await user.click(toggle)
    await waitFor(() => expect(toastTexts()).toEqual(['Couldn’t save the sound. Check your connection.']))
    await waitFor(() => expect(toggle).toBeEnabled())
    await expect(toggle).not.toBeChecked()
    await expect(useMediaStore().sounds.list.find(s => s.id === BRAWL.id)?.loop).toBe(false)
  },
}

/** Someone else is the master now: the loop change says so in its own words. */
export const LoopSaveNotMaster: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    seedRecords('games', [{ id: crookhollow.id, name: crookhollow.name, master: 'user-seva', invite_code: crookhollow.inviteCode }])
    failUploadsWith(RECORDED.updateNotFound.status, RECORDED.updateNotFound.body)
    await user.click(rowOf(canvasElement, 'Tavern brawl').getByRole('switch', { name: 'Loop: Tavern brawl' }))
    await waitFor(() => expect(toastTexts()).toEqual(['You are not the master of this game any more.']))
  },
}

/** A sound with no known length shows a dash. */
export const UnknownDuration: Story = {
  decorators: [withSounds({ sounds: [{ ...BRAWL, duration: null }, ...SOUNDS.slice(2)] }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await expect(rowOf(canvasElement, 'Tavern brawl').getByText('—')).toBeVisible()
    await expect(rowOf(canvasElement, 'Ogre roar').getByText('0:06')).toBeVisible()
  },
}

/** Delete asks first, and a sound that plays says it will stop for everyone. */
export const DeleteAsksFirst: Story = {
  decorators: [withSounds({ playing: BRAWL.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(rowOf(canvasElement, 'Ogre roar').getByRole('button', { name: 'Delete Ogre roar' }))
    let dialog = await body(canvasElement).findByRole('dialog')
    await expect(within(dialog).getByText('Delete Ogre roar?')).toBeVisible()
    await expect(within(dialog).queryByText(/stop for everyone/)).toBeNull()
    await expect(pbRequests()).not.toContain('sounds.delete')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await closed(canvasElement)
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(rowOf(canvasElement, 'Ogre roar').getByRole('button', { name: 'Delete Ogre roar' })))
    await user.click(rowOf(canvasElement, 'Tavern brawl').getByRole('button', { name: 'Delete Tavern brawl' }))
    dialog = await body(canvasElement).findByRole('dialog')
    await expect(within(dialog).getByText(/will stop for everyone/)).toBeVisible()
    await expect(pbRequests()).not.toContain('sounds.delete')
  },
}

/** Deleting the playing sound takes it off the table first, then removes it. */
export const DeletePlayingStopsFirst: Story = {
  tags: ['no-visual'],
  decorators: [withSounds({ playing: BRAWL.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    await user.click(rowOf(canvasElement, 'Tavern brawl').getByRole('button', { name: 'Delete Tavern brawl' }))
    const dialog = await body(canvasElement).findByRole('dialog')
    clearPbRequests()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(names(canvasElement)).toEqual(['Hum and hearth', 'Ogre roar']))
    const requests = pbRequests()
    const stageAt = Math.max(requests.indexOf('stages.update'), requests.indexOf('stages.create'))
    await expect(stageAt).toBeGreaterThanOrEqual(0)
    await expect(requests.indexOf('sounds.delete')).toBeGreaterThan(stageAt)
    await expect(stageSound()).toBeNull()
    await expect(storedRecords('sounds').map(r => r.id)).not.toContain(BRAWL.id)
    await expect(useStageStore().stageOf(crookhollow.id).sound).toBeNull()
    await closed(canvasElement)
    // The row is gone, so the focus goes to the upload button.
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(within(canvasElement).getByRole('button', { name: 'Upload sound' })))
  },
}

/** A refused delete keeps the row and says so. */
export const DeleteFailed: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('sounds'), 'delete').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(rowOf(canvasElement, 'Ogre roar').getByRole('button', { name: 'Delete Ogre roar' }))
    await user.click(within(await body(canvasElement).findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toContain('Couldn’t delete the sound. Check your connection.'))
    await closed(canvasElement)
    await expect(names(canvasElement)).toContain('Ogre roar')
    await expect(rowOf(canvasElement, 'Ogre roar').getByRole('button', { name: 'Delete Ogre roar' })).toBeEnabled()
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(rowOf(canvasElement, 'Ogre roar').getByRole('button', { name: 'Delete Ogre roar' })))
    await expect(toastTexts()).toEqual(['Couldn’t delete the sound. Check your connection.'])
  },
}

/** A playing sound whose stop is refused stays, with the stage writer's message alone. */
export const DeleteOfPlayingSoundRefusedByTheStage: Story = {
  tags: ['no-visual'],
  decorators: [withSounds({ playing: BRAWL.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('stages'), 'update').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await user.click(rowOf(canvasElement, 'Tavern brawl').getByRole('button', { name: 'Delete Tavern brawl' }))
    await user.click(within(await body(canvasElement).findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toEqual([STAGE_TOAST]))
    await closed(canvasElement)
    await new Promise(resolve => setTimeout(resolve, 100))
    await expect(toastTexts()).toEqual([STAGE_TOAST])
    await expect(pbRequests()).not.toContain('sounds.delete')
    await expect(names(canvasElement)).toContain('Tavern brawl')
  },
}

/** Deleting after the mastership went elsewhere says so in its own words. */
export const DeleteNotMaster: Story = {
  tags: ['no-visual'],
  decorators: [withSounds(), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    seedRecords('games', [{ id: crookhollow.id, name: crookhollow.name, master: 'user-seva', invite_code: crookhollow.inviteCode }])
    spyOn(pb.collection('sounds'), 'delete').mockRejectedValue(new ClientResponseError({ status: 404 }))
    await user.click(rowOf(canvasElement, 'Ogre roar').getByRole('button', { name: 'Delete Ogre roar' }))
    await user.click(within(await body(canvasElement).findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(toastTexts()).toEqual(['You are not the master of this game any more.']))
  },
}

/** A new sound goes into the list, and the focus returns to the upload button. */
export const AddASound: Story = {
  tags: ['no-visual'],
  decorators: [withSounds({ sounds: [] }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const sheet = body(canvasElement)
    await user.click(canvas.getByRole('button', { name: 'Upload sound' }))
    await sheet.findByRole('dialog', { name: 'New sound' })
    await user.upload(sheet.getByLabelText('Sound file', { selector: 'input' }), soundFile('crypt-drip.mp3'))
    await user.click(sheet.getByRole('button', { name: 'Upload' }))
    await closed(canvasElement)
    await waitFor(() => expect(names(canvasElement)).toEqual(['crypt-drip']))
    await expect(canvas.getByText('1 / 15')).toBeVisible()
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Upload sound' })))
  },
}

/** Editing renames the sound in the list, sends no file, and leaves the stage alone. */
export const EditASound: Story = {
  tags: ['no-visual'],
  decorators: [withSounds({ playing: BRAWL.id }), asMaster],
  loaders: [route],
  play: async ({ canvasElement }) => {
    const sheet = body(canvasElement)
    await user.click(rowOf(canvasElement, 'Tavern brawl').getByRole('button', { name: 'Edit Tavern brawl' }))
    await sheet.findByRole('dialog', { name: 'Edit sound' })
    const name = sheet.getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'Inn brawl')
    await user.click(sheet.getByRole('button', { name: 'Save' }))
    await closed(canvasElement)
    await waitFor(() => expect(names(canvasElement)).toEqual(['Hum and hearth', 'Inn brawl', 'Ogre roar']))
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(rowOf(canvasElement, 'Inn brawl').getByRole('button', { name: 'Edit Inn brawl' })))
    await expect(sentForms()[0]!.files).toEqual({})
    await expect(pbRequests().filter(r => r.startsWith('stages.'))).toEqual([])
    await expect(stopButton(canvasElement, 'Inn brawl')).toBeVisible()
  },
}

/** Eighty characters in a 440 px card: one line ending in an ellipsis, controls all in place. */
export const LongName: Story = {
  decorators: [withSounds({ sounds: [{ ...BRAWL, name: 'The long and winding road through the Mourning Marshes toward the drowned bell tower' }, ...SOUNDS.slice(2)], playing: BRAWL.id }), asMaster],
  loaders: [route],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const li = within(canvasElement).getAllByRole('listitem')[0]!
    const name = li.querySelector<HTMLElement>('.sr-name')!
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
    await expect(name.getBoundingClientRect().height).toBeLessThan(24)
    const box = li.getBoundingClientRect()
    for (const control of within(li).getAllByRole('button')) {
      const rect = control.getBoundingClientRect()
      await expect(rect.right).toBeLessThanOrEqual(box.right + 0.5)
      await expect(rect.left).toBeGreaterThanOrEqual(box.left)
      await expect(rect.width).toBeGreaterThan(20)
    }
  },
}

/** A player's table: no sounds are asked for, and a card that was open shows nothing. */
export const PlayerRequestsNothing: Story = {
  tags: ['no-visual'],
  render: () => ({
    components: {},
    setup() {
      useMediaSession()
      useToolPanelsStore().open.sounds = true
      onUnmounted(closeMedia)
      return { cards: useTrayCards().cards }
    },
    template: '<div><component :is="c.component" v-for="c in cards" :key="c.key" /><p>player table</p></div>',
  }),
  decorators: [withSounds({ status: 'idle' }), withGameTable(olden, [], {})],
  loaders: [atRoute(`/games/${olden.id}`)],
  play: async ({ canvasElement }) => {
    resetRecords('sounds', [soundRow(BRAWL, olden.id)])
    await new Promise(resolve => setTimeout(resolve, 200))
    await expect(within(canvasElement).getByText('player table')).toBeVisible()
    await expect(within(canvasElement).queryByRole('region', { name: 'Sounds' })).toBeNull()
    await expect(pbRequests().filter(r => r.startsWith('sounds.'))).toEqual([])
    await expect(useMediaStore().sounds.status).toBe('idle')
  },
}
