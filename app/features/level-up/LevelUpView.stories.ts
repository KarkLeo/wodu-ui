import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import LevelUpView from './LevelUpView.vue'
import GameLayout from '@/components/layout/GameLayout.vue'
import PlayersPanel from '@/components/layout/PlayersPanel.vue'
import { build, crookhollow, equip, inGame, oda, wren, CROOKHOLLOW_META } from '@/stories/fixtures'
import { atRoute, DESKTOP_VIEWPORT, withGameTable, withStores } from '@/stories/state'
import { storyRouter } from '@/stories/router'
import { XP_THRESHOLDS } from '@/data/xpTable'
import { useCharactersStore } from '@/stores/characters'

/** Fighter, level 2, enough XP for level 3: the skill → ability → summary path rolls no dice. */
export const tamsin = build('story-tamsin', [
  { type: 'SET_NAME', name: 'Tamsin Reed' },
  {
    type: 'SET_STAT_ROLLS_BATCH',
    rolls: [
      { key: 'str', roll: 10, bonus: 2 },
      { key: 'dex', roll: 9, bonus: 1 },
      { key: 'con', roll: 8, bonus: 1 },
      { key: 'int', roll: 6, bonus: 0 },
      { key: 'wis', roll: 7, bonus: 1 },
      { key: 'cha', roll: 5, bonus: 0 },
    ],
  },
  { type: 'TOGGLE_SKILL', id: 'survival' },
  { type: 'TOGGLE_ABILITY', id: 'hewing' },
  { type: 'SET_HIT_DICE_RESULT', hitDice: 1, maxHp: 6, currentHp: 6, hpHistory: [{ level: 1, roll: 6, source: 'dice' }] },
  { type: 'BUY_ITEM', templateId: 'battle_weapon' },
  equip('battle_weapon'),
  { type: 'FINALIZE_CHARACTER' },
  { type: 'GAIN_XP', amount: XP_THRESHOLDS[3] + 80 },
  (c) => ({
    type: 'LEVEL_UP',
    patch: {
      level: 2,
      maxHp: 9,
      currentHp: 9,
      hitDice: 2,
      hpHistory: [...(c.hpHistory ?? []), { level: 2, roll: 3, source: 'dice' }],
      skillIds: c.skillIds,
      abilityIds: c.abilityIds,
      stats: c.stats,
      damageBonusDice: c.damageBonusDice,
      magic: c.magic,
    },
  }),
])

const meta = {
  title: 'Screens/LevelUp',
  excludeStories: ['tamsin'],
  component: LevelUpView,
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { layout: 'fullscreen' },
  decorators: [withStores({ characters: [oda, wren, tamsin] })],
} satisfies Meta<typeof LevelUpView>

export default meta
type Story = StoryObj<typeof meta>

// On phones the view teleports itself to <body>, outside the story canvas.
const screen = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

async function pick(canvasElement: HTMLElement, option: RegExp) {
  const view = screen(canvasElement)
  await userEvent.click(await view.findByRole('button', { name: option }))
}

async function next(canvasElement: HTMLElement) {
  const view = screen(canvasElement)
  const button = await view.findByRole('button', { name: /Next/ })
  await expect(button).toBeEnabled()
  await userEvent.click(button)
}

/** Level 1 → 2 grants only a hit die, so the first step is the (not yet rolled) HP roll. */
export const HitDice: Story = {
  loaders: [atRoute(`/character/${oda.id}/levelup`)],
}

/** Level 3 → 4: stat boost first, then hit dice. DEX is already at the cap. */
export const StatBoost: Story = {
  loaders: [atRoute(`/character/${wren.id}/levelup`)],
}

export const StatBoostSelected: Story = {
  loaders: [atRoute(`/character/${wren.id}/levelup`)],
  play: async ({ canvasElement }) => {
    await pick(canvasElement, /^STR/)
    await expect(await screen(canvasElement).findByRole('button', { name: /Next/ })).toBeEnabled()
  },
}

/** Level 2 → 3: skill, then ability, then summary. */
export const Skill: Story = {
  loaders: [atRoute(`/character/${tamsin.id}/levelup`)],
}

export const Ability: Story = {
  loaders: [atRoute(`/character/${tamsin.id}/levelup`)],
  play: async ({ canvasElement }) => {
    await pick(canvasElement, /^Lore/)
    await next(canvasElement)
    await expect(await screen(canvasElement).findByRole('button', { name: /^Hardy/ })).toBeInTheDocument()
  },
}

/** Another device levels Tamsin up to 5 mid-wizard: the wizard restarts for level 6 with nothing pre-filled. */
export const LevelChangedElsewhere: Story = {
  loaders: [atRoute(`/character/${tamsin.id}/levelup`)],
  play: async ({ canvasElement }) => {
    await pick(canvasElement, /^Lore/)
    await next(canvasElement)
    const store = useCharactersStore()
    store.upsertLocal({ ...store.getById(tamsin.id)!, level: 5 })
    const view = screen(canvasElement)
    await expect(await view.findByRole('button', { name: /^Lore/ })).toBeInTheDocument()
    await expect(await view.findByRole('button', { name: /Next/ })).toBeDisabled()
  },
}

export const Summary: Story = {
  loaders: [atRoute(`/character/${tamsin.id}/levelup`)],
  play: async ({ canvasElement }) => {
    await pick(canvasElement, /^Lore/)
    await next(canvasElement)
    await pick(canvasElement, /^Hardy/)
    await next(canvasElement)
    await expect(await screen(canvasElement).findByRole('button', { name: /Confirm/ })).toBeEnabled()
  },
}

// ── In a game ───────────────────────────────────────────────────────────────

const inCrookhollow = withGameTable(crookhollow, [oda, wren, tamsin], { ...CROOKHOLLOW_META, [tamsin.id]: inGame(crookhollow) })

const atTheTable = {
  render: () => ({
    components: { GameLayout, LevelUpView, PlayersPanel },
    template: `
      <GameLayout>
        <LevelUpView />
        <template #left><PlayersPanel /></template>
      </GameLayout>
    `,
  }),
}

/** A game character levels up at its game's table: the game's panel, and closing returns to its party route. */
export const InGame: Story = {
  ...atTheTable,
  tags: ['no-visual'],
  globals: DESKTOP_VIEWPORT,
  decorators: [inCrookhollow],
  loaders: [atRoute(`/character/${tamsin.id}/levelup`)],
  play: async ({ canvasElement }) => {
    const view = within(canvasElement)
    await expect(await view.findByText(crookhollow.name, { selector: '.pr-game-title' })).toBeVisible()
    await expect(view.getByRole('button', { name: new RegExp(wren.name) })).toHaveTextContent(/Kostya ·/)
    await expect(view.queryByRole('button', { name: new RegExp(oda.name) })).toBeNull()
    await userEvent.click(await screen(canvasElement).findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/games/${crookhollow.id}/party/${tamsin.id}`))
  },
}

/** On a phone the top bar is titled with the game's name. */
export const InGamePhone: Story = {
  ...atTheTable,
  decorators: [inCrookhollow],
  loaders: [atRoute(`/character/${tamsin.id}/levelup`)],
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('.gl-mob-center-title .t')).toHaveTextContent(crookhollow.name))
  },
}

/** A free character's level-up closes back to the party route. */
export const FreeCharacterClose: Story = {
  tags: ['no-visual'],
  loaders: [atRoute(`/character/${tamsin.id}/levelup`)],
  play: async ({ canvasElement }) => {
    await userEvent.click(await screen(canvasElement).findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(storyRouter.currentRoute.value.path).toBe(`/party/${tamsin.id}`))
  },
}
