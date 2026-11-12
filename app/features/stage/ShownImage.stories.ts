import { defineComponent, onUnmounted, ref } from 'vue'
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor as waitForDefault, within } from 'storybook/test'
import ShownImageHost from './ShownImageHost.vue'
import CharacterListView from '@/features/character-list/CharacterListView.vue'
import PartyView from '@/features/in-game/PartyView.vue'
import { useShownImage, useShownImageReveal, resetShownImage } from '@/composables/useShownImage'
import { useTrayCards } from '@/composables/useTrayCards'
import { emptyStage, withImage } from '@/domain/stage'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import { bootstrapStatus } from '@/transport/bootstrap'
import { crookhollow, CROOKHOLLOW_META, oda, olden, OLDEN_META, PARTY, wren } from '@/stories/fixtures'
import { withMediaPrefs } from '@/stories/playback'
import { drawPicture, LONG_CAPTION, PORTRAIT, servePictures, WIDE_MAP } from '@/stories/pictures'
import { storyRouter } from '@/stories/router'
import { atRoute, withGameTable, withOfflineMode } from '@/stories/state'
import { useCharactersStore } from '@/stores/characters'
import { useStageStore } from '@/stores/stage'
import { authStore, clearPbRequests, pbRequests, signInMock } from '../../../.storybook/mocks/pb'
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

/** Opened from the card, the close button has the focus, and closing gives it back to the card's picture button. */
export const FocusReturnsToTheCard: Story = {
  decorators: baseDecorators(asPlayer, OGRE),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    const open = await findCardButton(canvasElement, /^Open: Brakk/)
    open.focus()
    await userEvent.click(open)
    const found = await body(canvasElement).findByRole('dialog')
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(within(found).getByRole('button', { name: 'Close' })))
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

/** Online data that has not arrived yet: nothing is open, whatever the stores hold. Restored to ready afterwards. */
const dataNotReady: Decorator = (story) => ({
  components: { story },
  setup() {
    bootstrapStatus.value = 'loading'
    onUnmounted(() => { bootstrapStatus.value = 'ready' })
  },
  template: '<story />',
})

/** The stage that arrives after the table opened is the first value seen, not a change: the card, never the pop-up. */
export const LoadsAfterTheTableOpened: Story = {
  decorators: [dataNotReady, withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), withPictures, asPlayer],
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, OGRE, 'load')
    await settle()
    await expect(within(canvasElement).queryByRole('button', { name: /^Open: /, hidden: true })).toBeNull()
    bootstrapStatus.value = 'ready'
    await findCardButton(canvasElement, /^Open: Brakk/)
    await settle()
    await expect(dialog(canvasElement)).toBeNull()
  },
}

/** Signing in at a table's address: the account is known before the data is, and the data then loads as the first value. */
export const SignInOnATableRoute: Story = {
  decorators: [
    (story) => ({ components: { story }, setup() { authStore.clear() }, template: '<story />' }),
    dataNotReady, withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), withPictures, asPlayer,
  ],
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    signInMock()
    await settle()
    show(PLAYER_GAME, OGRE, 'load')
    bootstrapStatus.value = 'ready'
    await findCardButton(canvasElement, /^Open: Brakk/)
    await settle()
    await expect(dialog(canvasElement)).toBeNull()
  },
}

/** A stopped and restarted online session forgets what was seen: the next stage is a first value. */
export const RestartedSessionForgetsWhatWasSeen: Story = {
  decorators: baseDecorators(asPlayer, BRIDGE),
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await findCardButton(canvasElement, /^Open: The old bridge/)
    bootstrapStatus.value = 'loading'
    await settle()
    show(PLAYER_GAME, OGRE, 'load')
    bootstrapStatus.value = 'ready'
    await findCardButton(canvasElement, /^Open: Brakk/)
    await settle()
    await expect(dialog(canvasElement)).toBeNull()
  },
}

const scrollerOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.party-center')!
const leftOf = (el: Element) => el.getBoundingClientRect().left

/** On a phone, an image appearing (or going) never moves the tray to the card: the sheet in view stays in view. */
export const TrayStaysWhereItIs: Story = {
  decorators: baseDecorators(asMaster),
  // The sheets' route: the tray is on screen with no card in it.
  render: () => ({
    components: { PartyView, ShownImageHost },
    setup() { useShownImageReveal() },
    template: '<PartyView /><ShownImageHost />',
  }),
  loaders: [atRoute(`/games/${MASTER_GAME}/party/${PARTY[0]!.id},${PARTY[2]!.id}`)],
  play: async ({ canvasElement }) => {
    if (!setViewport) return
    await setViewport(375, 667)
    try {
      await waitFor(() => expect(canvasElement.querySelectorAll('.sheet-column')).toHaveLength(2))
      const scroller = scrollerOf(canvasElement)
      // Look at the second sheet.
      canvasElement.querySelectorAll('.sheet-column')[1]!.scrollIntoView({ inline: 'center', block: 'nearest' })
      await settle()
      const watched = canvasElement.querySelectorAll('.sheet-column')[1]!
      const before = leftOf(watched)
      await expect(before).toBeGreaterThanOrEqual(0)
      await expect(before).toBeLessThan(window.innerWidth)
      show(MASTER_GAME, BRIDGE)
      await findCardButton(canvasElement, /^Open: The old bridge/)
      await settle(900)
      await expect(Math.abs(leftOf(watched) - before)).toBeLessThan(2)
      await expect(scroller.scrollLeft).toBeGreaterThan(0)
      show(MASTER_GAME, null)
      await waitFor(() => expect(canvasElement.querySelector('[data-shown-image-open]')).toBeNull())
      await settle(900)
      await expect(Math.abs(leftOf(watched) - before)).toBeLessThan(2)
    } finally {
      await setViewport(1280, 720)
    }
  },
}

/**
 * On a phone, closing the large view gives the focus back to the card's picture button without scrolling the tray to
 * it: the person stays on the sheet they were looking at (the walk found the tray jumping to the card).
 */
let openReveal: () => void = () => {}
export const ClosingTheRevealLeavesTheTray: Story = {
  decorators: baseDecorators(asMaster),
  render: () => ({
    components: { PartyView, ShownImageHost },
    setup() {
      useShownImageReveal()
      openReveal = useShownImage().open
    },
    template: '<PartyView /><ShownImageHost />',
  }),
  loaders: [atRoute(`/games/${MASTER_GAME}/party/${PARTY[0]!.id},${PARTY[2]!.id}`)],
  play: async ({ canvasElement }) => {
    if (!setViewport) return
    await setViewport(375, 667)
    try {
      await waitFor(() => expect(canvasElement.querySelectorAll('.sheet-column')).toHaveLength(2))
      canvasElement.querySelectorAll('.sheet-column')[1]!.scrollIntoView({ inline: 'center', block: 'nearest' })
      await settle()
      const watched = canvasElement.querySelectorAll('.sheet-column')[1]!
      show(MASTER_GAME, BRIDGE)
      const button = await findCardButton(canvasElement, /^Open: The old bridge/)
      await settle(900)
      const before = leftOf(watched)
      await expect(before).toBeGreaterThanOrEqual(0)
      await expect(before).toBeLessThan(window.innerWidth)
      // What the reveal does on a player's device.
      openReveal()
      await visibleDialog(canvasElement, BRIDGE.caption!)
      await userEvent.click(within(body(canvasElement).getByRole('dialog', { name: BRIDGE.caption! })).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(dialog(canvasElement)).toBeNull())
      await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(button))
      await settle(600)
      await expect(Math.abs(leftOf(watched) - before)).toBeLessThan(2)
    } finally {
      await setViewport(1280, 720)
    }
  },
}

/** The reveal over a real open sheet: it opens above it, Esc closes it first and focus returns into the sheet. */
export const RevealOverAnOpenSheet: Story = {
  decorators: baseDecorators(asPlayer),
  loaders: [playerRoute],
  render: () => ({
    components: { Table, BottomSheet },
    setup() {
      const sheet = ref(true)
      return { sheet }
    },
    template: '<Table /><BottomSheet v-model:open="sheet" title="Pick something"><button type="button">Inside the sheet</button></BottomSheet>',
  }),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument
    await body(canvasElement).findByRole('dialog', { name: 'Pick something' })
    const inside = body(canvasElement).getByRole('button', { name: 'Inside the sheet' })
    inside.focus()
    show(PLAYER_GAME, OGRE)
    await visibleDialog(canvasElement, OGRE.caption!)
    // The veil dims the sheet too, and the tooltips (400), the dice (500) and the server-down overlay (900) stay above.
    const z = (selector: string) => Number(getComputedStyle(doc.querySelector(selector)!).zIndex)
    await expect(z('.sir-veil')).toBeGreaterThan(z('.bs-content-wrap'))
    await expect(z('.sir-panel')).toBeGreaterThan(z('.sir-veil'))
    await expect(z('.sir-panel')).toBeLessThan(400)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog', { name: OGRE.caption! })).toBeNull())
    await expect(body(canvasElement).getByRole('dialog', { name: 'Pick something' })).toBeVisible()
    await waitFor(() => expect(doc.activeElement).toBe(inside))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(dialog(canvasElement)).toBeNull())
    await waitFor(() => expect(doc.body.style.pointerEvents).not.toBe('none'))
    await expect(doc.body.hasAttribute('data-scroll-locked')).toBe(false)
  },
}

/** A picture that failed shows Try again on the card; once it can be fetched, the card shows it and opens it. */
export const CardTryAgainLoadsThePicture: Story = {
  decorators: [
    (story) => ({
      components: { story },
      setup() {
        const served: Record<string, string> = {}
        const restore = servePictures(served)
        ;(window as unknown as { __served: Record<string, string> }).__served = served
        onUnmounted(restore)
      },
      template: '<story />',
    }),
    withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), asPlayer,
  ],
  loaders: [playerRoute],
  play: async ({ canvasElement }) => {
    await settle()
    show(PLAYER_GAME, { id: 'story-shown-late', caption: 'Late picture', file: 'image.png' })
    await userEvent.click(await body(canvasElement).findByRole('button', { name: 'Close' }))
    const canvas = within(canvasElement)
    const retry = await canvas.findByRole('button', { name: 'Try again' })
    ;(window as unknown as { __served: Record<string, string> }).__served['story-shown-late'] = pictures[OGRE.id]!
    await userEvent.click(retry)
    await findCardButton(canvasElement, 'Open: Late picture')
    await expect(canvas.queryByText('The image could not be loaded.')).toBeNull()
  },
}

// A player at Olden's table with Wren's sheet open (Wren is theirs, so the sheet can be edited).
const atMySheet = [withStageOnLoad(PLAYER_GAME, null), withMediaPrefs({ sound: 'on' }), withPictures, withGameTable(olden, [oda, wren], OLDEN_META)]
const sheetTable = () => ({
  components: { PartyView, ShownImageHost },
  setup() { useShownImageReveal() },
  template: '<PartyView /><ShownImageHost />',
})

/**
 * A player typing in their sheet when the master shows a picture: the view opens over the sheet without taking their
 * keys. A Space and an Enter neither close it nor reach the field; Esc gives the focus back to the field, with its text
 * as it was and the caret where it was.
 */
export const TypingInTheSheetIsNotTaken: Story = {
  decorators: atMySheet,
  loaders: [atRoute(`/games/${PLAYER_GAME}/party/${wren.id}`)],
  render: sheetTable,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('tab', { name: 'Notes' }))
    const notes = await canvas.findByRole('textbox', { name: 'Notes about the character, world, story…' })
    await userEvent.clear(notes)
    await userEvent.type(notes, 'The bridge')
    await expect(doc.activeElement).toBe(notes)
    show(PLAYER_GAME, OGRE)
    await visibleDialog(canvasElement, OGRE.caption!)
    // The panel has the focus, not its close button.
    await waitFor(() => expect(doc.activeElement).toBe(doc.querySelector('.sir-panel')))
    await userEvent.keyboard(' ')
    await userEvent.keyboard('{Enter}')
    await settle()
    await expect(dialog(canvasElement)).not.toBeNull()
    await expect(notes).toHaveValue('The bridge')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(dialog(canvasElement)).toBeNull())
    await waitFor(() => expect(doc.activeElement).toBe(notes))
    await userEvent.keyboard('!')
    await expect(notes).toHaveValue('The bridge!')
  },
}

/**
 * A lazy number field mid-edit (the coins, in their popover) when the picture pops up: the field loses the focus, so
 * its draft is committed, exactly as by any other blur (one write).
 */
export const LazyFieldCommitsLikeABlur: Story = {
  decorators: atMySheet,
  loaders: [atRoute(`/games/${PLAYER_GAME}/party/${wren.id}`)],
  // The real clock for this one: Vue drops a handler for an event stamped no later than the handler was attached, and
  // with the frozen clock every stamp is equal, so a blur that the popover's capture listeners see first never reaches
  // the field. The preview puts its own clock back after the story.
  beforeEach: () => {
    const frozen = globalThis.Date
    globalThis.Date = Object.getPrototypeOf(frozen) as DateConstructor
    return () => { globalThis.Date = frozen }
  },
  render: sheetTable,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument
    const coinsNow = () => useCharactersStore().getById(wren.id)!.coins
    await userEvent.click(await within(canvasElement).findByRole('button', { name: /Coins/ }))
    const coins = await body(canvasElement).findByRole('spinbutton', { name: 'Coins' })
    const before = coinsNow()
    await userEvent.clear(coins)
    await userEvent.type(coins, '57')
    // A draft: nothing is written while the person types.
    await expect(coinsNow()).toBe(before)
    await expect(doc.activeElement).toBe(coins)
    clearPbRequests()
    show(PLAYER_GAME, OGRE)
    await visibleDialog(canvasElement, OGRE.caption!)
    await waitFor(() => expect(coinsNow()).toBe(57))
    await settle()
    await expect(pbRequests().filter(r => r === 'characters.update')).toHaveLength(1)
    // The popover stays open under the view, so Esc closes the view alone and the focus goes back to the field.
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog', { name: OGRE.caption! })).toBeNull())
    await waitFor(() => expect(doc.activeElement).toBe(coins))
    await expect(coins).toHaveValue(57)
    await expect(pbRequests().filter(r => r === 'characters.update')).toHaveLength(1)
  },
}
