import { call, staysCurrent } from './onlineOps'
import { modeSession } from './mode'
import { reportWriteFailure } from './writeFailure'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:writer')

/** A write that was never sent, or whose outcome is moot, because the mode or the user changed meanwhile: not a server failure, and the server may even have accepted it. */
export class WriteDropped extends Error {
  constructor() {
    super('write dropped: the session ended')
    this.name = 'WriteDropped'
  }
}

export interface Writer<T> {
  /** Shows `next` at once and sends it; `prior` is what the screen held, the rollback target if nothing is confirmed yet. */
  submit(key: string, prior: T | undefined, next: T): void
  /** Drops what has not been sent yet for `key`. */
  forget(key: string): void
  /** True while a write for `key` is in flight or waiting. */
  busy(key: string): boolean
}

interface Chain<T> {
  confirmed: T | undefined
  pending: T | undefined
  hasPending: boolean
}

/**
 * One request in flight per key; the newest value waiting replaces any older one, so three fast clicks
 * make at most two writes and the last value always lands. A failure restores the last confirmed value
 * unless a newer change is waiting, which is about to overwrite it anyway.
 *
 * `settled` is told when a key's writes are over: `null` once the newest value is confirmed, the error
 * when the newest failed (after the rollback), or a `WriteDropped` when what waited was left unsent, or
 * a failure no longer matters, because of a mode switch or a sign-out. Cleanup and `settled` always run.
 */
export function serialWriter<T>(opts: {
  show: (value: T) => void
  restore: (key: string, value: T) => void
  send: (key: string, value: T) => Promise<unknown>
  message: () => string
  settled?: (key: string, error: unknown | null) => void
}): Writer<T> {
  const chains = new Map<string, Chain<T>>()

  async function pump(key: string, chain: Chain<T>) {
    const current = staysCurrent()
    const session = modeSession()
    let outcome: unknown | null = null
    try {
      // A mode switch or sign-out leaves what waits unsent: no request reaches PocketBase offline.
      while (chain.hasPending && current()) {
        const value = chain.pending as T
        chain.pending = undefined
        chain.hasPending = false
        try {
          await call(() => opts.send(key, value))
          chain.confirmed = value
          outcome = null
        } catch (err) {
          log.error('write failed', { key, err })
          outcome = err
          if (!current()) break
          if (chain.hasPending) continue
          if (chain.confirmed !== undefined) opts.restore(key, chain.confirmed)
          reportWriteFailure(err, opts.message(), session)
        }
      }
    } catch (err) {
      log.error('write cleanup failed', { key, err })
      outcome ??= err
    } finally {
      const leftover = chain.hasPending
      chain.hasPending = false
      chain.pending = undefined
      if (chains.get(key) === chain) chains.delete(key)
      let result: unknown | null = outcome
      if (outcome !== null) {
        if (!current()) result = new WriteDropped()
      } else if (leftover) {
        result = new WriteDropped()
      }
      try {
        opts.settled?.(key, result)
      } catch (err) {
        log.error('settled failed', { key, err })
      }
    }
  }

  return {
    submit(key, prior, next) {
      opts.show(next)
      const existing = chains.get(key)
      if (existing) {
        existing.pending = next
        existing.hasPending = true
        return
      }
      const chain: Chain<T> = { confirmed: prior, pending: next, hasPending: true }
      chains.set(key, chain)
      void pump(key, chain)
    },
    forget(key) {
      const chain = chains.get(key)
      if (!chain) return
      chain.pending = undefined
      chain.hasPending = false
    },
    busy: key => chains.has(key),
  }
}
