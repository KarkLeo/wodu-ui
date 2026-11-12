import { defineComponent, onUnmounted } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor as waitForDefault, within } from 'storybook/test'
import ShownImageHost from './ShownImageHost.vue'
import CharacterListView from '@/features/character-list/CharacterListView.vue'
import PartyView from '@/features/in-game/PartyView.vue'
import { useShownImage, useShownImageReveal, resetShownImage } from '@/composables/useShownImage'
import { useTrayCards } from '@/composables/useTrayCards'
import { emptyStage, withImage } from '@/domain/stage'
import { crookhollow, CROOKHOLLOW_META, olden, PARTY } from '@/stories/fixtures'
import { withMediaPrefs } from '@/stories/playback'
import { drawPicture, LONG_CAPTION, PORTRAIT, servePictures, WIDE_MAP } from '@/stories/pictures'
import { storyRouter } from '@/stories/router'
import { atRoute, withGameTable, withOfflineMode } from '@/stories/state'
import { useStageStore } from '@/stores/stage'
import { clearPbRequests, pbRequests, signInMock } from '../../../.storybook/mocks/pb'
import type { TableImage } from '@/types/stage'

// A slow runner takes longer than the default second.
const waitFor: typeof waitForDefault = (callback, options) => waitForDefault(callback, { timeout: 10000, ...options })

// What app.vue does for the table: the reveal rule once, the tray and the large view.
const Table = defineComponent({
  components: { PartyView, CharacterListView, ShownImageHost },
  setup() {
    useShownImageReveal()
    const { shown } = useTrayCards()
    const { revealed } = useShownImage()
    return { shown, revealed }
  },
  template: '<PartyView v-if="shown" /><CharacterListView v-else /><ShownImageHost /><p data-testid="revealed">{{ revealed }}</p>',
})

const meta = {
  title: 'Features/Stage/ShownImage',
  component: Table,
  tags: ['no-visual'],
  parameters: { layout: 'fullscreen' },
  beforeEach() {
    signInMock()
    resetShownImage()
  },
} satisfies Meta<typeof Table>

export default meta
type Story = StoryObj<typeof meta>

const asMaster = withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)
const asPlayer = withGameTable(olden, [], {})
const MASTER_GAME = crookhollow.id
const PLAYER_GAME = olden.id

const BRIDGE: TableImage = { id: 'story-shown-bridge', caption: 'The old bridge at dusk', file: 'image.png' }
const OGRE: TableImage = { id: 'story-shown-ogre', caption: 'Brakk the ogre, scarred and sullen', file: 'image.png' }

// Which picture each image shows, because the story server serves no files.
const pictures = {
  [BRIDGE.id]: drawPicture(WIDE_MAP.width, WIDE_MAP.height, 'bridge'),
  [OGRE.id]: drawPicture(PORTRAIT.width, PORTRAIT.height, 'ogre'),
}
const withPictures: Decorator = (story) => ({
  components: { story },
  setup() {
    const restore = servePictures(pictures)
    onUnmounted(restore)
  },
  template: '<story />',
})

/** Every showing gets its own time, so the same image shown twice is two keys; the preview freezes the clock. */
let tick = 0
const nextShownAt = () => new Date(Date.UTC(2026, 10, 12, 12, 0, ++tick)).toISOString()

function show(game: string, image: TableImage | null, source: 'live' | 'load' = 'live', withCaption = true) {
  useStageStore().set(image ? withImage(emptyStage(game), image, withCaption, nextShownAt()) : emptyStage(game), source)
}

/** The stage the table was opened on, as the snapshot would have loaded it (before the table mounts). */
function withStageOnLoad(game: string, image: TableImage | null, withCaption = true): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      const stages = useStageStore()
      stages.clearAll()
      if (image) show(game, image, 'load', withCaption)
    },
    template: '<story />',
  })
}

const body = (el: HTMLElement) => within(el.ownerDocument.body)
const dialog = (el: HTMLElement) => body(el).queryByRole('dialog')
const settle = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms))
// While the large view is open the table behind it is hidden from assistive tech, which is what `hidden` looks through.
const cardButton = (el: HTMLElement, name: string | RegExp) => within(el).getByRole('button', { name, hidden: true })
const findCardButton = (el: HTMLElement, name: string | RegExp) => within(el).findByRole('button', { name, hidden: true })
const visibleDialog = async (el: HTMLElement, name: string) => {
  const found = await body(el).findByRole('dialog', { name })
  await waitFor(() => expect(found).toBeVisible())
}

type SetViewport = (width: number, height: number) => Promise<void>
const setViewport = (globalThis as { __setStoryViewport?: SetViewport }).__setStoryViewport

const baseDecorators = (as: Decorator, onLoad: TableImage | null = null, prefs = withMediaPrefs({ sound: 'on' })) => [withStageOnLoad(as === asMaster ? MASTER_GAME : PLAYER_GAME, onLoad), prefs, withPictures, as]
const playerRoute = atRoute(`/games/${PLAYER_GAME}`)
const masterRoute = atRoute(`/games/${MASTER_GAME}`)

/** A live change at an open table opens the large view, named by its caption. */
export const PlayerGetsTheReveal: Story = {
  decorators: baseDecorators(asPlayer),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    await expect(dialog(canvasElement)).toBeNull()
    show(PLAYER_GAME, BRIDGE)
    await visibleDialog(canvasElement, BRIDGE.caption!)
    await expect(cardButton(canvasElement, 'Open: The old bridge at dusk')).toBeVisible()
  },
}

export const PlayerGetsTheRevealWithoutACaption: Story = {
  decorators: baseDecorators(asPlayer),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, BRIDGE, 'live', false)
    await visibleDialog(canvasElement, 'Shown image')
  },
}

/** What is found at load, by a reload or a route into the game, shows as the card and never pops up. */
export const LateJoinerGetsTheCardOnly: Story = {
  decorators: baseDecorators(asPlayer, BRIDGE),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await expect(await findCardButton(canvasElement, 'Open: The old bridge at dusk')).toBeVisible()
    await settle()
    await expect(dialog(canvasElement)).toBeNull()
  },
}

/** The master who shows it gets the card, never the pop-up. */
export const MasterGetsTheCardOnly: Story = {
  decorators: baseDecorators(asMaster),
  loaders: [masterRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(MASTER_GAME, BRIDGE)
    await expect(await findCardButton(canvasElement, 'Open: The old bridge at dusk')).toBeVisible()
    await settle()
    await expect(dialog(canvasElement)).toBeNull()
  },
}

/** The master can still open the large view by clicking the card, like anyone. */
export const MasterCanOpenFromTheCard: Story = {
  decorators: baseDecorators(asMaster, BRIDGE),
  loaders: [masterRoute],
  play: async ({ canvasElement }) => {
    await userEvent.click(await findCardButton(canvasElement, 'Open: The old bridge at dusk'))
    await visibleDialog(canvasElement, BRIDGE.caption!)
  },
}

/** Closing leaves the card, with the focus on its picture button, and the card opens it again. */
export const CloseLeavesTheCard: Story = {
  decorators: baseDecorators(asPlayer),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, OGRE)
    const open = await findCardButton(canvasElement, /^Open: Brakk/)
    await body(canvasElement).findByRole('dialog')
    await userEvent.click(body(canvasElement).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(dialog(canvasElement)).toBeNull())
    await expect(open).toBeVisible()
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(open))
  },
}

export const CardReopens: Story = {
  decorators: baseDecorators(asPlayer),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, OGRE)
    await body(canvasElement).findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(dialog(canvasElement)).toBeNull())
    await userEvent.click(cardButton(canvasElement, /^Open: Brakk/))
    await visibleDialog(canvasElement, OGRE.caption!)
  },
}

/** The card's picture button is where focus lands when the large view closes. */
export const FocusReturnsToTheCard: Story = {
  decorators: baseDecorators(asPlayer, OGRE),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    const open = await findCardButton(canvasElement, /^Open: Brakk/)
    open.focus()
    await userEvent.click(open)
    await body(canvasElement).findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(dialog(canvasElement)).toBeNull())
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(open))
  },
}

/** The master hides it: the dialog and the card go, focus is on the page, and the character list is back. */
export const HideClosesEverything: Story = {
  decorators: baseDecorators(asPlayer),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, OGRE)
    await body(canvasElement).findByRole('dialog')
    await expect(canvasElement.querySelector('.party-center')).not.toBeNull()
    show(PLAYER_GAME, null)
    await waitFor(() => expect(dialog(canvasElement)).toBeNull())
    await waitFor(() => expect(within(canvasElement).queryByRole('button', { name: /^Open: /, hidden: true })).toBeNull())
    await expect(canvasElement.ownerDocument.querySelector('.sir-veil')).toBeNull()
    await expect(canvasElement.querySelector('.party-center')).toBeNull()
    await expect(canvasElement.ownerDocument.activeElement === canvasElement.ownerDocument.body || canvasElement.ownerDocument.activeElement === null).toBe(true)
    await expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe('none')
  },
}

/** Another image while the view is open swaps the picture and the caption in place. */
export const ReplaceSwapsInPlace: Story = {
  decorators: baseDecorators(asPlayer),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, BRIDGE)
    await body(canvasElement).findByRole('dialog', { name: BRIDGE.caption! })
    show(PLAYER_GAME, OGRE)
    await visibleDialog(canvasElement, OGRE.caption!)
    await expect(body(canvasElement).queryAllByRole('dialog')).toHaveLength(1)
    await waitFor(() => expect(canvasElement.ownerDocument.querySelector<HTMLImageElement>('.sir-img')!.naturalHeight).toBe(PORTRAIT.height))
  },
}

/** Hide, then show the same image again: a new showing, so it reveals again. */
export const ShownAgainRevealsAgain: Story = {
  decorators: baseDecorators(asPlayer),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, OGRE)
    await body(canvasElement).findByRole('dialog')
    show(PLAYER_GAME, null)
    await waitFor(() => expect(dialog(canvasElement)).toBeNull())
    show(PLAYER_GAME, OGRE)
    await visibleDialog(canvasElement, OGRE.caption!)
  },
}

/** A reconnect snapshot with a new image while the table is open reveals it, like a live change. */
export const ReconnectSnapshotWithANewImageReveals: Story = {
  decorators: baseDecorators(asPlayer, BRIDGE),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await findCardButton(canvasElement, /^Open: The old bridge/)
    await settle()
    await expect(dialog(canvasElement)).toBeNull()
    show(PLAYER_GAME, OGRE, 'load')
    await visibleDialog(canvasElement, OGRE.caption!)
  },
}

/** A snapshot that carries the very same showing changes nothing. */
export const ReconnectSnapshotWithTheSameImageIsQuiet: Story = {
  decorators: baseDecorators(asPlayer),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, OGRE)
    await body(canvasElement).findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(dialog(canvasElement)).toBeNull())
    useStageStore().set({ ...useStageStore().stageOf(PLAYER_GAME) }, 'load')
    await settle()
    await expect(dialog(canvasElement)).toBeNull()
  },
}

/** Leaving the table forgets what was seen: coming back finds the image as a card, never a pop-up. */
export const LeavingTheTableForgetsWhatWasSeen: Story = {
  decorators: baseDecorators(asPlayer, BRIDGE),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await findCardButton(canvasElement, /^Open: The old bridge/)
    await storyRouter.push('/games')
    await waitFor(() => expect(within(canvasElement).queryByRole('button', { name: /^Open: /, hidden: true })).toBeNull())
    show(PLAYER_GAME, OGRE)
    await storyRouter.push(`/games/${PLAYER_GAME}`)
    await expect(await findCardButton(canvasElement, /^Open: Brakk/)).toBeVisible()
    await settle()
    await expect(dialog(canvasElement)).toBeNull()
  },
}

/** Another table's image never reveals on arrival, and a revealed view does not leak into it. */
export const SwitchingGamesDoesNotLeakTheReveal: Story = {
  decorators: baseDecorators(asPlayer),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, OGRE)
    await body(canvasElement).findByRole('dialog')
    await storyRouter.push('/games')
    await waitFor(() => expect(dialog(canvasElement)).toBeNull())
    await expect(within(canvasElement).getByTestId('revealed')).toHaveTextContent('false')
  },
}

/** The picture is content, so a device with sound and background off still gets it. */
export const SoundAndBackgroundOffStillShows: Story = {
  decorators: baseDecorators(asPlayer, null, withMediaPrefs({ sound: 'off', background: false })),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, OGRE)
    await visibleDialog(canvasElement, OGRE.caption!)
    await waitFor(() => expect(canvasElement.ownerDocument.querySelector<HTMLImageElement>('.sir-img')!.naturalHeight).toBe(PORTRAIT.height))
  },
}

/** With the card alone and no sheet open, the game's route shows the tray (a player has no other card). */
export const CardAloneShowsTheTray: Story = {
  decorators: baseDecorators(asPlayer, OGRE),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await findCardButton(canvasElement, /^Open: Brakk/)
    await expect(canvasElement.querySelector('.party-center')).not.toBeNull()
    await expect(canvasElement.querySelectorAll('.sheet-column')).toHaveLength(1)
    // Only the master's Hide removes it: the card has no close button.
    await expect(canvasElement.querySelector('.sheet-tools')).toBeNull()
  },
}

/** The card comes before the master's own cards and the sheets, and the master's keep their close buttons. */
export const CardComesFirstForTheMaster: Story = {
  decorators: baseDecorators(asMaster, BRIDGE),
  loaders: [atRoute(`/games/${MASTER_GAME}/party/${PARTY[0]!.id}`)],
  play: async ({ canvasElement }) => {
    await findCardButton(canvasElement, /^Open: The old bridge/)
    const columns = Array.from(canvasElement.querySelectorAll('.sheet-column'))
    await expect(columns.length).toBeGreaterThan(1)
    await expect(columns[0]!.querySelector('[data-shown-image-open]')).not.toBeNull()
    await expect(columns[1]!.querySelector('[data-shown-image-open]')).toBeNull()
  },
}

async function onAPhone(size: [number, number], canvasElement: HTMLElement) {
  if (!setViewport) return
  await setViewport(...size)
  try {
    const open = await findCardButton(canvasElement, /^Open: Brakk/)
    const column = open.closest('.sheet-column')!.getBoundingClientRect()
    await waitFor(() => expect(canvasElement.querySelector<HTMLImageElement>('.sic-img')!.complete).toBe(true))
    const img = canvasElement.querySelector('.sic-img')!.getBoundingClientRect()
    await expect(column.left).toBeGreaterThanOrEqual(0)
    await expect(column.right).toBeLessThanOrEqual(window.innerWidth)
    await expect(img.left).toBeGreaterThanOrEqual(column.left)
    await expect(img.right).toBeLessThanOrEqual(column.right)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  } finally {
    await setViewport(1280, 720)
  }
}

/** On a phone the tray's cards are the phone's width and the card's picture stays inside it, whole. */
export const CardFitsAPhone: Story = {
  decorators: baseDecorators(asPlayer, OGRE),
  loaders: [playerRoute],
  play: ({ canvasElement }) => onAPhone([375, 667], canvasElement),
}

export const CardFitsALandscapePhone: Story = {
  decorators: baseDecorators(asPlayer, OGRE),
  loaders: [playerRoute],
  play: ({ canvasElement }) => onAPhone([667, 375], canvasElement),
}

/** Offline mode has no stage: nothing shows even with an image in the store, and nothing is requested. */
export const OfflineHasNothing: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, OGRE), withMediaPrefs({ sound: 'on' }), withPictures, withOfflineMode, asPlayer],
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    clearPbRequests()
    await settle()
    show(PLAYER_GAME, BRIDGE)
    await settle()
    await expect(within(canvasElement).queryByRole('button', { name: /^Open: /, hidden: true })).toBeNull()
    await expect(dialog(canvasElement)).toBeNull()
    await expect(pbRequests()).toEqual([])
  },
}

/** A player's client never asks for the images list: only the file's address, from the stage, is ever used. */
export const PlayerRequestsNothing: Story = {
  decorators: baseDecorators(asPlayer),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    clearPbRequests()
    await settle()
    show(PLAYER_GAME, OGRE)
    await body(canvasElement).findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    await settle()
    await expect(pbRequests().filter(r => r.startsWith('images.') || r.startsWith('scenes.') || r.startsWith('sounds.'))).toEqual([])
  },
}

/** A picture that cannot load: the card and the dialog show the note, nothing else breaks, and the dialog closes. */
export const ImageFailsToLoad: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), asPlayer],
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, { id: 'story-shown-missing', caption: 'Lost in the marsh', file: 'image.png' })
    await visibleDialog(canvasElement, 'Lost in the marsh')
    await waitFor(() => expect(body(canvasElement).getAllByText('The image could not be loaded.')).toHaveLength(2))
    await userEvent.click(body(canvasElement).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(dialog(canvasElement)).toBeNull())
    await expect(within(canvasElement).getByText('Lost in the marsh')).toBeVisible()
  },
}

/** A 120-character caption on the real table: the dialog stays on screen and its close button reachable. */
export const LongCaption: Story = {
  decorators: [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), withPictures, asPlayer],
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, { ...OGRE, caption: LONG_CAPTION })
    await body(canvasElement).findByRole('dialog', { name: LONG_CAPTION })
    const panel = canvasElement.ownerDocument.querySelector('.sir-panel')!.getBoundingClientRect()
    await expect(panel.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5)
    await expect(panel.right).toBeLessThanOrEqual(window.innerWidth + 0.5)
  },
}
