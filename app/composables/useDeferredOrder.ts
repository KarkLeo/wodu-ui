import { shallowRef, watch, type Ref } from 'vue'

/**
 * `target` as lists of ids (sections), except that while a card is held (`holdingId` set) every id keeps its
 * slot: the same section and the same place in it, whatever its data now says. So a card that dies under the
 * pointer stays where it is, and the next one never slides under the pointer. Ids new to the list wait and
 * appear at the release; ids that are gone drop out at once, since a gone row cannot be kept.
 */
export function useDeferredOrder(target: Ref<string[][]>, holdingId: Ref<string | null>): Readonly<Ref<string[][]>> {
  const copy = (sections: string[][]) => sections.map(s => [...s])
  const shown = shallowRef<string[][]>(copy(target.value))
  watch(
    [target, holdingId],
    () => {
      if (holdingId.value === null) {
        shown.value = copy(target.value)
        return
      }
      const now = new Set(target.value.flat())
      shown.value = shown.value.map(section => section.filter(id => now.has(id)))
    },
    { flush: 'sync' },
  )
  return shown
}
