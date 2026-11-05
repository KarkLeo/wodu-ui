import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import EncounterPanel from './EncounterPanel.vue'
import {
  CROOKHOLLOW_META,
  crookhollow,
  ENCOUNTER_MONSTERS,
  encounterMonsterRows,
  PARTY,
} from '@/stories/fixtures'
import { atRoute, withGameTable } from '@/stories/state'
import { emptyEncounter } from '@/domain/encounter'
import { useEncounterStore } from '@/stores/encounter'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useToastsStore } from '@/stores/toasts'
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
    template: '<div style="width: 440px; height: 640px"><story /></div>',
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

    await userEvent.click(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Kill' }))
    await waitFor(() => expect(order()).toEqual(['Goblin #2', 'Ogre #1', 'Goblin #1', 'Wolf #1']))
    const label = defeatedLabel()!
    const articles = within(canvasElement).getAllByRole('article')
    await expect(label.compareDocumentPosition(articles[2]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await expect(label.compareDocumentPosition(articles[1]!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    await expect(monsterIn('story-enc-goblin-1').hp).toBe(0)
    await expect(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Attack' })).toBeDisabled()

    await userEvent.click(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Revive (1 HP)' }))
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

const aliveNames = (el: HTMLElement) => [...el.querySelectorAll('.ep-alive article')].map(a => a.getAttribute('aria-label'))
const gripOf = (el: HTMLElement, name: string) => cardOf(el, name).queryByRole('button', { name: /^Reorder/ })
const switchTo = (el: HTMLElement, mode: 'Auto' | 'Manual') => userEvent.click(within(el).getByRole('radio', { name: mode }))
const updatesOf = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(c => (c[1] as { data: { manualOrder: string[]; sortMode: string } }).data)

/** The anti-goal: a click must land on the card the pointer is over, so the list waits until the pointer leaves. */
export const AutoHoldsUnderPointer: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const ogre = within(canvasElement).getByRole('article', { name: 'Ogre #1' })
    await userEvent.hover(ogre)
    await userEvent.click(within(ogre).getByRole('button', { name: 'Lower HP by 1' }))
    await expect(monsterIn('story-enc-ogre-1').hp).toBe(17)
    await new Promise(r => setTimeout(r, 150))
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])
    await userEvent.click(within(ogre).getByRole('button', { name: 'Lower HP by 1' }))
    await expect(monsterIn('story-enc-ogre-1').hp).toBe(16)
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1'])

    await userEvent.unhover(ogre)
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Ogre #1', 'Goblin #1', 'Goblin #2']))
  },
}

/** On touch there is no leave: the hold ends about 2 seconds after the last touch. */
export const TouchHoldsForTwoSeconds: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const ogre = within(canvasElement).getByRole('article', { name: 'Ogre #1' })
    ogre.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))
    await userEvent.click(within(ogre).getByRole('button', { name: 'Lower HP by 1' }))
    await new Promise(r => setTimeout(r, 600))
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
    await userEvent.unhover(within(canvasElement).getByRole('article', { name: 'Ogre #1' }))
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

export const ManualReviveOnTop: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    await switchTo(canvasElement, 'Manual')
    await waitFor(() => expect(store.state?.sortMode).toBe('manual'))
    await userEvent.click(cardOf(canvasElement, 'Wolf #1').getByRole('button', { name: 'Revive (1 HP)' }))
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Wolf #1', 'Goblin #1', 'Goblin #2', 'Ogre #1']))
    await waitFor(() => expect(store.state?.manualOrder[0]).toBe('story-enc-wolf-1'))
  },
}

export const DeadAlwaysBelow: Story = {
  tags: ['no-visual'],
  play: async ({ canvasElement }) => {
    const deadNames = () => [...canvasElement.querySelectorAll('.ep-dead-list article')].map(a => a.getAttribute('aria-label'))
    const store = useEncounterStore()
    await userEvent.click(cardOf(canvasElement, 'Ogre #1').getByRole('button', { name: 'Kill' }))
    await waitFor(() => expect(deadNames()).toEqual(['Ogre #1', 'Wolf #1']))
    await userEvent.click(cardOf(canvasElement, 'Goblin #2').getByRole('button', { name: 'Kill' }))
    await waitFor(() => expect(deadNames()).toEqual(['Goblin #2', 'Ogre #1', 'Wolf #1']))
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual(['Goblin #1']))

    await switchTo(canvasElement, 'Manual')
    await waitFor(() => expect(store.state?.sortMode).toBe('manual'))
    await expect(deadNames()).toEqual(['Goblin #2', 'Ogre #1', 'Wolf #1'])
    await expect(aliveNames(canvasElement)).toEqual(['Goblin #1'])
    await expect(gripOf(canvasElement, 'Goblin #1')).toBeVisible()
    for (const name of ['Goblin #2', 'Ogre #1', 'Wolf #1']) await expect(gripOf(canvasElement, name)).toBeNull()

    await userEvent.click(cardOf(canvasElement, 'Goblin #1').getByRole('button', { name: 'Kill' }))
    await waitFor(() => expect(deadNames()).toEqual(['Goblin #1', 'Goblin #2', 'Ogre #1', 'Wolf #1']))
    await waitFor(() => expect(aliveNames(canvasElement)).toEqual([]))
  },
}
