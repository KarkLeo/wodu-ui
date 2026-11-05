import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { ClientResponseError } from 'pocketbase'
import { watch } from 'vue'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'
import DiceDrawer from './DiceDrawer.vue'
import {
  brann, CHANGES, CROOKHOLLOW_META, crookhollow, ENCOUNTER_MONSTERS, encounterMonsterRows, GAMES, inGame, MEMBERS,
  oda, olden, OLDEN_META, PARTY, ROLLS, STORY_NOW, wren,
} from '@/stories/fixtures'
import { asActive, atRoute, DESKTOP_VIEWPORT, inLayout, withStores } from '@/stories/state'
import { asTeammate } from '@/stories/readonly'
import { emptyEncounter } from '@/domain/encounter'
import { useCharactersStore } from '@/stores/characters'
import { useEncounterStore } from '@/stores/encounter'
import { useToastsStore } from '@/stores/toasts'
import { closeEncounter, openEncounter } from '@/transport/encounter'
import { setScope } from '@/transport/scope'
import { totalArmor } from '@/utils/derived'
import type { Character } from '@/types/character'
import type { RollRecord } from '@/types/dice'
import type { EncounterHit, EncounterMonster } from '@/types/encounter'
import { clearPbRequests, pb, pbRequests, resetRecords } from '../../.storybook/mocks/pb'

// Same width GameLayout gives the right column; collapse and rail only exist above 960px.
const desktopColumn: Decorator = (story) => ({
  components: { story },
  template: '<div style="width: 340px; height: 100%; display: flex; justify-content: flex-end"><story /></div>',
})

const meta = {
  title: 'Layout/DiceDrawer',
  component: DiceDrawer,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (story) => ({ components: { story }, template: '<div style="height: 100dvh; display: flex; flex-direction: column; align-items: flex-end"><story /></div>' }),
    withStores({ characters: PARTY, rolls: ROLLS, changes: CHANGES }),
  ],
  // A character rolls only with its sheet open.
  loaders: [atRoute(`/party/${brann.id}`)],
} satisfies Meta<typeof DiceDrawer>

export default meta
type Story = StoryObj<typeof meta>

const pickFilter = (...names: string[]): Story['play'] => async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  for (const name of names) {
    const option = await canvas.findByRole('radio', { name })
    await userEvent.click(option)
    await expect(option).toHaveAttribute('aria-checked', 'true')
  }
}

export const Default: Story = {
  decorators: [asActive(brann.id)],
}

export const RollsOnly: Story = {
  decorators: [asActive(brann.id)],
  play: pickFilter('Rolls'),
}

export const ChangesOnly: Story = {
  decorators: [asActive(brann.id)],
  play: pickFilter('Changes'),
}

export const All: Story = {
  decorators: [asActive(brann.id)],
  play: pickFilter('Rolls', 'All'),
}

export const EmptyLog: Story = {
  decorators: [asActive(brann.id), withStores({ characters: PARTY })],
}

export const NoActiveCharacter: Story = {
  decorators: [asActive(null)],
}

export const AdvantageArmed: Story = {
  decorators: [asActive(brann.id)],
  play: async ({ canvasElement }) => {
    const chip = await within(canvasElement).findByRole('button', { name: 'Advantage' })
    await userEvent.click(chip)
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
  },
}

export const InvalidNotation: Story = {
  decorators: [asActive(brann.id)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = await canvas.findByPlaceholderText('2d6+1, d20, 4d6…')
    await userEvent.clear(input)
    await userEvent.type(input, 'three dice{enter}')
    await expect(await canvas.findByText(/Invalid format/)).toBeInTheDocument()
  },
}

export const InLayout: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [asActive(brann.id), inLayout(), desktopColumn],
}

export const Rail: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [asActive(brann.id), inLayout({ right: true }), desktopColumn],
}

export const RailEmpty: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [asActive(brann.id), inLayout({ right: true }), desktopColumn, withStores({ characters: PARTY })],
}

export const CollapseToRail: Story = {
  globals: DESKTOP_VIEWPORT,
  decorators: [asActive(brann.id), inLayout(), desktopColumn],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByLabelText('Collapse', { selector: 'button' }))
    await expect(await canvas.findByLabelText('Log', { selector: 'button' })).toBeInTheDocument()
  },
}

/** The active sheet is a teammate's (read-only): the drawer offers no roll for it and says why. */
export const ReadOnlyActive: Story = {
  decorators: [asActive(oda.id), asTeammate(PARTY)],
  loaders: [atRoute(`/games/${olden.id}/party/${oda.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(`You can’t roll for ${oda.name}.`)).toBeVisible()
    await expect(canvas.getByRole('button', { name: '2d6' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Advantage' })).toBeDisabled()
    await expect(canvas.getByPlaceholderText('2d6+1, d20, 4d6…')).toBeDisabled()
  },
}

/**
 * Brann, active at Crookhollow's table, must not follow the player to Olden's: going home and opening
 * the other table leaves no active character, and none from another table is offered a roll.
 */
export const ActiveLeftOnAnotherTable: Story = {
  tags: ['no-visual'],
  decorators: [
    asActive(brann.id),
    withStores({
      characters: [brann, wren],
      games: GAMES,
      members: MEMBERS,
      meta: { [brann.id]: inGame(crookhollow), [wren.id]: inGame(olden) },
      scope: { kind: 'game', gameId: crookhollow.id },
    }),
  ],
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const store = useCharactersStore()
    await expect(canvas.getByRole('button', { name: '2d6' })).toBeEnabled()

    setScope({ kind: 'home' })
    setScope({ kind: 'game', gameId: olden.id })
    await expect(store.activeId).toBeNull()
    await waitFor(() => expect(canvas.getByRole('button', { name: '2d6' })).toBeDisabled())
    await expect(canvas.getByText('Open a character sheet to roll.')).toBeVisible()

    // Even set active again by hand, a character from another table gets no roll here.
    store.setActive(brann.id)
    await waitFor(() => expect(canvas.getByRole('button', { name: '2d6' })).toBeDisabled())
    await expect(canvas.queryByText(`You can’t roll for ${brann.name}.`)).toBeNull()
  },
}

// ── The master's log: applying damage ───────────────────────────────────────

const GOBLIN_1 = 'story-enc-goblin-1'
const GOBLIN_2 = 'story-enc-goblin-2'
const OGRE = 'story-enc-ogre-1'

function monsterRoll(instance: EncounterMonster, id: string, total: number, minutesAgo: number): RollRecord {
  return {
    id, timestamp: STORY_NOW - minutesAgo * 60_000, notation: '1d6', dice: [{ sides: 6, value: total }],
    diceTotal: total, modifier: 0, total, label: '', purpose: { kind: 'damage', weaponName: '', formula: '1d6' },
    characterId: instance.id, characterName: `${instance.name} #${instance.n}`, monster: { id: instance.id, n: instance.n },
  }
}

const monsterNamed = (id: string) => ENCOUNTER_MONSTERS.find(m => m.id === id)!

/** The shared log plus what the master adds: a second character's damage and three monster attacks. */
const MASTER_ROLLS: RollRecord[] = [
  ...ROLLS,
  {
    id: 'roll-wren-dmg', timestamp: STORY_NOW - 5 * 60_000, notation: '1d6', dice: [{ sides: 6, value: 4 }],
    diceTotal: 4, modifier: 0, total: 4, label: 'Damage', characterId: wren.id, characterName: wren.name,
    purpose: { kind: 'damage', weaponName: 'Dagger', formula: '1d6' },
  },
  monsterRoll(monsterNamed(GOBLIN_1), 'roll-goblin-hit', 5, 3),
  monsterRoll(monsterNamed(OGRE), 'roll-ogre-hit', 8, 2),
  monsterRoll(monsterNamed(GOBLIN_2), 'roll-goblin-nick', 1, 1),
]

const HITS: EncounterHit[] = [
  { id: 'hit-1', rollId: 'roll-2', target: { kind: 'monster', id: GOBLIN_2, name: 'Goblin #2' }, sourceName: brann.name, rollTotal: 6, armor: 0, amount: 4, at: 100 },
  { id: 'hit-2', rollId: 'roll-goblin-hit', target: { kind: 'character', id: wren.id, name: wren.name }, sourceName: 'Goblin #1', rollTotal: 5, armor: 1, amount: 4, at: 200 },
]

/** The master's open encounter, as openEncounter() would leave the store; the monsters are also on the mock server. */
function withEncounter(hits: EncounterHit[] = [], game = crookhollow): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      resetRecords('encounter_monsters', encounterMonsterRows(game))
      resetRecords('encounter_hits', [])
      const store = useEncounterStore()
      store.clearAll()
      store.setAll(game.id, emptyEncounter(game.id), structuredClone(ENCOUNTER_MONSTERS), structuredClone(hits))
      useToastsStore().clearAll()
    },
    template: '<story />',
  })
}

function selecting(monsterId: string | null): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      useEncounterStore().selectMonster(monsterId)
    },
    template: '<story />',
  })
}

/** Crookhollow's table as its master. Decorators run inside out: list this last, so the table is set up first. */
const masterTable = (opts: { characters?: Character[]; meta?: typeof CROOKHOLLOW_META; rolls?: RollRecord[] } = {}) =>
  withStores({
    characters: opts.characters ?? PARTY,
    games: [crookhollow],
    members: MEMBERS.filter(m => m.game === crookhollow.id),
    meta: opts.meta ?? CROOKHOLLOW_META,
    scope: { kind: 'game', gameId: crookhollow.id },
    rolls: opts.rolls ?? MASTER_ROLLS,
    changes: [],
  })

const masterStory = {
  globals: DESKTOP_VIEWPORT,
  loaders: [atRoute(`/games/${crookhollow.id}/party/${brann.id},${wren.id}`)],
  tags: ['no-visual'],
}

const body = (el: HTMLElement) => within(el.ownerDocument.body)
const rowsOf = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.dice-row')]
const authorOf = (row: HTMLElement) => row.querySelector('.dice-row-meta-author')?.textContent ?? ''
const offered = (el: HTMLElement) => rowsOf(el).filter(r => r.getAttribute('role') === 'button').map(authorOf)
const rowOf = (el: HTMLElement, rollId: string) => rowsOf(el).find(r => r.dataset.roll === rollId)!
const dialogOf = (el: HTMLElement, name: string) => body(el).findByRole('dialog', { name })
const hitCreates = () => spyOn(pb.collection('encounter_hits'), 'create')
const monsterUpdates = () => spyOn(pb.collection('encounter_monsters'), 'update')
const hpOf = (id: string) => useEncounterStore().monsterById(id)!.hp

/** A monster selected: only characters' damage is offered; a stat roll, a free roll and monsters' own damage are not. */
export const MasterMonsterSelected: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(GOBLIN_1), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(offered(canvasElement)).toEqual([wren.name, brann.name]))
    const row = rowOf(canvasElement, 'roll-2')
    await expect(row).toHaveAttribute('tabindex', '0')
    await expect(row.querySelector('.dice-row-go')).toHaveTextContent('→ Goblin #1')
    for (const id of ['roll-1', 'roll-3', 'roll-4', 'roll-goblin-hit']) {
      await expect(rowOf(canvasElement, id)).not.toHaveAttribute('role')
    }
  },
}

/** A character selected: only monsters' damage is offered, with no weapon line for the unnamed attack. */
export const MasterCharacterSelected: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(null), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(offered(canvasElement)).toEqual(['Goblin #2', 'Ogre #1', 'Goblin #1']))
    await expect(rowOf(canvasElement, 'roll-ogre-hit').querySelector('.dice-row-go')).toHaveTextContent(`→ ${brann.name}`)
    await expect(rowOf(canvasElement, 'roll-ogre-hit').querySelector('.dice-row-meta-secondary')).toBeNull()
    await expect(rowOf(canvasElement, 'roll-2')).not.toHaveAttribute('role')
  },
}

/** After applying, the same roll is not offered to that target again, while another target still is. */
export const AppliedRollNotOffered: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(OGRE), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-2'))
    await userEvent.click(await within(await dialogOf(canvasElement, 'Ogre #1')).findByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(store.hits).toHaveLength(1))
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).not.toHaveAttribute('role'))
    await expect(rowOf(canvasElement, 'roll-2').querySelector('.dice-row-hits')).toHaveTextContent('→ Ogre #1 −5')

    store.selectMonster(GOBLIN_1)
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
  },
}

/** The popup shows the roll, the armor and the result; Apply writes the HP and one hit. */
export const AppliesToMonster: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(OGRE), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const updates = monsterUpdates()
    const creates = hitCreates()
    const characterWrites = spyOn(pb.collection('characters'), 'update')
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-2'))
    const dialog = within(await dialogOf(canvasElement, 'Ogre #1'))
    await expect(dialog.getByText(brann.name)).toBeVisible()
    await expect(dialog.getByText('6')).toBeVisible()
    await expect(dialog.getByText('−1')).toBeVisible()
    await expect(dialog.getByRole('spinbutton', { name: 'Damage' })).toHaveValue(5)
    await expect(dialog.getByText('HP 18 → 13')).toBeVisible()

    await userEvent.click(dialog.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(hpOf(OGRE)).toBe(13))
    await waitFor(() => expect(creates).toHaveBeenCalledOnce())
    await expect(creates.mock.calls[0]![0]).toMatchObject({
      game: crookhollow.id,
      data: {
        rollId: 'roll-2', amount: 5, armor: 1, rollTotal: 6, sourceName: brann.name,
        target: { kind: 'monster', id: OGRE, name: 'Ogre #1' },
      },
    })
    await waitFor(() => expect(updates).toHaveBeenCalledOnce())
    await expect((updates.mock.calls[0]![1] as { data: EncounterMonster }).data.hp).toBe(13)
    await expect(characterWrites).not.toHaveBeenCalled()
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
  },
}

const brannWithTemp: Character = { ...brann, tempHp: 2 }

/** Temp HP absorb first; the character is written once and the log gets one change. */
export const AppliesToCharacter: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(null), withEncounter(), desktopColumn, masterTable({ characters: [brannWithTemp, ...PARTY.slice(1)] })],
  play: async ({ canvasElement }) => {
    const dealt = 8 - totalArmor(brann)
    const fromTemp = Math.min(dealt, 2)
    const hpAfter = Math.max(0, brann.currentHp - (dealt - fromTemp))
    const characterWrites = spyOn(pb.collection('characters'), 'update')
    const changeWrites = spyOn(pb.collection('change_events'), 'create')
    const creates = hitCreates()
    await waitFor(() => expect(rowOf(canvasElement, 'roll-ogre-hit')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-ogre-hit'))
    const dialog = within(await dialogOf(canvasElement, brann.name))
    await expect(dialog.getByText(`−${fromTemp} of 2`)).toBeVisible()
    await expect(dialog.getByText(`HP ${brann.currentHp} → ${hpAfter}`)).toBeVisible()

    await userEvent.click(dialog.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(creates).toHaveBeenCalledOnce())
    const now = useCharactersStore().getById(brann.id)!
    await expect(now.currentHp).toBe(hpAfter)
    await expect(now.tempHp).toBe(2 - fromTemp)
    await expect(characterWrites).toHaveBeenCalledOnce()
    await waitFor(() => expect(changeWrites).toHaveBeenCalledOnce())
    await expect((creates.mock.calls[0]![0] as { data: EncounterHit }).data).toMatchObject({ amount: dealt, armor: totalArmor(brann), sourceName: 'Ogre #1' })
  },
}

/** The result can be adjusted by hand, never below 0. */
export const AdjustedAmount: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(OGRE), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const creates = hitCreates()
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-2'))
    const dialog = within(await dialogOf(canvasElement, 'Ogre #1'))
    const lower = dialog.getByRole('button', { name: 'Lower damage' })
    for (let i = 0; i < 7; i++) await userEvent.click(lower)
    await expect(dialog.getByRole('spinbutton', { name: 'Damage' })).toHaveValue(0)
    await expect(lower).toBeDisabled()
    for (let i = 0; i < 3; i++) await userEvent.click(dialog.getByRole('button', { name: 'Raise damage' }))
    await expect(dialog.getByText('HP 18 → 15')).toBeVisible()

    await userEvent.click(dialog.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(hpOf(OGRE)).toBe(15))
    await waitFor(() => expect(creates).toHaveBeenCalledOnce())
    await expect((creates.mock.calls[0]![0] as { data: EncounterHit }).data).toMatchObject({ amount: 3, rollTotal: 6, armor: 1 })
  },
}

/** Armor eats the whole roll: a hit is written, the character is not, and the row stops being offered. */
export const ZeroDamage: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(null), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const characterWrites = spyOn(pb.collection('characters'), 'update')
    const creates = hitCreates()
    await waitFor(() => expect(rowOf(canvasElement, 'roll-goblin-nick')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-goblin-nick'))
    const dialog = within(await dialogOf(canvasElement, brann.name))
    await expect(dialog.getByRole('spinbutton', { name: 'Damage' })).toHaveValue(0)
    await userEvent.click(dialog.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(creates).toHaveBeenCalledOnce())
    await expect((creates.mock.calls[0]![0] as { data: EncounterHit }).data.amount).toBe(0)
    await waitFor(() => expect(rowOf(canvasElement, 'roll-goblin-nick')).not.toHaveAttribute('role'))
    await expect(characterWrites).not.toHaveBeenCalled()
  },
}

/** A hit that takes a monster to 0 says so beforehand; it is defeated and no longer selected. */
export const LethalHit: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(GOBLIN_1), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-2'))
    const dialog = within(await dialogOf(canvasElement, 'Goblin #1'))
    await expect(dialog.getByText(/It will be defeated\./)).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(store.monsterById(GOBLIN_1)!.diedAt).toBeDefined())
    await expect(store.monsterById(GOBLIN_1)!.hp).toBe(0)
    await expect(store.selectedMonsterId).toBeNull()
  },
}

/** The target leaves while the popup is open: it closes and nothing is written. */
export const TargetGoneClosesPopup: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(GOBLIN_2), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const creates = hitCreates()
    const updates = monsterUpdates()
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-2'))
    await dialogOf(canvasElement, 'Goblin #2')

    useEncounterStore().removeMonster(GOBLIN_2)
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
    await expect(creates).not.toHaveBeenCalled()
    await expect(updates).not.toHaveBeenCalled()
    await expect(useEncounterStore().hits).toHaveLength(0)
  },
}

/** Pressing Apply twice in a row applies once. */
export const DoubleClickAppliesOnce: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(OGRE), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const creates = hitCreates()
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-2'))
    const dialog = within(await dialogOf(canvasElement, 'Ogre #1'))
    await userEvent.dblClick(dialog.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(creates).toHaveBeenCalledOnce())
    await new Promise(r => setTimeout(r, 300))
    await expect(creates).toHaveBeenCalledOnce()
    await expect(hpOf(OGRE)).toBe(13)
  },
}

/** The character's write fails: HP rolls back and no hit is recorded. */
export const FailedDispatchWritesNoHit: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(null), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const characterWrites = spyOn(pb.collection('characters'), 'update').mockRejectedValue(new ClientResponseError({ status: 400 }))
    const creates = hitCreates()
    await waitFor(() => expect(rowOf(canvasElement, 'roll-ogre-hit')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-ogre-hit'))
    await userEvent.click(within(await dialogOf(canvasElement, brann.name)).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(characterWrites).toHaveBeenCalledOnce())
    await waitFor(() => expect(useCharactersStore().getById(brann.id)!.currentHp).toBe(brann.currentHp))
    await new Promise(r => setTimeout(r, 600))
    await expect(creates).not.toHaveBeenCalled()
    await expect(useEncounterStore().hits).toHaveLength(0)
    await expect(rowOf(canvasElement, 'roll-ogre-hit')).toHaveAttribute('role', 'button')
  },
}

/** The owner left the game, so the sheet is read-only to the master: nothing is written and no hit recorded. */
export const OwnerLeftWritesNoHit: Story = {
  ...masterStory,
  decorators: [
    asActive(wren.id), selecting(null), withEncounter(), desktopColumn,
    masterTable({ meta: { ...CROOKHOLLOW_META, [wren.id]: { owner: 'user-gone', game: crookhollow.id } } }),
  ],
  play: async ({ canvasElement }) => {
    const characterWrites = spyOn(pb.collection('characters'), 'update')
    const creates = hitCreates()
    await waitFor(() => expect(rowOf(canvasElement, 'roll-ogre-hit')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-ogre-hit'))
    await userEvent.click(within(await dialogOf(canvasElement, wren.name)).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(useToastsStore().items.map(t => t.text)).toEqual(['You can’t change this character.']))
    await expect(characterWrites).not.toHaveBeenCalled()
    await expect(creates).not.toHaveBeenCalled()
    await expect(useEncounterStore().hits).toHaveLength(0)
  },
}

/** Both writes of the hit fail: the mark stays on screen, so it cannot be applied twice, and the master is told. */
export const HitWriteFailsTwice: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(OGRE), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const creates = spyOn(pb.collection('encounter_hits'), 'create').mockRejectedValue(new ClientResponseError({ status: 500 }))
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-2'))
    await userEvent.click(within(await dialogOf(canvasElement, 'Ogre #1')).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(useToastsStore().items.map(t => t.text)).toEqual(['Couldn’t record the hit. Check your connection.']), { timeout: 4000 })
    await expect(creates).toHaveBeenCalledTimes(2)
    await expect(hpOf(OGRE)).toBe(13)
    await expect(useEncounterStore().hits).toHaveLength(1)
    await expect(rowOf(canvasElement, 'roll-2')).not.toHaveAttribute('role')
  },
}

/** The first create landed although it reported a failure: the retry is refused as a duplicate and counts as written. */
export const LandedWriteCountsAsRecorded: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(OGRE), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const collection = pb.collection('encounter_hits')
    const original = collection.create.bind(collection)
    let calls = 0
    const creates = spyOn(collection, 'create').mockImplementation(async (body) => {
      calls++
      if (calls === 1) {
        await original(body)
        throw new ClientResponseError({ status: 500 })
      }
      throw new ClientResponseError({ status: 400 })
    })
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-2'))
    await userEvent.click(within(await dialogOf(canvasElement, 'Ogre #1')).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(creates).toHaveBeenCalledTimes(2), { timeout: 4000 })
    await new Promise(r => setTimeout(r, 300))
    await expect(useToastsStore().items).toHaveLength(0)
  },
}

/** Every hit under its roll, and a Damage filter listing them newest first. */
export const DamageFilter: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(null), withEncounter(HITS), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2').querySelector('.dice-row-hits')).toHaveTextContent('→ Goblin #2 −4'))
    await userEvent.click(await canvas.findByRole('radio', { name: 'Damage' }))
    const lines = [...canvasElement.querySelectorAll('.hit-row')].map(r => r.querySelector('.hit-row-amount')?.textContent)
    await expect(lines).toEqual(['−4', '−4'])
    const first = canvasElement.querySelector('.hit-row')!
    await expect(first).toHaveTextContent(/Wren Ashfoot\s*←\s*Goblin #1/)
    await expect(first).toHaveTextContent('Roll 5 − armor 1')
  },
}

export const DamageFilterEmpty: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('radio', { name: 'Damage' }))
    await expect(await within(canvasElement).findByText('Nothing applied yet')).toBeVisible()
  },
}

/** The Damage filter is the master's: a player does not get the tab. */
export const DamageFilterMasterOnly: Story = {
  ...masterStory,
  decorators: [
    asActive(wren.id), desktopColumn,
    withStores({
      characters: [oda, wren], games: [olden], members: MEMBERS.filter(m => m.game === olden.id),
      meta: OLDEN_META, scope: { kind: 'game', gameId: olden.id }, rolls: MASTER_ROLLS, changes: [],
    }),
  ],
  loaders: [atRoute(`/games/${olden.id}/party/${wren.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByRole('radio', { name: 'Rolls' })
    await expect(canvas.queryByRole('radio', { name: 'Damage' })).toBeNull()
  },
}

/**
 * A player sees a monster's roll like any other: name, formula, dice and total, with nothing to apply and no
 * encounter request. The store holds an encounter of this very table with a selected monster, so only the
 * master check stands between it and the player's log and dice.
 */
export const PlayerSeesPlainRolls: Story = {
  ...masterStory,
  decorators: [
    asActive(wren.id), selecting(GOBLIN_1), desktopColumn,
    withEncounter(HITS, olden),
    withStores({
      characters: [oda, wren], games: [olden], members: MEMBERS.filter(m => m.game === olden.id),
      meta: OLDEN_META, scope: { kind: 'game', gameId: olden.id }, rolls: MASTER_ROLLS, changes: [],
    }),
    (story) => ({ components: { story }, setup: () => clearPbRequests(), template: '<story />' }),
  ],
  loaders: [atRoute(`/games/${olden.id}/party/${wren.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = rowOf(canvasElement, 'roll-goblin-hit')
    await expect(row).toHaveTextContent('Goblin #1')
    await expect(row).toHaveTextContent('1d6')
    await expect(row.querySelector('.dice-row-result')).toHaveTextContent('5')
    await expect(canvasElement.querySelectorAll('.dice-row[role="button"]')).toHaveLength(0)
    await expect(canvasElement.querySelector('.dice-row-hits, .dice-row-go')).toBeNull()
    await expect(canvas.queryByRole('radio', { name: 'Damage' })).toBeNull()

    // The dice are the player's own: never the monster's, never shut by it.
    await expect(canvas.queryByText(/Rolling as/)).toBeNull()
    const rollWrites = spyOn(pb.collection('roll_events'), 'create')
    await userEvent.click(canvas.getByRole('button', { name: 'd8' }))
    await waitFor(() => expect(rollWrites).toHaveBeenCalledOnce())
    const sent = rollWrites.mock.calls[0]![0] as { character: string; data: RollRecord }
    await expect(sent.character).toBe(wren.id)
    await expect(sent.data.characterName).toBe(wren.name)
    await expect(sent.data.monster).toBeUndefined()
    await expect(pbRequests().filter(r => r.includes('encounter'))).toEqual([])
  },
}

/** Back from a library with no sheet open: `activeId` survived, but no character is offered, in the log or the dice. */
export const NoSheetNoCharacter: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(null), withEncounter(), desktopColumn, masterTable()],
  loaders: [atRoute(`/games/${crookhollow.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(rowsOf(canvasElement).length).toBeGreaterThan(0))
    await expect(offered(canvasElement)).toEqual([])
    await expect(canvasElement.querySelector('.dice-row-go')).toBeNull()
    await expect(canvas.getByRole('button', { name: '2d6' })).toBeDisabled()
    await expect(canvas.getByText('Open a character sheet to roll.')).toBeVisible()
  },
}

/** At the free table a monster left selected from a game counts for nothing: the sheet's character rolls. */
export const LeftoverMonsterAtFreeTable: Story = {
  ...masterStory,
  decorators: [
    asActive(brann.id), selecting(GOBLIN_1), withEncounter(), desktopColumn,
    withStores({ characters: PARTY, rolls: ROLLS, changes: [] }),
  ],
  loaders: [atRoute(`/party/${brann.id}`)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(useEncounterStore().selectedMonsterId).toBe(GOBLIN_1)
    await expect(canvas.queryByText(/Rolling as/)).toBeNull()
    await expect(canvas.getByRole('button', { name: '2d6' })).toBeEnabled()
    const rollWrites = spyOn(pb.collection('roll_events'), 'create')
    await userEvent.click(canvas.getByRole('button', { name: '2d6' }))
    await waitFor(() => expect(rollWrites).toHaveBeenCalledOnce())
    await expect((rollWrites.mock.calls[0]![0] as { data: RollRecord }).data.characterName).toBe(brann.name)
  },
}

/**
 * The selected monster's encounter is not ready: the bar stays shut and says who it is for. A roll goes out to
 * everyone, so it must never fall through to the active character.
 */
export const MonsterNotReadyCannotRoll: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(GOBLIN_1), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const store = useEncounterStore()
    const rollWrites = spyOn(pb.collection('roll_events'), 'create')
    await expect(await canvas.findByText('Rolling as Goblin #1')).toBeVisible()
    await expect(canvas.getByRole('button', { name: '2d6' })).toBeEnabled()
    for (const status of ['loading', 'failed'] as const) {
      store.$patch({ status })
      await waitFor(() => expect(canvas.getByRole('button', { name: '2d6' })).toBeDisabled())
      await expect(canvas.getByPlaceholderText('2d6+1, d20, 4d6…')).toBeDisabled()
      await expect(canvas.getByText('Rolling as Goblin #1')).toBeVisible()
    }
    await expect(rollWrites).not.toHaveBeenCalled()
  },
}

/** A dropped connection closes and reopens the encounter: the Damage filter and the status live through it. */
export const ReopenKeepsDamageFilter: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(OGRE), withEncounter(HITS), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const store = useEncounterStore()
    const statuses: string[] = []
    const stop = watch(() => store.status, s => statuses.push(s), { flush: 'sync' })
    const damage = await within(canvasElement).findByRole('radio', { name: 'Damage' })
    await userEvent.click(damage)
    await expect(damage).toHaveAttribute('aria-checked', 'true')
    closeEncounter()
    await openEncounter(crookhollow.id)
    stop()
    await expect(statuses).toEqual([])
    await expect(store.status).toBe('ready')
    await expect(damage).toHaveAttribute('aria-checked', 'true')
    await expect(store.selectedMonsterId).toBe(OGRE)
  },
}

/** The same reopen under an open popup: it stays, on the same roll and target. */
export const ReopenKeepsPopup: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(OGRE), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-2'))
    await dialogOf(canvasElement, 'Ogre #1')
    closeEncounter()
    await openEncounter(crookhollow.id)
    await new Promise(r => setTimeout(r, 100))
    await expect(body(canvasElement).getByRole('dialog', { name: 'Ogre #1' })).toBeVisible()
  },
}

// Spelled out in code: a literal `#` followed by digits reads as a hex colour to tokens.test.ts.
const NUMBER = 148
const LONG_NAME = `${'Gargantuan '.repeat(7)}Beast`.slice(0, 80)

/** An 80-character name is cut short; the number behind it is not. */
export const LongNameKeepsNumber: Story = {
  ...masterStory,
  decorators: [
    asActive(brann.id), selecting(null), withEncounter(), desktopColumn,
    masterTable({
      rolls: [{
        ...monsterRoll({ ...monsterNamed(OGRE), name: LONG_NAME, n: NUMBER }, 'roll-long', 4, 1),
      }],
    }),
  ],
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement, 'roll-long')
    const number = row.querySelector<HTMLElement>('.numbered-name-n')!
    await expect(number).toHaveTextContent(`#${NUMBER}`)
    await expect(number).toBeVisible()
    const text = row.querySelector<HTMLElement>('.numbered-name-text')!
    await expect(text.scrollWidth).toBeGreaterThan(text.clientWidth)
    await expect(number.getBoundingClientRect().right).toBeLessThanOrEqual(row.getBoundingClientRect().right)
  },
}

/** With a monster selected, a quick roll is the monster's: a shared roll with no character, and its card moves up. */
export const FreeRollFromMonster: Story = {
  ...masterStory,
  decorators: [asActive(null), selecting(GOBLIN_1), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const rollWrites = spyOn(pb.collection('roll_events'), 'create')
    const store = useEncounterStore()
    const before = store.monsterById(GOBLIN_1)!.touchedAt
    await expect(await canvas.findByText('Rolling as Goblin #1')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Advantage' }))
    await userEvent.click(canvas.getByRole('button', { name: 'd8' }))
    await waitFor(() => expect(rollWrites).toHaveBeenCalledOnce())
    const body = rollWrites.mock.calls[0]![0] as { character: string; game: string; data: RollRecord }
    await expect(body).toMatchObject({ character: '', game: crookhollow.id })
    await expect(body.data).toMatchObject({ notation: '1d8', characterName: 'Goblin #1', monster: { id: GOBLIN_1, n: 1 }, rollMode: 'advantage' })
    await waitFor(() => expect(store.monsterById(GOBLIN_1)!.touchedAt).toBeGreaterThan(before))
  },
}

/** Keyboard: Enter on a row opens the popup, Escape closes it and focus is back on that row. */
export const KeyboardOpensAndEscapeReturnsFocus: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(OGRE), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    const row = rowOf(canvasElement, 'roll-2')
    row.focus()
    await userEvent.keyboard('{Enter}')
    await dialogOf(canvasElement, 'Ogre #1')
    await expect(row).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(row))
  },
}

/** After Apply the row is no longer a button; focus lands on the log instead of dropping to the page. */
export const ApplyReturnsFocusToLog: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(OGRE), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    const row = rowOf(canvasElement, 'roll-2')
    row.focus()
    await userEvent.keyboard('{Enter}')
    const apply = within(await dialogOf(canvasElement, 'Ogre #1')).getByRole('button', { name: 'Apply' })
    apply.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(hpOf(OGRE)).toBe(13))
    await waitFor(() => expect(row).not.toHaveAttribute('role'))
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(canvasElement.querySelector('.drawer-log')))
  },
}

/** Clicking another control while the popup is open closes it and leaves the focus where the user put it. */
export const OutsidePressKeepsFocus: Story = {
  ...masterStory,
  decorators: [asActive(brann.id), selecting(OGRE), withEncounter(), desktopColumn, masterTable()],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(rowOf(canvasElement, 'roll-2')).toHaveAttribute('role', 'button'))
    await userEvent.click(rowOf(canvasElement, 'roll-2'))
    await dialogOf(canvasElement, 'Ogre #1')
    const input = within(canvasElement).getByPlaceholderText('2d6+1, d20, 4d6…')
    await userEvent.click(input)
    await waitFor(() => expect(body(canvasElement).queryByRole('dialog')).toBeNull())
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    await expect(canvasElement.ownerDocument.activeElement).toBe(input)
  },
}
