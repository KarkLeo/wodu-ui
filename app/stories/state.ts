import { onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { action } from 'storybook/actions'
import type { Decorator, Loader } from '@storybook/vue3-vite'
import { GameLayoutContextKey, type Side } from '@/components/layout/gameLayoutContext'
import type { Character } from '@/types/character'
import type { ChangeEntry } from '@/types/changeLog'
import type { RollRecord } from '@/types/dice'
import type { CharacterMeta, Game, GameMember, Scope } from '@/types/game'
import { useCharactersStore } from '@/stores/characters'
import { useGamesStore } from '@/stores/games'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'
import { useCreationStore } from '@/stores/creation'
import { bootstrapStatus } from '@/transport/bootstrap'
import { setScope } from '@/transport/scope'
import { authStore, seedRecords, signInMock } from '../../.storybook/mocks/pb'
import { storyRouter } from './router'

interface StoreSeed {
  characters?: Character[]
  rolls?: RollRecord[]
  changes?: ChangeEntry[]
  creation?: { draftId: string; step: 1 | 2 | 3 }
  games?: Game[]
  members?: GameMember[]
  /** Owner and game per character id; a character not listed is a free character of the signed-in user. */
  meta?: Record<string, CharacterMeta>
  scope?: Scope
}

/**
 * Fills the stores before the story mounts, the same way bootstrap() would after loading from PocketBase.
 * Signs the mock in unless the story already has, so the seeded characters are the player's own and editable.
 */
export function withStores(seed: StoreSeed): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      if (!authStore.isValid) signInMock()
      const me = String(authStore.record?.id ?? '')
      const characters = structuredClone(seed.characters ?? [])
      useCharactersStore().setAll(characters, characters.map(c => ({
        id: c.id,
        updated: '',
        ...(seed.meta?.[c.id] ?? { owner: me, game: '' }),
      })))
      const games = structuredClone(seed.games ?? [])
      useGamesStore().setAll(games, structuredClone(seed.members ?? []))
      seedRecords('games', games.map(g => ({ id: g.id, name: g.name, master: g.master, invite_code: g.inviteCode })))
      setScope(seed.scope ?? { kind: 'home' })
      useRollHistoryStore().setAll(structuredClone(seed.rolls ?? []))
      useChangeLogStore().setAll(structuredClone(seed.changes ?? []))
      bootstrapStatus.value = 'ready'
      if (seed.creation) {
        const creation = useCreationStore()
        creation.setDraft(seed.creation.draftId)
        creation.setStep(seed.creation.step)
      }
    },
    template: '<story />',
  })
}

/** Desktop size at which GameLayout switches to three columns (its breakpoint is 961px). */
export const DESKTOP_VIEWPORT = { viewport: { value: 'desktop', isRotated: false } }

export function asActive(id: string | null): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      useCharactersStore().setActive(id)
    },
    template: '<story />',
  })
}

/** Stands in for GameLayout's provide(), so side panels render their collapse button and rail. */
export function inLayout(collapsed: Partial<Record<Side, boolean>> = {}): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      const leftCollapsed = ref(collapsed.left ?? false)
      const rightCollapsed = ref(collapsed.right ?? false)
      provide(GameLayoutContextKey, {
        leftCollapsed,
        rightCollapsed,
        toggleCollapsed: (side: Side) => {
          const target = side === 'left' ? leftCollapsed : rightCollapsed
          target.value = !target.value
        },
      })
    },
    template: '<story />',
  })
}

const logNavigation = action('navigate')

/**
 * Stories render a view directly, not through <RouterView>, so a router.push() inside the view
 * changes the route but leaves the view mounted. Make a switch to another route visible instead of
 * letting the stale view keep reacting (e.g. level-up re-targeting the next level after Confirm).
 * Param-only changes (/party/a,b → /party/a) keep the same view in the app too, so they only log.
 * Opt out with `parameters: { navigationNotice: false }`.
 */
export const withNavigationNotice: Decorator = (story, context) => ({
  components: { story },
  setup() {
    const route = useRoute()
    const startName = ref<string | null>(null)
    const leftTo = ref<string | null>(null)
    onMounted(() => {
      startName.value = String(route.name ?? '')
    })
    watch(() => route.fullPath, (path) => {
      if (startName.value === null) return
      logNavigation(path)
      if (context.parameters.navigationNotice !== false && String(route.name ?? '') !== startName.value) {
        leftTo.value = path
      }
    })
    return { leftTo }
  },
  template: `
    <story />
    <Teleport to="body">
      <div v-if="leftTo" role="status" style="position: fixed; inset: 0; z-index: 10000; display: grid;
        place-items: center; padding: 24px; background: rgba(7, 5, 10, 0.82); backdrop-filter: blur(4px)">
        <div style="max-width: 340px; padding: 16px 18px; border: 1px solid var(--vtt-border-gold);
          border-radius: var(--r-md); background: var(--vtt-bg-elevated); color: var(--vtt-text-primary);
          font-family: var(--font-sans); font-size: 14px; line-height: 1.5; text-align: center">
          The app would leave this screen here and open
          <code style="font-family: var(--font-mono); color: var(--vtt-accent)">{{ leftTo }}</code>.
        </div>
      </div>
    </Teleport>
  `,
})

/** Navigates the story router before render, so views reading useRoute() see their params on mount. */
export function atRoute(path: string): Loader {
  return async () => {
    await storyRouter.push(path)
    return {}
  }
}
