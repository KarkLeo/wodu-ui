import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

export const SHEET_READONLY: InjectionKey<Ref<boolean>> = Symbol('sheet-readonly')

/** Marks the sheet below as read-only (a character the user cannot edit); its panels hide edit controls and dice. */
export function provideSheetReadonly(readonly: Ref<boolean>): void {
  provide(SHEET_READONLY, readonly)
}

export function useSheetReadonly(): Ref<boolean> {
  return inject(SHEET_READONLY, () => ref(false), true)
}
