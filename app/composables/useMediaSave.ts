import { computed, ref, type Ref } from 'vue'
import { MEDIA_LIMITS } from '@/domain/stage'
import { MediaWriteError } from '@/transport/media'
import type { MediaEntries, MediaKind } from '@/types/stage'
import { createLogger } from '@/utils/logger'
import { t, type MessageKey } from '@/locales'

const log = createLogger('media-save')

type Failure = 'limitReached' | 'limitMayHaveChanged' | 'notMaster' | 'publishFailed' | 'saveFailed'

export interface SaveContext {
  /** One id for every try of one form, so a try after a lost answer cannot add the entry twice. */
  id: string
  onProgress: (fraction: number) => void
  /** Whether the form was closed or reopened since this try began. */
  stale: () => boolean
}

/**
 * The save of one media sheet: the upload under way (it is not abandoned by closing the sheet over it), its
 * progress, and a failure worded by the transport's kind. Each sheet keeps its own fields and what it does with
 * a refused file; the messages are `stage.<kind>.form.*`.
 */
export interface MediaSaveOptions {
  /** The messages of a kind whose entries can be on the table; a kind without them never reaches the table's republish. */
  publish?: { failed: MessageKey; stillFailed: MessageKey }
  /** Runs whenever a save fails or is refused, before it is worded: put the form's busy marks back. */
  onFailure?: () => void
}

export function useMediaSave<K extends MediaKind>(kind: K, open: Ref<boolean>, options: MediaSaveOptions = {}) {
  type Entry = MediaEntries[K]
  const saving = ref(false)
  const progress = ref(0)
  const failure = ref<Failure | null>(null)
  // Set once the entry is saved but the table did not get it: the form is over, only the table's update is left.
  const saved = ref<Entry | null>(null)
  const republishFailed = ref(false)
  const republishing = ref(false)
  let draftId = crypto.randomUUID()
  let attempt = 0

  /** Call whenever the sheet opens. */
  function reset() {
    attempt++
    draftId = crypto.randomUUID()
    saving.value = false
    progress.value = 0
    failure.value = null
    saved.value = null
    republishFailed.value = false
    republishing.value = false
  }

  const sheetOpen = computed({
    get: () => open.value,
    set: (v: boolean) => {
      if (!v && saving.value) return
      open.value = v
    },
  })

  /**
   * Runs the save. `refused` may word a failure in the form's own fields and return true; the sheet closes when
   * the task ends and nothing newer began.
   */
  async function run(task: (ctx: SaveContext) => Promise<void>, refused?: (err: unknown) => boolean) {
    const mine = attempt
    const stale = () => mine !== attempt
    failure.value = null
    saving.value = true
    progress.value = 0
    try {
      await task({ id: draftId, onProgress: (fraction) => { if (!stale()) progress.value = fraction }, stale })
      if (stale()) return
      saving.value = false
      open.value = false
    } catch (err) {
      if (stale()) return
      saving.value = false
      options.onFailure?.()
      if (refused?.(err)) return
      if (err instanceof MediaWriteError) {
        // The session ended under the upload: there is nobody to tell.
        if (err.kind === 'aborted') return
        if (err.kind === 'stagePublishFailed' && err.saved && options.publish) {
          saved.value = err.saved
          failure.value = 'publishFailed'
          return
        }
        if (err.kind === 'limitReached' || err.kind === 'limitMayHaveChanged' || err.kind === 'notMaster') {
          failure.value = err.kind
          return
        }
      }
      log.error('save failed', { err })
      failure.value = 'saveFailed'
    }
  }

  /** Gives the table the entry that was saved without it; the sheet closes when that works. */
  async function retryPublish(republish: (entry: Entry) => Promise<void>) {
    const entry = saved.value
    if (!entry || republishing.value) return
    const mine = attempt
    republishing.value = true
    try {
      await republish(entry)
      if (mine === attempt) open.value = false
    } catch (err) {
      log.error('republish failed', { err })
      if (mine === attempt) republishFailed.value = true
    } finally {
      if (mine === attempt) republishing.value = false
    }
  }

  const failureText = computed(() => {
    const prefix = `stage.${kind}.form` as const
    switch (failure.value) {
      case 'limitReached':
      case 'limitMayHaveChanged':
        return t(`${prefix}.${failure.value}`, { max: MEDIA_LIMITS[kind] })
      case 'publishFailed':
        return options.publish ? t(republishFailed.value ? options.publish.stillFailed : options.publish.failed) : ''
      case 'notMaster':
      case 'saveFailed':
        return t(`${prefix}.${failure.value}`)
      default:
        return ''
    }
  })

  return { saving, progress, failure, failureText, saved, republishing, sheetOpen, reset, run, retryPublish }
}
