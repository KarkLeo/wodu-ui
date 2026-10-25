import { ref, type Ref } from 'vue'
import { ClientResponseError } from 'pocketbase'
import { pb } from './pb'
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
  if (err instanceof TypeError) return true
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
let reconnectHandler: (() => Promise<void>) | null = null

function clearGrace() {
  if (graceTimer) clearTimeout(graceTimer)
  graceTimer = null
}

function clearLoopTimer() {
  if (loopTimer) clearTimeout(loopTimer)
  loopTimer = null
}

function scheduleProbe() {
  clearLoopTimer()
  if (!looping) return
  loopTimer = setTimeout(() => { void probe() }, reconnectDelay(attempt.value))
}

async function probe() {
  if (probing || !looping) return
  probing = true
  clearLoopTimer()
  attempt.value += 1
  try {
    await withTimeout(pb.health.check(), BOOTSTRAP_TIMEOUT_MS)
    if (reconnectHandler) await reconnectHandler()
    if (!looping) return
    looping = false
    attempt.value = 0
    connection.value = 'ok'
  } catch (err) {
    log.debug('reconnect probe failed', { err })
    if (looping) scheduleProbe()
  } finally {
    probing = false
  }
}

function startLoop() {
  if (looping) return
  looping = true
  attempt.value = 0
  scheduleProbe()
}

export function reportNetworkProblem(): void {
  if (connection.value === 'down') return
  connection.value = 'checking'
  if (graceTimer) return
  graceTimer = setTimeout(() => {
    graceTimer = null
    if (connection.value === 'checking') {
      connection.value = 'down'
      startLoop()
    }
  }, GRACE_MS)
}

export function markReachable(): void {
  clearGrace()
  if (connection.value === 'down' || connection.value === 'checking') {
    looping = false
    clearLoopTimer()
    connection.value = 'ok'
    attempt.value = 0
  }
}

export function retryNow(): void {
  if (connection.value !== 'down') return
  looping = true
  void probe()
}

export function onReconnect(fn: () => Promise<void>): void {
  reconnectHandler = fn
}

export function stopConnectionMonitor(): void {
  clearGrace()
  clearLoopTimer()
  looping = false
  connection.value = 'ok'
  attempt.value = 0
}
