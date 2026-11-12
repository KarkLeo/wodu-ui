import { computed, nextTick, ref, type Ref, type WritableComputedRef } from 'vue'
import { MediaWriteError } from '@/transport/media'
import { t, type MessageKey } from '@/locales'

interface Options<E extends { id: string }> {
  gameId: () => string | null
  /** The entries as the store holds them now. */
  list: () => E[]
  busy: Set<string>
  change: (id: string, run: () => Promise<void>, failed: (err: unknown) => string | null) => Promise<boolean>
  remove: (gameId: string, id: string) => Promise<void>
  /** Whether the entry is on the table, for the confirm's wording; the transport decides by the stage itself. */
  isLive: (entry: E) => boolean
  /** The entry's name for the confirm's title, when it has one. */
  nameOf?: (entry: E) => string
  notMasterKey: MessageKey
  failedKey: MessageKey
  focusEntry: (id: string) => void
  focusAdd: () => void
}

export interface MediaDelete<E> {
  deleting: Ref<E | null>
  open: WritableComputedRef<boolean>
  /** Kept while the confirm fades out, or its title loses the name. */
  name: Ref<string>
  live: Ref<boolean>
  ask: (entry: E) => void
  confirm: () => Promise<void>
}

/** Delete behind a confirm, one result for each way it ends, and the focus put back where the button was. */
export function useMediaDelete<E extends { id: string }>(o: Options<E>): MediaDelete<E> {
  const deleting = ref<E | null>(null) as Ref<E | null>
  const open = computed({
    get: () => deleting.value !== null,
    set: (v: boolean) => { if (!v) deleting.value = null },
  })
  const name = ref('')
  const live = ref(false)

  function ask(entry: E) {
    name.value = o.nameOf?.(entry) ?? ''
    live.value = o.isLive(entry)
    deleting.value = entry
  }

  async function confirm() {
    const entry = deleting.value
    const game = o.gameId()
    if (!entry || !game || o.busy.has(entry.id)) return
    deleting.value = null
    const done = await o.change(entry.id, () => o.remove(game, entry.id), (err) => {
      if (err instanceof MediaWriteError) {
        // The session ended under the write: nobody is left to tell.
        if (err.kind === 'aborted') return null
        if (err.kind === 'notMaster') return t(o.notMasterKey)
        // The entry was on the table and taking it off failed: the stage writer has said so, and it was not deleted.
        if (err.kind === 'stagePublishFailed') return null
      }
      return t(o.failedKey)
    })
    await nextTick()
    if (!done) {
      o.focusEntry(entry.id)
      return
    }
    // The entry went, and with it the button the focus came from.
    if (!o.list().some(e => e.id === entry.id)) o.focusAdd()
  }

  return { deleting, open, name, live, ask, confirm }
}
