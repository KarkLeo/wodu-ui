import { defineComponent } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import GameLayout from '@/components/layout/GameLayout.vue'
import DiceDrawer from '@/components/DiceDrawer.vue'
import PartyView from '@/features/in-game/PartyView.vue'
import PlayersPanel from '@/components/layout/PlayersPanel.vue'
import SoundPrompt from './SoundPrompt.vue'
import { useStagePlayback } from '@/composables/useStagePlayback'
import { emptyStage } from '@/domain/stage'
import { brann, wren, crookhollow, CROOKHOLLOW_META, PARTY } from '@/stories/fixtures'
import {
  controlDecode, sceneCalls, sceneSoundUrl, sceneUrls, showScene, withLiveScene, withMediaPrefs,
} from '@/stories/playback'
import { SCENES, TAVERN } from '@/stories/scenes'
import { atRoute, DESKTOP_VIEWPORT, withGameTable } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { useMediaPrefsStore } from '@/stores/mediaPrefs'
import { useStageStore } from '@/stores/stage'
import { sceneAudioCalls } from '../../../.storybook/mocks/sceneAudioInstance'
import { signInMock } from '../../../.storybook/mocks/pb'

const FOREST = SCENES[1]!
const RAIN = SCENES[2]!

// What app.vue does for the table: the playback, the backdrop on the layout, the prompt in its page.
const Table = defineComponent({
  components: { GameLayout, PlayersPanel, SoundPrompt },
  setup() {
    const { backdropUrl } = useStagePlayback()
    return { backdropUrl }
  },
  template: `
    <GameLayout :backdrop-url="backdropUrl">
      <p style="padding: 16px">The table</p>
      <SoundPrompt />
      <template #left><PlayersPanel /></template>
    </GameLayout>`,
})

const meta = {
  title: 'Screens/StagePlayback',
  component: GameLayout,
  render: () => ({ ...Table }),
  tags: ['no-visual'],
  globals: DESKTOP_VIEWPORT,
  parameters: { layout: 'fullscreen' },
  decorators: [
    withLiveScene(null),
    withGameTable(crookhollow, PARTY, CROOKHOLLOW_META),
    withMediaPrefs(),
  ],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  beforeEach() {
    signInMock()
  },
} satisfies Meta<typeof GameLayout>

export default meta
type Story = StoryObj<typeof meta>

const filesRequested = () => performance.getEntriesByType('resource').filter(e => e.name.includes('/api/files/')).length
const settle = () => new Promise(resolve => setTimeout(resolve, 200))

function filesInTheDom(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('*')).flatMap((el) => {
    const found = [el.getAttribute('style') ?? '', el.getAttribute('src') ?? '', el.getAttribute('srcset') ?? '']
    return found.filter(v => v.includes('/api/files/'))
  })
}

/** Sound off and the background off: the stage changes twice and this device fetches nothing of it. */
export const OffMeansNoRequests: Story = {
  decorators: [withMediaPrefs({ sound: 'off', background: false })],
  play: async ({ canvasElement }) => {
    const requestsBefore = filesRequested()
    await settle()
    showScene(TAVERN)
    await settle()
    showScene(RAIN)
    await settle()
    await expect(sceneUrls()).toEqual([])
    await expect(filesInTheDom(canvasElement)).toEqual([])
    await expect(filesRequested()).toBe(requestsBefore)
    // Off is not unheard: the prompt does not come back for a device that said no.
    await expect(within(canvasElement).queryByText('The table has sound')).toBeNull()
  },
}

/** Sound on: the scene's sound reaches the service once, an unrelated change does not repeat it, a switch sends the new one. */
export const SoundOnPlaysTheScene: Story = {
  decorators: [withMediaPrefs({ sound: 'on', background: false })],
  play: async () => {
    await settle()
    await expect(sceneUrls()).toEqual([])
    showScene(TAVERN)
    await waitFor(() => expect(sceneUrls()).toEqual([sceneSoundUrl(TAVERN)]))

    const calls = sceneCalls().length
    // A picture shown over the scene, and the same scene sent again: nothing for the sound to do.
    const stages = useStageStore()
    stages.set({
      ...stages.stageOf(crookhollow.id),
      image: { id: 'i1', file: { collection: 'images', record: 'i1', name: 'map.png' }, caption: null, shownAt: '2026-11-12T10:00:00.000Z' },
    })
    showScene(TAVERN)
    await settle()
    await expect(sceneCalls()).toHaveLength(calls)

    showScene(RAIN)
    await waitFor(() => expect(sceneUrls()).toEqual([sceneSoundUrl(TAVERN), sceneSoundUrl(RAIN)]))
  },
}

/** A scene with no sound sends nothing for it (null: fade out), and the first answer a device gives is only a preference. */
export const SceneWithoutSoundFadesOut: Story = {
  decorators: [withMediaPrefs({ sound: 'on', background: false })],
  play: async () => {
    showScene(TAVERN)
    await waitFor(() => expect(sceneUrls()).toHaveLength(1))
    showScene(FOREST)
    await waitFor(() => expect(sceneCalls().at(-1)).toEqual({ method: 'setScene', src: null }))
  },
}

/** Leaving the game's table: the sound fades out and the default background returns. */
export const LeavingTheGameStops: Story = {
  decorators: [withLiveScene(TAVERN), withMediaPrefs({ sound: 'on', background: true })],
  // Pictures decode at once, so the scene's picture can be shown without a server behind it.
  beforeEach() {
    return controlDecode(true).restore
  },
  play: async ({ canvasElement }) => {
    const base = () => canvasElement.querySelector<HTMLElement>('[data-layer="base"]')!.style.backgroundImage
    await waitFor(() => expect(sceneUrls()).toEqual([sceneSoundUrl(TAVERN)]))
    await waitFor(() => expect(base()).toContain('/api/files/scenes/'), { timeout: 4000 })

    await storyRouter.push('/games')
    await waitFor(() => expect(sceneCalls().at(-1)).toEqual({ method: 'setScene', src: null }))
    await waitFor(() => expect(base()).not.toContain('/api/files/'), { timeout: 4000 })
    await expect(base()).toContain('bg')
  },
}

/** The volume preference reaches the service when it changes, and the table's slider writes it. */
export const VolumeFollowsThePref: Story = {
  decorators: [withMediaPrefs({ sound: 'on', volume: 0.6, background: false })],
  play: async ({ canvasElement }) => {
    const volumes = () => sceneAudioCalls.flatMap(c => (c.method === 'setVolume' ? [c.level] : []))
    await expect(volumes()).toEqual([0.6])
    useMediaPrefsStore().volume = 0.3
    await waitFor(() => expect(volumes()).toEqual([0.6, 0.3]))
    const slider = within(canvasElement).getByRole('slider', { name: 'Volume' })
    slider.focus()
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(volumes().at(-1)).toBeCloseTo(0.35))
  },
}

/** The prompt rises over the table once, and turning sound on from it starts the scene. */
export const PromptThenPlay: Story = {
  decorators: [withLiveScene(TAVERN), withMediaPrefs({ background: false })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('The table has sound')).toBeVisible()
    await expect(sceneUrls()).toEqual([])
    await userEvent.click(canvas.getByRole('button', { name: 'Turn sound on' }))
    await waitFor(() => expect(sceneUrls()).toEqual([sceneSoundUrl(TAVERN)]))
    await expect(sceneAudioCalls.filter(c => c.method === 'unlock')).toHaveLength(1)
    await waitFor(() => expect(canvas.queryByText('The table has sound')).toBeNull())
    await expect(emptyStage(crookhollow.id).sound).toBeNull()
  },
}

/** A scene is on, with a picture and a sound, and this device has not chosen: the picture shows and the prompt asks. */
export const AsksOverTheScene: Story = {
  decorators: [withLiveScene(TAVERN), withMediaPrefs()],
  beforeEach() {
    return controlDecode(true).restore
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('The table has sound')).toBeVisible()
    await expect(sceneUrls()).toEqual([])
    await waitFor(
      () => expect(canvasElement.querySelector<HTMLElement>('[data-layer="base"]')!.style.backgroundImage).toContain('/api/files/scenes/'),
      { timeout: 4000 },
    )
  },
}

/** The browser holds the sound back until a tap: the short prompt with one button. */
export const BlockedOverTheScene: Story = {
  decorators: [withLiveScene(TAVERN), withMediaPrefs({ sound: 'on', blocked: true, background: false })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('Sound is paused by the browser')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'No sound' })).toBeNull()
  },
}

// The prompt over a table with sheets: the same wiring as the Table above, with the party and the dice bar.
const SheetsTable = defineComponent({
  components: { GameLayout, PlayersPanel, SoundPrompt, PartyView, DiceDrawer },
  setup() {
    const { backdropUrl } = useStagePlayback()
    return { backdropUrl }
  },
  template: `
    <GameLayout :backdrop-url="backdropUrl">
      <PartyView />
      <SoundPrompt />
      <template #left><PlayersPanel /></template>
      <template #right><DiceDrawer /></template>
    </GameLayout>`,
})

const rect = (el: Element) => el.getBoundingClientRect()
const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

async function promptKeepsClear(canvasElement: HTMLElement, size: [number, number]) {
  const setViewport = (globalThis as { __setStoryViewport?: (width: number, height: number) => Promise<void> }).__setStoryViewport
  // Only the test runner can resize the browser; in Storybook itself the viewport toolbar does that.
  if (!setViewport) return
  await setViewport(...size)
  try {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText('The table has sound')).toBeVisible()
    const card = canvasElement.querySelector('.sp-card')!
    await waitFor(() => expect(getComputedStyle(canvasElement.querySelector('.gl-center')!).paddingBottom).not.toBe('0px'))
    const prompt = rect(card)
    for (const selector of ['.drawer-input-bar', '.party-dots']) {
      for (const el of canvasElement.querySelectorAll(selector)) {
        if (rect(el).height > 0) await expect(overlaps(prompt, rect(el))).toBe(false)
      }
    }
    // The sheets end above the prompt, so the last row of a sheet is reached by scrolling its own column.
    const columns = canvasElement.querySelectorAll('.sheet-column')
    await expect(columns.length).toBeGreaterThan(0)
    for (const column of columns) await expect(rect(column).bottom).toBeLessThanOrEqual(prompt.top + 1)
    const body = canvasElement.querySelector<HTMLElement>('.sheet-column-body')!
    body.scrollTop = body.scrollHeight
    await expect(body.scrollTop + body.clientHeight).toBeGreaterThanOrEqual(body.scrollHeight - 1)
    // Answered: the room is given back.
    await userEvent.click(canvas.getByRole('button', { name: 'No sound' }))
    await waitFor(() => expect(getComputedStyle(canvasElement.querySelector('.gl-center')!).paddingBottom).toBe('0px'))
  } finally {
    await setViewport(1280, 720)
  }
}

/** A 600 px high desktop window: the prompt sits between the panels, clear of the dice bar, and the sheets end above it. */
export const PromptKeepsClearOnAShortDesktop: Story = {
  render: () => ({ ...SheetsTable }),
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  decorators: [withLiveScene(TAVERN), withMediaPrefs({ background: false })],
  play: ({ canvasElement }) => promptKeepsClear(canvasElement, [1280, 600]),
}

/** A 375 x 667 phone: the prompt stays clear of the tray's page dots, and the sheets end above it. */
export const PromptKeepsClearOnASmallPhone: Story = {
  render: () => ({ ...SheetsTable }),
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  decorators: [withLiveScene(TAVERN), withMediaPrefs({ background: false })],
  play: ({ canvasElement }) => promptKeepsClear(canvasElement, [375, 667]),
}
