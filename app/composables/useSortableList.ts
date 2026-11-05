import Sortable from 'sortablejs'
import { onBeforeUnmount, watchEffect, type Ref } from 'vue'

export interface SortableListOptions {
  enabled: Readonly<Ref<boolean>>
  /** CSS selector of the drag handle inside each item. */
  handle: string
  /** Items carry their id in `data-id`; `beforeId` is the item the dragged one now sits before, null for the end. */
  onMove: (id: string, beforeId: string | null) => void
  /** A drag began on the item with this id. */
  onStart?: (id: string) => void
  /** The drag is over, dropped or cut short (the list went away mid-drag); always after `onMove`, if any. */
  onEnd?: () => void
}

const CLASSES = ['is-drag-ghost', 'is-drag-chosen']

/**
 * Drag and drop for a list that Vue renders. SortableJS moves the DOM nodes itself, so on drop the node is put
 * back where it was and the new order goes out through `onMove`; Vue then renders it.
 */
export function useSortableList(el: Readonly<Ref<HTMLElement | null>>, opts: SortableListOptions) {
  let sortable: Sortable | null = null
  let drag: { item: HTMLElement; from: HTMLElement; next: Element | null; index: number } | null = null

  function putBack(d: NonNullable<typeof drag>) {
    d.item.classList.remove(...CLASSES)
    // Only a node that Vue still owns goes back; one that was removed meanwhile must not come back as a zombie.
    if (!d.from.contains(d.item)) return
    d.item.remove()
    const anchor = d.next && d.from.contains(d.next) ? d.next : (d.from.children[d.index] ?? null)
    d.from.insertBefore(d.item, anchor)
  }

  function destroy() {
    const cut = drag
    const ghost = Sortable.ghost
    drag = null
    sortable?.destroy()
    sortable = null
    if (!cut) return
    // destroy() ends the drag without an event: the ghost stays in <body> and the node stays moved.
    ghost?.remove()
    putBack(cut)
    opts.onEnd?.()
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
      onStart(evt) {
        const item = evt.item
        drag = { item, from: evt.from, next: item.nextElementSibling, index: evt.oldIndex ?? 0 }
        if (item.dataset.id) opts.onStart?.(item.dataset.id)
      },
      onEnd(evt) {
        const d = drag
        drag = null
        const item = evt.item
        const id = item.dataset.id
        const beforeId = (item.nextElementSibling as HTMLElement | null)?.dataset.id ?? null
        const moved = evt.newIndex !== evt.oldIndex && item.isConnected
        if (d) putBack(d)
        if (id && moved) opts.onMove(id, beforeId)
        opts.onEnd?.()
      },
    })
  })

  onBeforeUnmount(destroy)
}
