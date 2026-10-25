import { ref, type Ref } from 'vue'
import { ClientResponseError } from 'pocketbase'
import { pb } from '@/transport/pb'
import { mode } from './mode'
import { createLogger } from '@/utils/logger'

const log = createLogger('transport:connection')

export type ConnectionState = 'ok' | 'checking' | 'down'

export const GRACE_MS = 3000
export const BOOTSTRAP_TIMEOUT_MS = 8000
const MAX_DELAY_MS = 15000

export const connection: Ref<ConnectionState> = ref('ok')
export const attempt: Ref<number> = ref(0)

export function isNetworkError(err: unknown): boolean {
  if (err instanceof ClientResponseError) return err.status === 0 && !err.isAbort
  if (err instanceof TypeError) return /fetch|network|load failed/i.test(err.message)
  return err instanceof Error && err.message === 'timeout'
}

export function reconnectDelay(n: number): number {
  return Math.min(1000 * 2 ** n, MAX_DELAY_MS)
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

let graceTimer: ReturnType<typeof setTimeout> | null = null
let loopTimer: ReturnType<typeof setTimeout> | null = null
let looping = false
let probing = false
let generation = 0
let reconnectHandler: (() => Promise<void>) | null = null

function clearGrace() {
  if (graceTimer) clearTimeout(graceTimer)
  graceTimer = null
}

function clearLoopTimer() {
  if (loopTimer) clearTimeout(loopTimer)
  loopTimer = null
}

function cancelLoop() {
  generation += 1
  looping = false
  probing = false
  clearLoopTimer()
}

function scheduleProbe(gen: number) {
  clearLoopTimer()
  if (gen !== generation) return
  loopTimer = setTimeout(() => { void probe(gen) }, reconnectDelay(attempt.value))
}

async function probe(gen: number) {
  if (probing || gen !== generation) return
  probing = true
  clearLoopTimer()
  attempt.value += 1
  try {
    await withTimeout(pb.health.check(), BOOTSTRAP_TIMEOUT_MS)
    if (gen !== generation) return
    if (reconnectHandler) await reconnectHandler()
    if (gen !== generation) return
    looping = false
    attempt.value = 0
    connection.value = 'ok'
  } catch (err) {
    log.debug('reconnect probe failed', { err })
    if (gen === generation) scheduleProbe(gen)
  } finally {
    if (gen === generation) probing = false
  }
}

function startLoop() {
  if (looping) return
  looping = true
  attempt.value = 0
  scheduleProbe(generation)
}

function goDown() {
  clearGrace()
  connection.value = 'down'
  startLoop()
}

export function reportNetworkProblem(opts?: { immediate?: boolean }): void {
  // An online request that fails after a switch to offline must not start probing PocketBase.
  if (mode.value === 'offline' || connection.value === 'down') return
  if (opts?.immediate) {
    goDown()
    return
  }
  connection.value = 'checking'
  if (graceTimer) return
  graceTimer = setTimeout(() => {
    graceTimer = null
    if (connection.value === 'checking') goDown()
  }, GRACE_MS)
}

export function markReachable(): void {
  clearGrace()
  if (connection.value === 'down' || connection.value === 'checking') {
    cancelLoop()
    connection.value = 'ok'
    attempt.value = 0
  }
}

export function retryNow(): void {
  if (connection.value !== 'down') return
  looping = true
  void probe(generation)
}

export function onReconnect(fn: () => Promise<void>): void {
  reconnectHandler = fn
}

export function stopConnectionMonitor(): void {
  clearGrace()
  cancelLoop()
  connection.value = 'ok'
  attempt.value = 0
}
