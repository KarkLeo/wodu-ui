import { shallowRef, watch, type Ref } from 'vue'

/**
 * `target` as lists of ids (sections), except that while `held` every id keeps its slot: the same section and
 * the same place in it, whatever its data now says. So a card that dies under the pointer stays where it is,
 * and the next one never slides under the pointer. Ids new to the list wait and appear at the release; ids that
 * are gone drop out at once, since a gone row cannot be kept. With nothing on screen there is nothing to keep.
 *
 * `showTarget` puts the target on screen during a hold, for a change the user made to the order itself.
 */
export function useDeferredOrder(target: Ref<string[][]>, held: Ref<boolean>) {
  const copy = (sections: string[][]) => sections.map(s => [...s])
  const shown = shallowRef<string[][]>(copy(target.value))
  const showTarget = () => { shown.value = copy(target.value) }
  watch(
    [target, held],
    () => {
      if (!held.value || shown.value.every(section => section.length === 0)) {
        showTarget()
        return
      }
      const now = new Set(target.value.flat())
      shown.value = shown.value.map(section => section.filter(id => now.has(id)))
    },
    { flush: 'sync' },
  )
  return { shown: shown as Readonly<Ref<string[][]>>, showTarget }
}
