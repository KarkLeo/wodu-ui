import { provide, ref } from 'vue'
import type { Decorator, Loader } from '@storybook/vue3-vite'
import { GameLayoutContextKey, type Side } from '@/components/layout/gameLayoutContext'
import type { Character } from '@/types/character'
import type { ChangeEntry } from '@/types/changeLog'
import type { RollRecord } from '@/types/dice'
import { useCharactersStore } from '@/stores/characters'
import { useRollHistoryStore } from '@/stores/rollHistory'
import { useChangeLogStore } from '@/stores/changeLog'
import { useCreationStore } from '@/stores/creation'
import { storyRouter } from './router'

interface StoreSeed {
  characters?: Character[]
  rolls?: RollRecord[]
  changes?: ChangeEntry[]
  creation?: { draftId: string; step: 1 | 2 | 3 }
}

/** Fills the stores before the story mounts, the same way bootstrap() would after loading from PocketBase. */
export function withStores(seed: StoreSeed): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      useCharactersStore().setAll(structuredClone(seed.characters ?? []))
      useRollHistoryStore().setAll(structuredClone(seed.rolls ?? []))
      useChangeLogStore().setAll(structuredClone(seed.changes ?? []))
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
export const DESKTOP_VIEWPORT = { viewport: { value: '1280-800', isRotated: false } }

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

/** Navigates the story router before render, so views reading useRoute() see their params on mount. */
export function atRoute(path: string): Loader {
  return async () => {
    await storyRouter.push(path)
    return {}
  }
}
