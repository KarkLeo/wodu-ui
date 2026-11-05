import { inject, type InjectionKey, type Ref } from 'vue'

export type Side = 'left' | 'right'

export interface GameLayoutContext {
  leftCollapsed: Ref<boolean>
  rightCollapsed: Ref<boolean>
  toggleCollapsed: (side: Side) => void
  /** Closes the phone's side drawers: an action that changes the page without a route change calls it. */
  closeMobileOverlays: () => void
}

export const GameLayoutContextKey: InjectionKey<GameLayoutContext> = Symbol('GameLayoutContext')

export function useGameLayout(): GameLayoutContext | null {
  return inject(GameLayoutContextKey, null)
}
