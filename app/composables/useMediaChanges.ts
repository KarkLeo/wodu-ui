import { reactive } from 'vue'
import { useToastsStore } from '@/stores/toasts'
import { createLogger } from '@/utils/logger'

const log = createLogger('media-changes')

/**
 * The changes (turn on or off, delete) of a media panel's entries, one at a time per entry: while an entry's own
 * change is on its way it waits (`busy`), the others do not.
 */
export function useMediaChanges() {
  const toasts = useToastsStore()
  const busy = reactive(new Set<string>())

  /** `failed` turns an error into the toast to show, or null for one that needs none. */
  async function change(id: string, run: () => Promise<void>, failed: (err: unknown) => string | null): Promise<boolean> {
    if (busy.has(id)) return true
    busy.add(id)
    try {
      await run()
      return true
    } catch (err) {
      log.error('media change failed', { id, err })
      const text = failed(err)
      if (text) toasts.push(text, 'error')
      return false
    } finally {
      busy.delete(id)
    }
  }

  return { busy, change }
}
