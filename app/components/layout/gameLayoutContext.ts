import { inject, type InjectionKey, type Ref } from 'vue'

export type Side = 'left' | 'right'

export interface GameLayoutContext {
  leftCollapsed: Ref<boolean>
  rightCollapsed: Ref<boolean>
  toggleCollapsed: (side: Side) => void
}

export const GameLayoutContextKey: InjectionKey<GameLayoutContext> = Symbol('GameLayoutContext')

export function useGameLayout(): GameLayoutContext | null {
  return inject(GameLayoutContextKey, null)
}
