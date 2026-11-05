import { shallowRef, watch, type Ref } from 'vue'

/**
 * `target`, except that while a card is held (`holdingId` set) the relative order of the ids already shown
 * stays frozen, so a click never lands on a card that moved under the pointer. Ids new to the list go on
 * top; ids that left it drop out. The hold ends the moment `holdingId` is null again.
 */
export function useDeferredOrder(target: Ref<string[]>, holdingId: Ref<string | null>): Readonly<Ref<string[]>> {
  const shown = shallowRef<string[]>([...target.value])
  watch(
    [target, holdingId],
    () => {
      if (holdingId.value === null) {
        shown.value = [...target.value]
        return
      }
      const now = new Set(target.value)
      const kept = shown.value.filter(id => now.has(id))
      const known = new Set(kept)
      shown.value = [...target.value.filter(id => !known.has(id)), ...kept]
    },
    { flush: 'sync' },
  )
  return shown
}
