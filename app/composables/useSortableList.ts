import Sortable from 'sortablejs'
import { onBeforeUnmount, watchEffect, type Ref } from 'vue'

export interface SortableListOptions {
  enabled: Readonly<Ref<boolean>>
  /** CSS selector of the drag handle inside each item. */
  handle: string
  /** Items carry their id in `data-id`; `beforeId` is the item the dragged one now sits before, null for the end. */
  onMove: (id: string, beforeId: string | null) => void
}

/**
 * Drag and drop for a list that Vue renders. SortableJS moves the DOM nodes itself, so on drop the node is put
 * back where it was and the new order goes out through `onMove`; Vue then renders it.
 */
export function useSortableList(el: Readonly<Ref<HTMLElement | null>>, opts: SortableListOptions) {
  let sortable: Sortable | null = null

  function destroy() {
    sortable?.destroy()
    sortable = null
  }

  watchEffect(() => {
    destroy()
    const root = el.value
    if (!root || !opts.enabled.value) return
    sortable = Sortable.create(root, {
      handle: opts.handle,
      draggable: '[data-id]',
      animation: 0,
      // The pointer-driven fallback behaves the same for mouse and touch and leaves no native drag image.
      forceFallback: true,
      fallbackOnBody: true,
      ghostClass: 'is-drag-ghost',
      chosenClass: 'is-drag-chosen',
      onEnd(evt) {
        const item = evt.item
        const id = item.dataset.id
        const beforeId = (item.nextElementSibling as HTMLElement | null)?.dataset.id ?? null
        const origin = evt.oldIndex
        if (origin === undefined) return
        item.remove()
        evt.from.insertBefore(item, evt.from.children[origin] ?? null)
        if (id && evt.newIndex !== evt.oldIndex) opts.onMove(id, beforeId)
      },
    })
  })

  onBeforeUnmount(destroy)
}
