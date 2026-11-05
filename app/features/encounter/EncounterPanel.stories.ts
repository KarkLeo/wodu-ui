import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, fn, spyOn, userEvent, waitFor, within } from 'storybook/test'
import EncounterPanel from './EncounterPanel.vue'
import {
  CROOKHOLLOW_META,
  crookhollow,
  ENCOUNTER_MONSTERS,
  encounterMonsterRows,
  MONSTERS,
  PARTY,
} from '@/stories/fixtures'
import { atRoute, withGameTable } from '@/stories/state'
import { emptyEncounter } from '@/domain/encounter'
import { useEncounterStore } from '@/stores/encounter'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useToastsStore } from '@/stores/toasts'
import { addMonster, closeEncounter, openEncounter } from '@/transport/encounter'
import { mode, setMode } from '@/transport/mode'
import type { EncounterMonster } from '@/types/encounter'
import { pb, resetRecords } from '../../../.storybook/mocks/pb'

/** The master's open encounter, loaded as openEncounter() would leave the store. */
function withEncounter(monsters: EncounterMonster[] = ENCOUNTER_MONSTERS): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      resetRecords('encounter_monsters', encounterMonsterRows(crookhollow, monsters))
      const store = useEncounterStore()
      store.clearAll()
      store.setAll(crookhollow.id, emptyEncounter(crookhollow.id), structuredClone(monsters), [])
      useToastsStore().clearAll()
    },
    template: '<div style="width: min(440px, 100vw - 32px); height: 640px"><story /></div>',
  })
}

const meta = {
  title: 'Encounter/EncounterPanel',
  component: EncounterPanel,
  parameters: { layout: 'centered' },
  // Decorators run inside out: the encounter is seeded after the table (signed in, the game known).
  decorators: [withEncounter(), withGameTable(crookhollow, PARTY, CROOKHOLLOW_META)],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
} satisfies Meta<typeof EncounterPanel>

export default meta
type Story = StoryObj<typeof meta>

const body = (el: HTMLElement) => within(el.ownerDocument.body)
const cardOf = (el: HTMLElement, name: string) => within(within(el).getByRole('article', { name }))
const cardNames = (el: HTMLElement) => within(el).getAllByRole('article').map(a => a.getAttribute('aria-label'))
const monsterIn = (id: string) => useEncounterStore().monsterById(id)!
const hpText = (el: HTMLElement, name: string) => within(el).getByRole('article', { name }).querySelector('.hp-bar-values')!.textContent

/**
 * Out of the list. A scripted click focuses its button by script, which Chromium counts as `:focus-visible` (a
 * real mouse press does not), so the focus goes too.
 */
async function leaveList(el: Element) {
  await userEvent.unhover(el)
  ;(el.ownerDocument.activeElement as HTMLElement | null)?.blur()
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(cardNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1', 'Wolf #1'])
    await expect(within(canvasElement).getByRole('heading', { name: 'Defeated' })).toBeVisible()
  },
}

export const Empty: Story = {
  decorators: [withEncounter([])],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('No monsters yet.')).toBeVisible()
  },
}

/** Opening a card never closes another. */
export const OpensSeveral: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await userEvent.click(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Show details' }))
    await userEvent.click(cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: 'Show details' }))
    await expect(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(useEncounterStore().expanded.size).toBe(2)
  },
}

export const SelectsOnClick: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    const goblin = cardOf(canvasElement, 'Goblin #1')
    await userEvent.click(goblin.getByRole('button', { name: /Goblin/ }))
    await expect(store.selectedMonsterId).toBe('story-enc-goblin-1')
    await userEvent.click(goblin.getByRole('button', { name: /Goblin/ }))
    await expect(store.selectedMonsterId).toBeNull()
  },
}

export const HpButtons: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('encounter_monsters'), 'update')
    const ogre = cardOf(canvasElement, 'Ogre #1')
    await userEvent.click(ogre.getByRole('button', { name: 'Lower HP by 1' }))
    await expect(hpText(canvasElement, 'Ogre #1')).toBe('17/18')
    await waitFor(() => expect(update).toHaveBeenCalledOnce())
    await expect(update.mock.calls[0]![0]).toBe('story-enc-ogre-1')
    await expect((update.mock.calls[0]![1] as { data: EncounterMonster }).data.hp).toBe(17)
    await userEvent.click(ogre.getByRole('button', { name: 'Raise HP by 1' }))
    await waitFor(() => expect(monsterIn('story-enc-ogre-1').hp).toBe(18))
  },
}

/** Three quick clicks: the screen only goes down, the last value lands, and the server sees at most two writes. */
export const FastClicks: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const collection = pb.collection('encounter_monsters')
    const original = collection.update
    const update = spyOn(collection, 'update').mockImplementation(async (id, body) => {
      await new Promise(r => setTimeout(r, 150))
      return original(id, body)
    })
    const ogre = cardOf(canvasElement, 'Ogre #1')
    const seen: number[] = []
    const sample = setInterval(() => seen.push(Number(hpText(canvasElement, 'Ogre #1')!.split('/')[0])), 10)
    const minus = ogre.getByRole('button', { name: 'Lower HP by 1' })
    await userEvent.click(minus)
    await userEvent.click(minus)
    await userEvent.click(minus)
    await waitFor(() => expect(update.mock.calls.length).toBeGreaterThan(0))
    await new Promise(r => setTimeout(r, 600))
    clearInterval(sample)

    const record = await pb.collection('encounter_monsters').getOne('story-enc-ogre-1') as unknown as { data: EncounterMonster }
    await expect(record.data.hp).toBe(15)
    await expect(update.mock.calls.length).toBeLessThanOrEqual(2)
    await expect(seen.length).toBeGreaterThan(0)
    for (let i = 1; i < seen.length; i++) await expect(seen[i]!).toBeLessThanOrEqual(seen[i - 1]!)
    await expect(hpText(canvasElement, 'Ogre #1')).toBe('15/18')
  },
}

/** A refused write puts the confirmed value back and says so. */
export const FailedWriteRestores: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    spyOn(pb.collection('encounter_monsters'), 'update').mockRejectedValue(new ClientResponseError({ status: 400 }))
    await userEvent.click(cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: 'Lower HP by 1' }))
    await waitFor(() => expect(hpText(canvasElement, 'Ogre #1')).toBe('18/18'))
    await waitFor(() => expect(useToastsStore().items.map(t => t.text)).toEqual(['Failed to save the monster. Check your connection.']))
  },
}

export const KillAndRevive: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const defeatedLabel = () => within(canvasElement).queryByRole('heading', { name: 'Defeated' })
    const order = () => within(canvasElement).getAllByRole('article').map(a => a.getAttribute('aria-label'))

    const goblinCard = () => within(canvasElement).getByRole('article', { name: 'Goblin #1' })
    await userEvent.click(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Kill' }))
    // The pointer is on the card, so it stays in its slot, rendered dead, until the pointer leaves.
    await expect(order()).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1', 'Wolf #1'])
    await leaveList(goblinCard())
    await waitFor(() => expect(order()).toEqual(['Goblin #2', 'Ogre #1', 'Goblin #1', 'Wolf #1']))
    const label = defeatedLabel()!
    const articles = within(canvasElement).getAllByRole('article')
    await expect(label.compareDocumentPosition(articles[2]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expect(label.compareDocumentPosition(articles[1]!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    await expect(monsterIn('story-enc-goblin-1').hp).toBe(0)
    await expect(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Attack' })).toBeDisabled()

    await userEvent.click(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Revive (1 HP)' }))
    await expect(order()).toEqual(['Goblin #2', 'Ogre #1', 'Goblin #1', 'Wolf #1'])
    await leaveList(goblinCard())
    await waitFor(() => expect(order()).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1', 'Wolf #1']))
    await expect(hpText(canvasElement, 'Goblin #1')).toBe('1/3')
    await expect(monsterIn('story-enc-goblin-1').diedAt).toBeUndefined()
  },
}

export const KillingDeselects: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    store.selectMonster('story-enc-goblin-1')
    await userEvent.click(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Kill' }))
    await expect(store.selectedMonsterId).toBeNull()
  },
}

export const ConditionsToggle: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('encounter_monsters'), 'update')
    const goblin = cardOf(canvasElement, 'Goblin #1')
    await userEvent.click(goblin.getByRole('button', { name: 'Show details' }))
    await userEvent.click(goblin.getByRole('button', { name: 'Burning' }))
    await waitFor(() => expect(monsterIn('story-enc-goblin-1').conditions).toEqual(['burning']))
    await waitFor(() => expect(update).toHaveBeenCalledOnce())
    await expect(goblin.getByRole('button', { name: 'Burning' })).toHaveAttribute('aria-pressed', 'true')
  },
}

export const RemoveConfirms: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const remove = spyOn(pb.collection('encounter_monsters'), 'delete')
    await userEvent.click(cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: 'Show details' }))
    await userEvent.click(cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: 'Remove' }))
    const dialog = await body(canvasElement).findByRole('dialog', { name: 'Remove Ogre #1?' })
    await expect(remove).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    // The title keeps the name while the sheet closes.
    await expect(body(canvasElement).queryByText('Remove ?')).toBeNull()
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
    await expect(monsterIn('story-enc-ogre-1')).toBeDefined()

    await userEvent.click(cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: 'Remove' }))
    const again = await body(canvasElement).findByRole('dialog', { name: 'Remove Ogre #1?' })
    await userEvent.click(within(again).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('story-enc-ogre-1'))
    await waitFor(() => expect(cardNames(canvasElement)).not.toContain('Ogre #1'))
  },
}

export const Attack: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const create = spyOn(pb.collection('roll_events'), 'create')
    await userEvent.click(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Attack' }))
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    const sent = create.mock.calls[0]![0] as { character: string; game: string; character_id: string; data: { characterName: string; monster: { n: number } } }
    await expect(sent.character).toBe('')
    await expect(sent.game).toBe(crookhollow.id)
    await expect(sent.character_id).toBe('story-enc-goblin-1')
    await expect(sent.data.characterName).toBe('Goblin #1')
    await expect(useRollHistoryStore().records.at(-1)?.characterName ?? useRollHistoryStore().records[0]?.characterName).toBe('Goblin #1')
    // An attack is an interaction: the card stays on top.
    await expect(cardNames(canvasElement)[0]).toBe('Goblin #1')
  },
}

export const AttackIgnoresDead: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const create = spyOn(pb.collection('roll_events'), 'create')
    const wolf = cardOf(canvasElement, 'Wolf #1')
    await userEvent.click(wolf.getByRole('button', { name: 'Attack' }), { pointerEventsCheck: 0 })
    await expect(create).not.toHaveBeenCalled()
  },
}

/** Editing changes this instance only: the library is never written. */
export const Edit: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('encounter_monsters'), 'update')
    const libraryUpdate = spyOn(pb.collection('monsters'), 'update')
    const goblin = cardOf(canvasElement, 'Goblin #1')
    await userEvent.click(goblin.getByRole('button', { name: 'Show details' }))
    await userEvent.click(goblin.getByRole('button', { name: 'Edit' }))
    const form = within(await body(canvasElement).findByRole('dialog', { name: 'Edit monster' }))
    await expect(form.getByLabelText('HP')).toHaveValue('3')
    await userEvent.clear(form.getByLabelText('HP'))
    await userEvent.type(form.getByLabelText('HP'), '5')
    await userEvent.clear(form.getByLabelText('Name'))
    await userEvent.type(form.getByLabelText('Name'), 'Goblin chief')
    await userEvent.click(form.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(update).toHaveBeenCalledOnce())
    await expect(update.mock.calls[0]![0]).toBe('story-enc-goblin-1')
    const saved = (update.mock.calls[0]![1] as { data: EncounterMonster }).data
    await expect(saved).toMatchObject({ name: 'Goblin chief', maxHp: 5, hp: 3, n: 1, sourceId: 'story-monster-goblin' })
    await expect(libraryUpdate).not.toHaveBeenCalled()
    await waitFor(() => expect(cardNames(canvasElement)[0]).toBe('Goblin chief #1'))
  },
}

/** "Monster" opens the picker over the library; the panel behind shows each add. */
export const AddsFromThePanel: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Monster' }))
    const sheet = await body(canvasElement).findByRole('dialog', { name: 'Add a monster' })
    const starter = await within(sheet).findByRole('list', { name: 'Starter set' })
    const dragon = within(starter).getAllByRole('listitem').find(li => li.textContent?.startsWith('Dragon'))!
    await userEvent.click(within(dragon).getByRole('button', { name: 'Add' }))
    // The open sheet hides the panel from the accessibility tree.
    await waitFor(() => expect([...canvasElement.querySelectorAll('article')].map(a => a.getAttribute('aria-label'))).toContain('Dragon #1'))
    await expect(body(canvasElement).getByRole('dialog', { name: 'Add a monster' })).toBeVisible()
  },
}

/** What is waiting to be sent goes nowhere once the mode has changed. */
export const NoWriteAfterModeSwitch: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const collection = pb.collection('encounter_monsters')
    const original = collection.update
    const update = spyOn(collection, 'update').mockImplementation(async (id, body) => {
      await new Promise(r => setTimeout(r, 150))
      return original(id, body)
    })
    const lower = cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: 'Lower HP by 1' })
    await userEvent.click(lower)
    await userEvent.click(lower)
    await expect(update).toHaveBeenCalledOnce()
    const before = mode.value
    setMode('offline')
    try {
      await new Promise(r => setTimeout(r, 300))
      await expect(update).toHaveBeenCalledOnce()
    } finally {
      setMode(before)
    }
  },
}

/** A failed unsubscribe is what a dropped network looks like: quiet, not an unhandled rejection. */
export const UnsubscribeFailureIsQuiet: Story = {
  tags: ['no-visual'],
  play: async () => {
    const unhandled = fn()
    const listener = (e: PromiseRejectionEvent) => {
      e.preventDefault()
      unhandled(e.reason)
    }
    window.addEventListener('unhandledrejection', listener)
    // Not a spy: a spy handles the promise it returns, so nothing would ever go unhandled.
    const collection = pb.collection('encounters')
    const original = collection.unsubscribe
    collection.unsubscribe = () => Promise.reject(new Error('network'))
    try {
      closeEncounter()
      await new Promise(r => setTimeout(r, 50))
      await expect(unhandled).not.toHaveBeenCalled()
    } finally {
      collection.unsubscribe = original
      window.removeEventListener('unhandledrejection', listener)
    }
  },
}

/** Adding drops the ids of removed instances from the manual order, so it stops growing. */
export const AddingPrunesManualOrder: Story = {
  tags: ['no-visual'],
  play: async () => {
    const store = useEncounterStore()
    const ids = ENCOUNTER_MONSTERS.map(m => m.id)
    store.setState({ ...store.state!, manualOrder: ['gone-1', ...ids, 'gone-2'] })
    const added = await addMonster(crookhollow.id, MONSTERS[1]!)
    await expect(store.state?.manualOrder).toEqual([added!.id, ...ids])
  },
}

const refused = () => new ClientResponseError({ status: 500 })

/** Loading for the first time: a quiet note. */
export const Loading: Story = {
  decorators: [
    (story) => ({
      components: { story },
      setup() {
        const store = useEncounterStore()
        store.clearAll()
        store.startLoading(crookhollow.id)
      },
      template: '<story />',
    }),
  ],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Loading…')
  },
}

/** A first load the server refused: Try again loads it. */
export const LoadFailed: Story = {
  decorators: [
    (story) => ({
      components: { story },
      setup() {
        const store = useEncounterStore()
        store.clearAll()
        store.startLoading(crookhollow.id)
        store.setFailed(crookhollow.id)
      },
      template: '<story />',
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Couldn’t load the encounter.')
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(cardNames(canvasElement)).toContain('Ogre #1'))
    await expect(canvas.queryByRole('alert')).toBeNull()
    await expect(useEncounterStore().status).toBe('ready')
  },
}

/** A refresh the server refused keeps the list, working, with a notice and Try again. */
export const RefreshFailedKeepsList: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const store = useEncounterStore()
    const list = spyOn(pb.collection('encounter_monsters'), 'getFullList').mockRejectedValueOnce(refused())
    await openEncounter(crookhollow.id)
    await expect(list).toHaveBeenCalledOnce()
    await expect(store.status).toBe('ready')
    await expect(canvas.getByRole('alert')).toHaveTextContent('Couldn’t load the encounter.')
    await expect(cardNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1', 'Wolf #1'])

    await userEvent.click(cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: 'Lower HP by 1' }))
    await expect(hpText(canvasElement, 'Ogre #1')).toBe('17/18')

    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(canvas.queryByRole('alert')).toBeNull())
    await expect(store.status).toBe('ready')
  },
}

/** The refresh's notice comes on its own, maybe under the pointer: every card stays exactly where it was. */
export const RefreshNoticeMovesNoCard: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tops = () => within(canvasElement).getAllByRole('article').map(a => a.getBoundingClientRect().top)
    const before = tops()
    spyOn(pb.collection('encounter_monsters'), 'getFullList').mockRejectedValueOnce(refused())
    await openEncounter(crookhollow.id)
    await expect(canvas.getByRole('alert')).toBeVisible()
    await expect(tops()).toEqual(before)
  },
}

/** A refused refresh with nothing on screen says so, rather than "no monsters". */
export const RefreshFailedOnEmptyList: Story = {
  decorators: [withEncounter([])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    spyOn(pb.collection('encounter_monsters'), 'getFullList').mockRejectedValueOnce(refused())
    await openEncounter(crookhollow.id)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Couldn’t load the encounter.')
    await expect(canvas.queryByText('No monsters yet')).toBeNull()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(canvas.queryByRole('alert')).toBeNull())
  },
}

/** Killed on another device: no longer selected here, and a revive does not select it again. */
export const KilledElsewhereDeselects: Story = {
  tags: ['no-visual'],
  play: async () => {
    const store = useEncounterStore()
    store.selectMonster('story-enc-goblin-1')
    const goblin = monsterIn('story-enc-goblin-1')
    store.upsertMonster({ ...goblin, hp: 0, diedAt: goblin.touchedAt + 1, touchedAt: goblin.touchedAt + 1 })
    await expect(store.selectedMonsterId).toBeNull()
    store.upsertMonster({ ...goblin, hp: 1, touchedAt: goblin.touchedAt + 2 })
    await expect(store.selectedMonsterId).toBeNull()
  },
}

const aliveNames = (el: HTMLElement) => [...el.querySelectorAll('.ep-alive article')].map(a => a.getAttribute('aria-label'))
const gripOf = (el: HTMLElement, name: string) => cardOf(el, name).queryByRole('button', { name: /^Reorder/ })
const switchTo = (el: HTMLElement, mode: 'Auto' | 'Manual') => userEvent.click(within(el).getByRole('radio', { name: mode }))
const updatesOf = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(c => (c[1] as { data: { manualOrder: string[]; sortMode: string } }).data)

const LOWER = 'Lower HP by 1'
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

/** The anti-goal: a click must land on the card the pointer is over, so the list waits until the pointer leaves it. */
export const AutoHoldsUnderPointer: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const user = userEvent.setup()
    const canvas = within(canvasElement)
    const ogre = canvas.getByRole('article', { name: 'Ogre #1' })
    await user.hover(ogre)
    await user.click(within(ogre).getByRole('button', { name: LOWER }))
    await expect(monsterIn('story-enc-ogre-1').hp).toBe(17)
    await pause(150)
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])
    await user.click(within(ogre).getByRole('button', { name: LOWER }))
    await expect(monsterIn('story-enc-ogre-1').hp).toBe(16)
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])

    // Leaving the card is not leaving the list: another card, then a gap between cards.
    await user.hover(canvas.getByRole('article', { name: 'Goblin #1' }))
    await pause(150)
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])
    await user.hover(canvasElement.querySelector('.ep-alive')!)
    await pause(150)
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])

    await user.unhover(canvasElement.querySelector('.ep-alive')!)
    ;(canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur()
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Ogre #1', 'Goblin #1', 'Goblin #2']))
  },
}

/**
 * Going from one card to another: press row 3, move to the same button on row 2, press. When the list moved at
 * the first leave, the card above slid into row 2 and took the press.
 */
export const PressLandsOnTheNextCard: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const rollWrites = spyOn(pb.collection('roll_events'), 'create')
    const user = userEvent.setup()
    const canvas = within(canvasElement)
    const ogre = canvas.getByRole('article', { name: 'Ogre #1' })
    const goblin2 = canvas.getByRole('article', { name: 'Goblin #2' })
    const GOBLIN_2_HP = monsterIn('story-enc-goblin-2').hp
    const hpSlot = centreOf(within(goblin2).getByRole('button', { name: LOWER }))
    const attackSlot = centreOf(within(goblin2).getByRole('button', { name: 'Attack' }))

    await user.click(within(ogre).getByRole('button', { name: LOWER }))
    await user.hover(goblin2)
    // As long as a hand takes to get there, reorder animation included.
    await pause(400)
    await expect(cardAt(hpSlot.x, hpSlot.y)).toBe('Goblin #2')
    await user.click(document.elementFromPoint(hpSlot.x, hpSlot.y)!)
    await expect(monsterIn('story-enc-ogre-1').hp).toBe(17)
    await expect(monsterIn('story-enc-goblin-2').hp).toBe(GOBLIN_2_HP - 1)
    await expect(monsterIn('story-enc-goblin-1').hp).toBe(3)

    // With Attack a wrong card would be a wrong public roll.
    await user.click(document.elementFromPoint(attackSlot.x, attackSlot.y)!)
    await waitFor(() => expect(rollWrites).toHaveBeenCalledOnce())
    await expect((rollWrites.mock.calls[0]![0] as { data: { characterName: string } }).data.characterName).toBe('Goblin #2')
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])
  },
}

/** Enter on a card's button in Auto: the card keeps its slot and the button its focus until the focus leaves the list. */
export const KeyboardKeepsFocus: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const lower = cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: LOWER })
    lower.focus()
    await expect(lower.matches(':focus-visible')).toBe(true)
    await userEvent.keyboard('{Enter}')
    await expect(monsterIn('story-enc-ogre-1').hp).toBe(17)
    await pause(150)
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])
    await expect(canvasElement.ownerDocument.activeElement).toBe(lower)

    // On to another card's button: still the list's.
    const other = cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: LOWER })
    other.focus()
    await pause(150)
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])
    await expect(canvasElement.ownerDocument.activeElement).toBe(other)

    canvas.getByRole('button', { name: 'Monster' }).focus()
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Ogre #1', 'Goblin #1', 'Goblin #2']))
  },
}

/** A focus given back to a card (by Esc, say) holds the list only until the pointer moves outside it. */
export const PointerMoveOutsideEndsFocusHold: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const lower = cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: LOWER })
    lower.focus()
    await userEvent.keyboard('{Enter}')
    await expect(monsterIn('story-enc-ogre-1').hp).toBe(17)

    // Inside the list it still holds.
    lower.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await pause(150)
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])

    canvasElement.querySelector('.ep-head')!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Ogre #1', 'Goblin #1', 'Goblin #2']))
  },
}

/** A focused card that goes away sends no focusout; the hold must not outlive it. */
export const RemovedFocusedCardReleases: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: LOWER }).focus()
    store.removeMonster('story-enc-ogre-1')
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2']))
    store.putMonster({ ...monsterIn('story-enc-goblin-2'), touchedAt: 9_000_000_000_000 })
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Goblin #2', 'Goblin #1']))
  },
}

/** A tap: the touch press, then the click it turns into. No mouse pointer enters the list. */
function tap(el: Element) {
  el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))
  el.closest('button')!.click()
}

/** On touch there is no leave: the hold ends about 2 seconds after the last touch. */
export const TouchHoldsForTwoSeconds: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const ogre = within(canvasElement).getByRole('article', { name: 'Ogre #1' })
    tap(within(ogre).getByRole('button', { name: LOWER }))
    await pause(600)
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Ogre #1', 'Goblin #1', 'Goblin #2']), { timeout: 4000 })
  },
}

export const ManualCopiesAuto: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    await expect(gripOf(canvasElement, 'Goblin #1')).toBeNull()
    await switchTo(canvasElement, 'Manual')
    await waitFor(() => expect(store.state?.sortMode).toBe('manual'))
    await expect(store.state?.manualOrder).toEqual(['story-enc-goblin-1', 'story-enc-goblin-2', 'story-enc-ogre-1'])
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])
    await expect(gripOf(canvasElement, 'Goblin #1')).toBeVisible()

    // Touching a card reorders nothing by hand...
    await userEvent.click(cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: 'Lower HP by 1' }))
    await leaveList(within(canvasElement).getByRole('article', { name: 'Ogre #1' }))
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])

    // ...but going back to Auto and again to Manual copies the new auto order.
    await switchTo(canvasElement, 'Auto')
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Ogre #1', 'Goblin #1', 'Goblin #2']))
    await expect(gripOf(canvasElement, 'Ogre #1')).toBeNull()
    await switchTo(canvasElement, 'Manual')
    await waitFor(() => expect(store.state?.manualOrder).toEqual(['story-enc-ogre-1', 'story-enc-goblin-1', 'story-enc-goblin-2']))
    await expect(aliveNames(canvasElement)).toEqual(['Ogre #1', 'Goblin #1', 'Goblin #2'])
  },
}

export const ManualKeyboardMove: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const update = spyOn(pb.collection('encounters'), 'update')
    const store = useEncounterStore()
    await switchTo(canvasElement, 'Manual')
    await waitFor(() => expect(store.state?.sortMode).toBe('manual'))
    update.mockClear()

    gripOf(canvasElement, 'Ogre #1')!.focus()
    await userEvent.keyboard('{ArrowUp}')
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Ogre #1', 'Goblin #2']))
    await expect(store.state?.manualOrder).toEqual(['story-enc-goblin-1', 'story-enc-ogre-1', 'story-enc-goblin-2'])
    await waitFor(() => expect(update).toHaveBeenCalled())
    await expect(updatesOf(update).at(-1)?.manualOrder).toEqual(['story-enc-goblin-1', 'story-enc-ogre-1', 'story-enc-goblin-2'])
    // The grip keeps the focus, so the keys can be repeated.
    await waitFor(() => expect(document.activeElement).toBe(gripOf(canvasElement, 'Ogre #1')))
    await userEvent.keyboard('{ArrowUp}')
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Ogre #1', 'Goblin #1', 'Goblin #2']))
    await userEvent.keyboard('{ArrowUp}')
    await expect(aliveNames(canvasElement)).toEqual(['Ogre #1', 'Goblin #1', 'Goblin #2'])

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1']))
    await waitFor(() => expect(store.state?.manualOrder).toEqual(['story-enc-goblin-1', 'story-enc-goblin-2', 'story-enc-ogre-1']))
  },
}

export const ManualNewOnTop: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    await switchTo(canvasElement, 'Manual')
    await waitFor(() => expect(store.state?.sortMode).toBe('manual'))
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Monster' }))
    const sheet = await body(canvasElement).findByRole('dialog', { name: 'Add a monster' })
    const starter = await within(sheet).findByRole('list', { name: 'Starter set' })
    const dragon = within(starter).getAllByRole('listitem').find(li => li.textContent?.startsWith('Dragon'))!
    await userEvent.click(within(dragon).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(aliveNames(canvasElement)[0]).toBe('Dragon #1'))
    await waitFor(() => expect(store.state?.manualOrder[0]).toBe(store.monsters.find(m => m.name === 'Dragon')!.id))
    await expect(aliveNames(canvasElement).slice(1)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])
  },
}

const wolfCard = (el: HTMLElement) => within(el).getByRole('article', { name: 'Wolf #1' })

/** Revive goes first in a manual order, by the Revive button and by `+` alike. */
export const ManualReviveOnTop: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    await switchTo(canvasElement, 'Manual')
    await waitFor(() => expect(store.state?.sortMode).toBe('manual'))
    await userEvent.click(within(wolfCard(canvasElement)).getByRole('button', { name: 'Revive (1 HP)' }))
    await leaveList(wolfCard(canvasElement))
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Wolf #1', 'Goblin #1', 'Goblin #2', 'Ogre #1']))
    await waitFor(() => expect(store.state?.manualOrder[0]).toBe('story-enc-wolf-1'))
  },
}

export const ManualRevivePlusOnTop: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    await switchTo(canvasElement, 'Manual')
    await waitFor(() => expect(store.state?.sortMode).toBe('manual'))
    await userEvent.click(within(wolfCard(canvasElement)).getByRole('button', { name: 'Raise HP by 1' }))
    await expect(monsterIn('story-enc-wolf-1').diedAt).toBeUndefined()
    await leaveList(wolfCard(canvasElement))
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Wolf #1', 'Goblin #1', 'Goblin #2', 'Ogre #1']))
    await waitFor(() => expect(store.state?.manualOrder[0]).toBe('story-enc-wolf-1'))
  },
}

const deadNamesOf = (el: HTMLElement) => [...el.querySelectorAll('.ep-dead-list article')].map(a => a.getAttribute('aria-label'))
const leave = (el: HTMLElement, name: string) => leaveList(within(el).getByRole('article', { name }))

/** Newest death first, in either mode; a dead card has no grip. */
async function killTwo(canvasElement: HTMLElement) {
  await userEvent.click(cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: 'Kill' }))
  await leave(canvasElement, 'Ogre #1')
  await waitFor(() => expect(deadNamesOf(canvasElement)).toEqual(['Ogre #1', 'Wolf #1']))
  await userEvent.click(cardOf(canvasElement, 'Goblin #2').getByRole('button', { name: 'Kill' }))
  await leave(canvasElement, 'Goblin #2')
  await waitFor(() => expect(deadNamesOf(canvasElement)).toEqual(['Goblin #2', 'Ogre #1', 'Wolf #1']))
  await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Goblin #1']))
}

export const DeadAlwaysBelow: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await killTwo(canvasElement)
    for (const name of ['Goblin #1', 'Goblin #2', 'Ogre #1', 'Wolf #1']) await expect(gripOf(canvasElement, name)).toBeNull()
  },
}

/** Auto kills, then Manual, then one more kill: the dead stay below and in death order across the switch. */
export const DeadBelowAcrossModes: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    await killTwo(canvasElement)
    await switchTo(canvasElement, 'Manual')
    await waitFor(() => expect(store.state?.sortMode).toBe('manual'))
    await expect(deadNamesOf(canvasElement)).toEqual(['Goblin #2', 'Ogre #1', 'Wolf #1'])
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1'])
    await expect(gripOf(canvasElement, 'Goblin #1')).toBeVisible()
    for (const name of ['Goblin #2', 'Ogre #1', 'Wolf #1']) await expect(gripOf(canvasElement, name)).toBeNull()

    await userEvent.click(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Kill' }))
    await leave(canvasElement, 'Goblin #1')
    await waitFor(() => expect(deadNamesOf(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1', 'Wolf #1']))
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual([]))
    await expect(store.state?.sortMode).toBe('manual')
  },
}

export const DeadBelowInManual: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    await switchTo(canvasElement, 'Manual')
    await waitFor(() => expect(store.state?.sortMode).toBe('manual'))
    await killTwo(canvasElement)
    await expect(gripOf(canvasElement, 'Goblin #1')).toBeVisible()
    for (const name of ['Goblin #2', 'Ogre #1', 'Wolf #1']) await expect(gripOf(canvasElement, name)).toBeNull()

    await userEvent.click(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Kill' }))
    await leave(canvasElement, 'Goblin #1')
    await waitFor(() => expect(deadNamesOf(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1', 'Wolf #1']))
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual([]))
  },
}

const centreOf = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
const cardAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('article')?.getAttribute('aria-label')
const clickAt = (x: number, y: number) => userEvent.click(document.elementFromPoint(x, y) as HTMLElement)

/** Clicking `−` again and again through a death: the pixel under the pointer must stay on the same card. */
async function clickThroughDeath(canvasElement: HTMLElement, touch: boolean) {
  const goblin2 = within(canvasElement).getByRole('article', { name: 'Goblin #2' })
  const { x, y } = centreOf(within(goblin2).getByRole('button', { name: 'Lower HP by 1' }))
  if (!touch) await userEvent.hover(goblin2)
  for (let i = 0; i < 4; i++) {
    await expect(cardAt(x, y)).toBe('Goblin #2')
    if (touch) tap(document.elementFromPoint(x, y)!)
    else await clickAt(x, y)
  }
  await expect(monsterIn('story-enc-goblin-2').hp).toBe(0)
  await expect(monsterIn('story-enc-goblin-2').diedAt).toBeDefined()
  await expect(monsterIn('story-enc-goblin-1').hp).toBe(3)
  await expect(monsterIn('story-enc-ogre-1').hp).toBe(18)
  await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])
  await expect(goblin2).toHaveClass('is-dead')
  if (!touch) await leaveList(goblin2)
  await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Ogre #1']), { timeout: 4000 })
}

export const DeathUnderPointerKeepsSlot: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await clickThroughDeath(canvasElement, false)
  },
}

export const DeathUnderPointerKeepsSlotManual: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await switchTo(canvasElement, 'Manual')
    await waitFor(() => expect(useEncounterStore().state?.sortMode).toBe('manual'))
    await leaveList(within(canvasElement).getByRole('radio', { name: 'Manual' }))
    await clickThroughDeath(canvasElement, false)
  },
}

export const DeathUnderTouchKeepsSlot: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    await clickThroughDeath(canvasElement, true)
  },
}

const TWO_WOLVES = [...ENCOUNTER_MONSTERS, { ...ENCOUNTER_MONSTERS[3]!, id: 'story-enc-wolf-2', n: 2, touchedAt: 100, diedAt: 100 }]

/** Reviving the second dead card: the first one slides into its place, and must not take the next click. */
export const ReviveUnderPointerKeepsSlot: Story = {
  tags: ['no-visual'],
  decorators: [withEncounter(TWO_WOLVES)],
  play: async ({ canvasElement }) => {
    const deadNames = () => [...canvasElement.querySelectorAll('.ep-dead-list article')].map(a => a.getAttribute('aria-label'))
    await expect(deadNames()).toEqual(['Wolf #1', 'Wolf #2'])
    const wolf2 = within(canvasElement).getByRole('article', { name: 'Wolf #2' })
    const { x, y } = centreOf(within(wolf2).getByRole('button', { name: 'Revive (1 HP)' }))
    await userEvent.hover(wolf2)
    await clickAt(x, y)
    await waitFor(() => expect(monsterIn('story-enc-wolf-2').diedAt).toBeUndefined())
    await expect(cardAt(x, y)).toBe('Wolf #2')
    await expect(deadNames()).toEqual(['Wolf #1', 'Wolf #2'])
    await expect(monsterIn('story-enc-wolf-1').diedAt).toBeDefined()
    await expect(wolf2).not.toHaveClass('is-dead')

    await leaveList(wolf2)
    await waitFor(() => expect(deadNames()).toEqual(['Wolf #1']))
    await expect(aliveNames(canvasElement)[0]).toBe('Wolf #2')
  },
}

/** Another device adds a monster while a card is held: it waits, and shows on top at the release. */
export const AdditionWaitsForRelease: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const goblin2 = within(canvasElement).getByRole('article', { name: 'Goblin #2' })
    await userEvent.hover(goblin2)
    useEncounterStore().putMonster({ id: 'story-enc-bat-1', sourceId: 'story-monster-bat', n: 1, name: 'Bat', hp: 1, maxHp: 1, armor: 0, damage: '1d3', conditions: [], touchedAt: 9_000_000_000_000 })
    await new Promise(r => setTimeout(r, 200))
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])
    await leaveList(goblin2)
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Bat #1', 'Goblin #1', 'Goblin #2', 'Ogre #1']))
  },
}
